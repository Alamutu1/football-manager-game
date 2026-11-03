/**
 * D2 dataset loader: turns a validated real-world data pack into
 * things the game can use, completely offline.
 *
 * Pure module: no react-native / expo imports, no network calls, no
 * file access. The caller (the store) hands it parsed JSON — in the
 * app that JSON is the bundled pack imported at build time; in tests
 * it is read from disk. Either way the loader itself never fetches.
 *
 * Safety contract (requirement 6): every function here tolerates
 * bad input without throwing. `loadDataPack` returns a failure
 * object instead of throwing, and the adapter functions return
 * empty-but-valid shapes for missing data. The store turns a loader
 * failure into a visible error + a fictional fallback, never a crash.
 *
 * Ratings contract (D4): adapted players carry computed D4 ratings
 * (model version d4-v3, basis model-estimate), not the D2 uniform
 * placeholders. The UI labels them as PCM estimates; D3 quality
 * statuses still describe the association, not the rating.
 */

import { validateDataPack } from './data-pack';
import type {
  DataPack,
  DataPackClub,
  DataPackLeague,
  DataPackPlayer,
  ValidationIssue,
} from './data-pack';
import type {
  Club,
  GameState,
  League,
  Player,
  Position,
} from './types';
import {
  clubModFor,
  computeRating,
  leagueModFor,
  roleOf,
  type ClubStrength,
} from './ratings';
import { membershipFor } from './season-membership';

export type LoadResult =
  | { ok: true; pack: DataPack }
  | { ok: false; issues: ValidationIssue[] };

/** Validate parsed JSON and return the pack, or a failure — never throws. */
export function loadDataPack(input: unknown): LoadResult {
  try {
    const report = validateDataPack(input);
    if (!report.valid) return { ok: false, issues: report.issues };
    return { ok: true, pack: input as DataPack };
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          severity: 'error',
          code: 'LOAD_THREW',
          message: e instanceof Error ? e.message : 'Data pack could not be loaded.',
        },
      ],
    };
  }
}

/** Dataset version recorded in saves, e.g. "v1@2026-11-02". */
export function packVersion(pack: DataPack): string {
  return `v${pack.version}@${pack.snapshotDate}`;
}

/** How a save identifies its dataset. Absent fields mean a legacy save. */
export function datasetOf(game: GameState): { source: 'real' | 'fictional'; version: string | null } {
  if (game.datasetSource === 'real') {
    return { source: 'real', version: game.datasetVersion ?? null };
  }
  return { source: 'fictional', version: game.datasetVersion ?? null };
}

export function leaguesOf(pack: DataPack): DataPackLeague[] {
  return [...(pack.leagues ?? [])].sort((a, b) => a.name.localeCompare(b.name));
}

