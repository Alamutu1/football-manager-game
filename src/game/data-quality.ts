/**
 * D3 data-quality layer: classifies every pack player association
 * from live Wikidata evidence, without inventing anything.
 *
 * Pure module: no react-native / expo imports, no network. The
 * overlay JSON (data-packs/v1/quality.json) is built offline by
 * scripts/build-quality-overlay.mjs from cached Wikidata responses;
 * this module only classifies statement sets and reads that overlay
 * safely at runtime.
 *
 * Status meanings (shown honestly in the UI):
 * - verified_current: Wikidata still lists the player at this club
 *   with a non-deprecated statement and no end date, and no other
 *   senior club claims the player the same way. This is
 *   "Wikidata-current", NOT an independently confirmed matchday
 *   squad: a stale statement Wikidata never ended still verifies.
 *   The game says so wherever it shows this label.
 * - historical: the live statement has an end date, is deprecated
 *   only, or is gone from live Wikidata. The player left (or the
 *   association was removed).
 * - conflicting: the player is currently listed at two or more
 *   senior clubs at once. Wikidata itself disagrees; the game does
 *   not pick a winner.
 * - uncertain: the evidence cannot settle it — no live check, a
 *   fictional-character item, or a women's-section association
 *   (a female player listed under a men's club entity).
 */

export type AssociationStatus = 'verified_current' | 'historical' | 'conflicting' | 'uncertain';

/** One club-type P54 statement, kind-tagged by the overlay builder. */
export interface ClubStatement {
  clubId: string;
  clubLabel?: string;
  rank: 'normal' | 'preferred' | 'deprecated';
  start?: string;
  end?: string;
  kind: 'pack_club' | 'other_senior' | 'national' | 'regional' | 'youth_reserve' | 'womens';
}

export interface QualityEvidence {
  liveClubStatement: 'current' | 'ended' | 'deprecated_only' | 'absent' | 'unknown';
  endDate?: string;
  otherCurrentClubs: string[];
  female?: boolean;
  description?: string;
  preferredClub?: string;
}

export interface QualityEntry {
  playerId: string;
  clubId: string;
  status: AssociationStatus;
  reason: string;
  evidence: QualityEvidence;
}

export interface DataQuality {
  version: number;
  packVersion: string;
  generatedAt: string;
  method: string;
  entries: QualityEntry[];
}

export interface Classification {
  status: AssociationStatus;
  reason: string;
  evidence: QualityEvidence;
}

const STATUSES: AssociationStatus[] = ['verified_current', 'historical', 'conflicting', 'uncertain'];

function isFictional(description: string | undefined): boolean {
  return !!description && /fictional/i.test(description);
}

/**
 * Classify one pack association from the player's live statements.
 * `statements` are the player's club-type statements (national and
 * youth/reserve items are kind-tagged so they never count as a
 * conflicting senior club). Order matters: a fictional item is
 * decisive; a current statement beats an ended one for the same
 * club (players do return); a women's-section association is
 * uncertain even when it looks current.
 */
