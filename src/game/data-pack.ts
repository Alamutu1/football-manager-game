/**
 * Data pack schema for Pocket Club Manager (D1).
 *
 * A data pack is the offline bundle the app ships: real-world leagues,
 * clubs and players collected from openly licensed sources, plus a
 * licence manifest recording the source, licence, attribution
 * requirement and update date of every dataset inside it.
 *
 * Pure module: no react-native / expo imports, so it can be unit
 * tested with plain Node (see scripts/test-data-pack.mjs).
 *
 * Design rules (from docs/REVISED-PLAN-REAL-WORLD.md):
 * - Facts only. No proprietary ratings, no logos, no photographs.
 * - Every record carries a sourceId pointing at a manifest entry, so
 *   the origin of any name in the game can be traced.
 * - Validation never silently drops a problem: missing or outdated
 *   information is reported as a gap in the validation report.
 */

/** One dataset inside the pack, as recorded in the licence manifest. */
export interface DataPackSource {
  /** Stable key, e.g. "wikidata-leagues" or "openfootball-2024-25". */
  dataset: string;
  /** Human-readable source name, e.g. "Wikidata". */
  source: string;
  /** URL the data was fetched from. */
  url: string;
  /** Licence identifier, e.g. "CC0-1.0". */
  licence: string;
  /** What attribution the licence requires, in plain words. */
  attribution: string;
  /** ISO date (YYYY-MM-DD) the data was fetched. */
  fetchedAt: string;
  /** ISO date (YYYY-MM-DD) the source snapshot covers. */
  snapshotDate: string;
  /** Number of records taken from this dataset. */
  recordCount: number;
  /** "ok" when fetched and parsed, otherwise a short failure reason. */
  status: string;
}

export interface DataPackLeague {
  /** Stable id, e.g. "wd:Q9448" for a Wikidata entity. */
  id: string;
  name: string;
  country: string;
  /** Key of the manifest entry this record came from. */
  sourceId: string;
}

export interface DataPackClub {
  id: string;
  name: string;
  /** Id of the league this club belongs to. */
  leagueId: string;
  country: string;
  sourceId: string;
}

export interface DataPackPlayer {
  id: string;
  name: string;
  /** Id of the club this player is associated with. */
  clubId: string;
  /** Playing position in plain words, when the source gives one. */
  position?: string;
  /** ISO date (YYYY-MM-DD) when the source gives one. */
  dateOfBirth?: string;
  nationality?: string;
  sourceId: string;
}

export interface DataPack {
  /** Pack format version, starting at 1. */
  version: number;
  /** ISO date (YYYY-MM-DD) the snapshot was built. */
  snapshotDate: string;
  sources: DataPackSource[];
  leagues: DataPackLeague[];
  clubs: DataPackClub[];
  players: DataPackPlayer[];
}

export type ValidationSeverity = "error" | "warning" | "gap";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
}