export function clubsOfLeague(pack: DataPack, leagueId: string): DataPackClub[] {
  return [...(pack.clubs ?? [])]
    .filter((c) => c.leagueId === leagueId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function playersOfClub(pack: DataPack, clubId: string): DataPackPlayer[] {
  return [...(pack.players ?? [])]
    .filter((p) => p.clubId === clubId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function leagueOfClub(pack: DataPack, clubId: string): DataPackLeague | undefined {
  const club = (pack.clubs ?? []).find((c) => c.id === clubId);
  if (!club) return undefined;
  return (pack.leagues ?? []).find((l) => l.id === club.leagueId);
}

/** Whole years between a birth date and the snapshot date, or null. */
export function ageAt(snapshotDate: string, dateOfBirth: string | undefined): number | null {
  if (!dateOfBirth) return null;
  const born = new Date(dateOfBirth);
  const at = new Date(snapshotDate);
  if (Number.isNaN(born.getTime()) || Number.isNaN(at.getTime())) return null;
  let age = at.getFullYear() - born.getFullYear();
  const beforeBirthday =
    at.getMonth() < born.getMonth() ||
    (at.getMonth() === born.getMonth() && at.getDate() < born.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * Map a Wikidata position string to a game position bucket.
 * Order matters: goalkeeper first, then defensive markers, then
 * midfield, then attacking markers. Unknown strings default to MF
 * (midfield is the least wrong bucket for an unspecified player).
 */
export function mapPosition(positionText: string | undefined): Position {
  const s = (positionText ?? '').toLowerCase();
  if (s.includes('goalkeeper') || s.includes('goal keeper')) return 'GK';
  if (
    s.includes('back') ||
    s.includes('defend') ||
    s.includes('sweeper') ||
    s.includes('centre-back') ||
    s.includes('center-back')
  ) {
    return 'DF';
  }
  if (s.includes('midfield')) return 'MF';
  if (
    s.includes('forward') ||
    s.includes('winger') ||
    s.includes('striker') ||
    s.includes('attacker') ||
    s.includes('wing half')
  ) {
    return 'FW';
  }
  return 'MF';
}

/** Initials for a badge, e.g. "Real Madrid Club de Fútbol" -> "RMF". */
export function shortNameFor(name: string): string {
  const words = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').split(' ').filter(Boolean);
  const initials = words.map((w) => w[0].toUpperCase()).join('').slice(0, 3);
  return initials || 'FC';
}

/** Deterministic muted colour from a name, so badges differ per club. */
export function colorFor(name: string): string {
  const palette = ['#1B5E20', '#0D47A1', '#6A1B9A', '#B71C1C', '#004D40', '#3E2723', '#1A237E', '#880E4F'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  }
  return palette[hash % palette.length];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: fullName, lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * D4: adapt one pack player into a game Player with computed ratings.
 * Ratings are snapshot-anchored: the league and club modifiers come
 * from the pack (snapshot) club, so a future transfer that changes
 * clubId must keep passing the snapshot modifiers to computeRating —
 * see the anchor note on RatingInput.clubMod. Seasons elapsed come
 * from the career season (season − 1); browsing passes 0.
 */
function adaptPlayer(
  p: DataPackPlayer,
  snapshotDate: string,
  leagueName: string | undefined,
  strength: ClubStrength | null,
  seasonsElapsed: number,
): Player {
  const { firstName, lastName } = splitName(p.name);
  const position = mapPosition(p.position);
  const role = roleOf(p.position);
  const age = ageAt(snapshotDate, p.dateOfBirth) ?? 0;
  const rating = computeRating({
    id: p.id,
    role,
    age,
    leagueMod: leagueModFor(leagueName),
    clubMod: clubModFor(strength, p.clubId),
    seasonsElapsed,
  });
  return {
    id: p.id,
    firstName,
    lastName,
    age,
    position,
    role,
    attributes: rating.attributes,
    overall: rating.overall,
    potential: rating.potential,
    developmentRate: rating.developmentRate,
    clubId: p.clubId,
  };
}

/**
 * Adapt one real league from the pack into the game's League shape so
 * the existing store, engine and screens work unchanged. Clubs get
 * initials badges and deterministic colours; funds are 0 because the
 * pack carries no financial data (the UI shows "—" for real clubs
 * rather than $0). A league with no clubs, or clubs with no players,
 * adapts to an empty-but-valid League — never a throw.
 */
/**
 * D4 rating for one pack player, computed on the fly for browsing
 * screens (which show pack data, not adapted league players).
 * Snapshot-anchored like adaptPlayer: the modifiers come from the
 * pack club, and seasonsElapsed is 0 for browsing.
 */
export function ratingForPackPlayer(
  pack: DataPack,
  strength: ClubStrength | null,
  p: DataPackPlayer,
  seasonsElapsed: number = 0,
) {
  const league = pack.leagues.find((l) => l.id === pack.clubs.find((c) => c.id === p.clubId)?.leagueId);
  return computeRating({
    id: p.id,
    role: roleOf(p.position),
    age: ageAt(pack.snapshotDate, p.dateOfBirth) ?? 0,
    leagueMod: leagueModFor(league?.name),
    clubMod: clubModFor(strength, p.clubId),
    seasonsElapsed,
  });
}

export function adaptPackToLeague(
  pack: DataPack,
  leagueId: string,
  strength: ClubStrength | null = null,
  seasonsElapsed: number = 0,
  membershipOnly: boolean = false,
): League {
  const league = pack.leagues.find((l) => l.id === leagueId);
  const memberIds = membershipOnly ? membershipFor(leagueId) : null;
  const clubs: Club[] = clubsOfLeague(pack, leagueId)
    .filter((c) => !memberIds || memberIds.includes(c.id))
    .map((c) => ({
    id: c.id,
    name: c.name,
    shortName: shortNameFor(c.name),
    primaryColor: colorFor(c.name),
    funds: 0,
  }));
  const clubIds = new Set(clubs.map((c) => c.id));
  const players: Player[] = (pack.players ?? [])
    .filter((p) => clubIds.has(p.clubId))
    .map((p) => adaptPlayer(p, pack.snapshotDate, league?.name, strength, seasonsElapsed));
  return { clubs, players };
}