export function classifyAssociation(input: {
  statements: ClubStatement[];
  packClubId: string;
  female: boolean;
  description?: string;
  liveDataAvailable: boolean;
}): Classification {
  const { statements, packClubId, female, description, liveDataAvailable } = input;

  if (isFictional(description)) {
    return {
      status: 'uncertain',
      reason: 'Wikidata item is a fictional character, not the footballer.',
      evidence: {
        liveClubStatement: 'unknown',
        otherCurrentClubs: [],
        description,
      },
    };
  }

  if (!liveDataAvailable) {
    return {
      status: 'uncertain',
      reason: 'No live Wikidata check was available for this player.',
      evidence: { liveClubStatement: 'unknown', otherCurrentClubs: [] },
    };
  }

  const clubStatements = statements.filter((s) => s.clubId === packClubId);
  const currentToClub = clubStatements.filter((s) => s.rank !== 'deprecated' && !s.end);

  if (clubStatements.length === 0) {
    return {
      status: 'historical',
      reason: 'No longer listed at this club in live Wikidata.',
      evidence: { liveClubStatement: 'absent', otherCurrentClubs: [] },
    };
  }

  if (currentToClub.length === 0) {
    const ended = clubStatements.filter((s) => s.end).sort((a, b) => (b.end ?? '').localeCompare(a.end ?? ''));
    if (ended.length > 0) {
      return {
        status: 'historical',
        reason: `Left this club (association ended ${ended[0].end?.slice(0, 10) ?? ''}).`,
        evidence: {
          liveClubStatement: 'ended',
          endDate: ended[0].end,
          otherCurrentClubs: [],
        },
      };
    }
    return {
      status: 'historical',
      reason: 'Only a deprecated statement remains for this club.',
      evidence: { liveClubStatement: 'deprecated_only', otherCurrentClubs: [] },
    };
  }

  if (female) {
    return {
      status: 'uncertain',
      reason: "Recorded as female: likely the club's women's section, not the men's squad.",
      evidence: {
        liveClubStatement: 'current',
        otherCurrentClubs: [],
        female: true,
      },
    };
  }

  const currentSenior = statements.filter(
    (s) =>
      s.rank !== 'deprecated' &&
      !s.end &&
      (s.kind === 'pack_club' || s.kind === 'other_senior'),
  );
  // Wikidata's own ranking resolves some multi-club items: exactly
  // one preferred-rank current senior statement is the editors'
  // marker for the current club. When it points at the pack club,
  // the other normal-rank statements are stale; when it points
  // elsewhere, the pack association is the stale one.
  const preferred = currentSenior.filter((s) => s.rank === 'preferred');
  if (preferred.length === 1) {
    if (preferred[0].clubId === packClubId) {
      return {
        status: 'verified_current',
        reason: 'Wikidata marks this club as the player\'s preferred current club.',
        evidence: {
          liveClubStatement: 'current',
          otherCurrentClubs: [],
          preferredClub: preferred[0].clubLabel ?? preferred[0].clubId,
        },
      };
    }
    return {
      status: 'historical',
      reason: `Wikidata's preferred current club is ${preferred[0].clubLabel ?? preferred[0].clubId}, not this club.`,
      evidence: {
        liveClubStatement: 'current',
        otherCurrentClubs: [],
        preferredClub: preferred[0].clubLabel ?? preferred[0].clubId,
      },
    };
  }

  const others = currentSenior.filter((s) => s.clubId !== packClubId);
  if (others.length > 0) {
    const labels = [...new Set(others.map((s) => s.clubLabel ?? s.clubId))];
    return {
      status: 'conflicting',
      reason: `Also currently listed at: ${labels.join(', ')}.`,
      evidence: {
        liveClubStatement: 'current',
        otherCurrentClubs: labels,
      },
    };
  }

  return {
    status: 'verified_current',
    reason: 'Wikidata still lists the player at this club with no end date.',
    evidence: { liveClubStatement: 'current', otherCurrentClubs: [] },
  };
}

/** Safely read an overlay: malformed input yields null, never a throw. */
export function loadQuality(input: unknown): DataQuality | null {
  try {
    if (typeof input !== 'object' || input === null) return null;
    const obj = input as { entries?: unknown; packVersion?: unknown; generatedAt?: unknown; method?: unknown };
    if (!Array.isArray(obj.entries)) return null;
    const entries: QualityEntry[] = [];
    for (const raw of obj.entries) {
      if (typeof raw !== 'object' || raw === null) continue;
      const e = raw as Partial<QualityEntry>;
      if (typeof e.playerId !== 'string' || typeof e.clubId !== 'string') continue;
      if (!STATUSES.includes(e.status as AssociationStatus)) continue;
      entries.push({
        playerId: e.playerId,
        clubId: e.clubId,
        status: e.status as AssociationStatus,
        reason: typeof e.reason === 'string' ? e.reason : '',
        evidence: {
          liveClubStatement: (e.evidence?.liveClubStatement as QualityEvidence['liveClubStatement']) ?? 'unknown',
          endDate: e.evidence?.endDate,
          otherCurrentClubs: Array.isArray(e.evidence?.otherCurrentClubs)
            ? e.evidence.otherCurrentClubs.filter((x): x is string => typeof x === 'string')
            : [],
          female: e.evidence?.female,
          description: e.evidence?.description,
          preferredClub: e.evidence?.preferredClub,
        },
      });
    }
    return {
      version: 1,
      packVersion: typeof obj.packVersion === 'string' ? obj.packVersion : '',
      generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : '',
      method: typeof obj.method === 'string' ? obj.method : '',
      entries,
    };
  } catch {
    return null;
  }
}