export interface ValidationReport {
  /** True only when there are no "error" issues. */
  valid: boolean;
  counts: { leagues: number; clubs: number; players: number; sources: number };
  issues: ValidationIssue[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): boolean {
  return (
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

/**
 * Validate a data pack object. Accepts unknown input so the builder
 * and the tests can feed it raw parsed JSON. Errors block shipping;
 * warnings and gaps do not, but gaps must be listed in the D1 report.
 */
export function validateDataPack(input: unknown): ValidationReport {
  const issues: ValidationIssue[] = [];
  const push = (severity: ValidationSeverity, code: string, message: string) =>
    issues.push({ severity, code, message });

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return {
      valid: false,
      counts: { leagues: 0, clubs: 0, players: 0, sources: 0 },
      issues: [{ severity: "error", code: "NOT_AN_OBJECT", message: "Data pack must be a JSON object." }],
    };
  }
  const pack = input as Record<string, unknown>;

  if (pack.version !== 1) {
    push("error", "BAD_VERSION", "Data pack version must be 1.");
  }
  if (!isIsoDate(pack.snapshotDate)) {
    push("error", "BAD_SNAPSHOT_DATE", "snapshotDate must be an ISO date (YYYY-MM-DD).");
  }

  const leagues = Array.isArray(pack.leagues) ? pack.leagues : [];
  const clubs = Array.isArray(pack.clubs) ? pack.clubs : [];
  const players = Array.isArray(pack.players) ? pack.players : [];
  const sources = Array.isArray(pack.sources) ? pack.sources : [];
  if (!Array.isArray(pack.leagues)) push("error", "MISSING_LEAGUES", "leagues must be an array.");
  if (!Array.isArray(pack.clubs)) push("error", "MISSING_CLUBS", "clubs must be an array.");
  if (!Array.isArray(pack.players)) push("error", "MISSING_PLAYERS", "players must be an array.");
  if (!Array.isArray(pack.sources)) push("error", "MISSING_SOURCES", "sources must be an array.");

  // Manifest completeness: every dataset records source, licence,
  // attribution and update date (requirement 2).
  const sourceKeys = new Set<string>();
  for (const s of sources) {
    const src = s as Record<string, unknown>;
    const key = typeof src.dataset === "string" ? src.dataset : "";
    if (key) sourceKeys.add(key);
    if (!isNonEmptyString(src.dataset)) push("error", "SOURCE_NO_DATASET", "A manifest entry is missing its dataset key.");
    if (!isNonEmptyString(src.source)) push("error", "SOURCE_NO_NAME", `Manifest entry "${key || "?"}" is missing its source name.`);
    if (!isNonEmptyString(src.url)) push("error", "SOURCE_NO_URL", `Manifest entry "${key || "?"}" is missing its URL.`);
    if (!isNonEmptyString(src.licence)) push("error", "SOURCE_NO_LICENCE", `Manifest entry "${key || "?"}" is missing its licence.`);
    if (!isNonEmptyString(src.attribution)) push("error", "SOURCE_NO_ATTRIBUTION", `Manifest entry "${key || "?"}" is missing its attribution requirement.`);
    if (!isIsoDate(src.fetchedAt)) push("error", "SOURCE_NO_FETCH_DATE", `Manifest entry "${key || "?"}" is missing a valid fetchedAt date.`);
    if (!isIsoDate(src.snapshotDate)) push("error", "SOURCE_NO_SNAPSHOT_DATE", `Manifest entry "${key || "?"}" is missing a valid snapshotDate.`);
    if (typeof src.recordCount !== "number" || src.recordCount < 0) push("error", "SOURCE_BAD_COUNT", `Manifest entry "${key || "?"}" has an invalid recordCount.`);
    if (src.status !== "ok") push("warning", "SOURCE_NOT_OK", `Manifest entry "${key || "?"}" has status "${String(src.status)}".`);
  }
  if (sources.length === 0) {
    push("error", "NO_SOURCES", "The licence manifest is empty.");
  }

  // Unique ids and required fields, plus traceability to the manifest.
  const checkRecords = (
    records: unknown[],
    kind: string,
    idOf: (r: Record<string, unknown>) => unknown,
  ) => {
    const seen = new Set<string>();
    for (const r of records) {
      const rec = r as Record<string, unknown>;
      const id = idOf(rec);
      if (!isNonEmptyString(id)) {
        push("error", "MISSING_ID", `A ${kind} record is missing its id.`);
        continue;
      }
      if (seen.has(id)) push("error", "DUPLICATE_ID", `Duplicate ${kind} id: ${id}.`);
      seen.add(id);
      if (!isNonEmptyString(rec.name)) push("error", "MISSING_NAME", `${kind} ${id} is missing its name.`);
      if (!isNonEmptyString(rec.sourceId)) {
        push("error", "MISSING_SOURCE", `${kind} ${id} has no sourceId.`);
      } else if (!sourceKeys.has(rec.sourceId as string)) {
        push("error", "UNKNOWN_SOURCE", `${kind} ${id} points at unknown manifest entry "${String(rec.sourceId)}".`);
      }
    }
    return seen;
  };

  const leagueIds = checkRecords(leagues, "league", (r) => r.id);
  const clubIds = checkRecords(clubs, "club", (r) => r.id);
  checkRecords(players, "player", (r) => r.id);

  // Referential integrity: every club belongs to a known league, every
  // player belongs to a known club.
  for (const c of clubs) {
    const club = c as Record<string, unknown>;
    if (isNonEmptyString(club.leagueId) && !leagueIds.has(club.leagueId)) {
      push("error", "DANGLING_LEAGUE", `Club ${String(club.id)} points at unknown league "${String(club.leagueId)}".`);
    }
  }
  const playersPerClub = new Map<string, number>();
  for (const p of players) {
    const player = p as Record<string, unknown>;
    if (isNonEmptyString(player.clubId)) {
      if (!clubIds.has(player.clubId)) {
        push("error", "DANGLING_CLUB", `Player ${String(player.id)} points at unknown club "${String(player.clubId)}".`);
      } else {
        playersPerClub.set(player.clubId, (playersPerClub.get(player.clubId) ?? 0) + 1);
      }
      // Missing factual fields are gaps, not errors: the record stays,
      // but the gap is reported (requirement 3).
      if (!isNonEmptyString(player.position)) push("gap", "PLAYER_NO_POSITION", `Player ${String(player.id)} (${String(player.name)}) has no position in the source.`);
      if (!isNonEmptyString(player.dateOfBirth)) push("gap", "PLAYER_NO_DOB", `Player ${String(player.id)} (${String(player.name)}) has no date of birth in the source.`);
    }
  }
  for (const c of clubs) {
    const club = c as Record<string, unknown>;
    if (isNonEmptyString(club.id) && (playersPerClub.get(club.id) ?? 0) === 0) {
      push("gap", "CLUB_NO_PLAYERS", `Club ${String(club.id)} (${String(club.name)}) has no players in the pack.`);
    }
  }
  for (const l of leagues) {
    const league = l as Record<string, unknown>;
    const clubCount = clubs.filter(
      (c) => (c as Record<string, unknown>).leagueId === league.id,
    ).length;
    if (clubCount === 0) {
      push("gap", "LEAGUE_NO_CLUBS", `League ${String(league.id)} (${String(league.name)}) has no clubs in the pack.`);
    }
  }

  return {
    valid: !issues.some((i) => i.severity === "error"),
    counts: { leagues: leagues.length, clubs: clubs.length, players: players.length, sources: sources.length },
    issues,
  };
}