export function qualityKey(playerId: string, clubId: string): string {
  return `${playerId}|${clubId}`;
}

export function playerStatus(
  quality: DataQuality | null,
  playerId: string,
  clubId: string,
): QualityEntry | null {
  if (!quality) return null;
  return quality.entries.find((e) => e.playerId === playerId && e.clubId === clubId) ?? null;
}

export interface ClubQualitySummary {
  total: number;
  verified: number;
  historical: number;
  conflicting: number;
  uncertain: number;
  unverified: number;
}

export function clubSummary(
  quality: DataQuality | null,
  clubId: string,
  playerIds: string[],
): ClubQualitySummary {
  const summary: ClubQualitySummary = {
    total: playerIds.length,
    verified: 0,
    historical: 0,
    conflicting: 0,
    uncertain: 0,
    unverified: 0,
  };
  for (const playerId of playerIds) {
    const entry = playerStatus(quality, playerId, clubId);
    if (!entry) {
      summary.unverified += 1;
    } else if (entry.status === 'verified_current') {
      summary.verified += 1;
    } else if (entry.status === 'historical') {
      summary.historical += 1;
    } else if (entry.status === 'conflicting') {
      summary.conflicting += 1;
    } else {
      summary.uncertain += 1;
    }
  }
  return summary;
}

export function statusLabel(status: AssociationStatus): string {
  switch (status) {
    case 'verified_current':
      return 'Current';
    case 'historical':
      return 'Left';
    case 'conflicting':
      return 'Conflicting';
    case 'uncertain':
      return 'Uncertain';
  }
}

/** Short, honest footnote for a status shown in the UI. */
export function statusFootnote(status: AssociationStatus): string {
  switch (status) {
    case 'verified_current':
      return 'Wikidata-current: still listed at this club with no end date. Not an independently confirmed matchday squad.';
    case 'historical':
      return 'Left: live Wikidata ends this association or no longer lists it.';
    case 'conflicting':
      return 'Conflicting: Wikidata currently lists this player at more than one senior club.';
    case 'uncertain':
      return 'Uncertain: the evidence cannot settle this association.';
  }
}

// ---------------------------------------------------------------------------
// Club-name normaliser (D1 follow-up): match openfootball team names to
// Wikidata club names despite spelling and suffix variants.
// ---------------------------------------------------------------------------

const CHAR_MAP: Record<string, string> = {
  ß: 'ss',
  ø: 'o',
  æ: 'ae',
  đ: 'd',
  ł: 'l',
};

const DROP_TOKENS = new Set([
  'fc', 'cf', 'sc', 'ac', 'bc', 'as', 'rc', 'ssc', 'us', 'ud', 'cd', 'sd', 'ca', 'vfl', 'afc',
  'club', 'de', 'di', 'del', 'della', 'des', 'la', 'le', 'les',
  'football', 'futbol', 'fútbol', 'fussball', 'fußball', 'calcio',
  'atletico', 'atlético', 'real', 'royal', 'sport', 'sports', 'verein',
]);

/** Explicit full-name aliases for variants token-stripping cannot fix. */
const NAME_ALIASES: Record<string, string> = {
  'inter milan': 'internazionale milano',
  'bayern munich': 'bayern munchen',
  // Observed openfootball-vs-Wikidata pairs from the D3 recheck:
  'montpellier hsc': 'montpellier herault',
  'racing lens': 'lens',
  'rayo vallecano madrid': 'rayo vallecano',
};

export function normalizeClubName(name: string): string {
  let s = name.toLowerCase();
  for (const [from, to] of Object.entries(CHAR_MAP)) s = s.split(from).join(to);
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // strip combining marks
  // Remove dots first: "F.C." must become "FC" (a droppable token),
  // not "f c" (two tokens that survive and break matching).
  s = s.replace(/\./g, '');
  s = s.replace(/[^a-z0-9 ]/g, ' ');
  const tokens = s.split(/\s+/).filter((t) => t && !DROP_TOKENS.has(t));
  // Drop trailing founding-year tokens ("Stade Rennais FC 1901" is
  // the same club as "Stade Rennais F.C.").
  while (tokens.length > 1 && /^\d{4}$/.test(tokens[tokens.length - 1])) tokens.pop();
  const joined = tokens.join(' ');
  return NAME_ALIASES[joined] ?? joined;
}
