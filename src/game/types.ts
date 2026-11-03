/**
 * Core domain types for Pocket Club Manager.
 *
 * This module is pure TypeScript: it must never import react-native,
 * expo-*, or any UI code, so the game core stays testable in plain Node
 * and portable if the UI layer ever changes.
 */

export type Position = 'GK' | 'DF' | 'MF' | 'FW';

/**
 * Detailed playing role, introduced in D4. The coarse Position bucket
 * stays for the engine and best-XI shape; Role is what ratings are
 * built from, because a full-back and a centre-back must not share a
 * template just because both are defenders.
 */
export type Role = 'GK' | 'CB' | 'FB' | 'WB' | 'DM' | 'CM' | 'AM' | 'W' | 'ST' | 'SS';

export interface Attributes {
  /** 1-99 */
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  /** Only meaningful for goalkeepers; outfielders sit near 20. */
  goalkeeping: number;
  /**
   * Tactical awareness, added in D4. A modelled attribute from the
   * role template, not a measured trait, until individual evidence
   * exists. It blends into defensive strength in the match engine.
   */
  tactical: number;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  /** Detailed role (D4). Always set by both the real and fictional paths. */
  role: Role;
  attributes: Attributes;
  /** Overall rating, 1-99, derived from attributes and position. */
  overall: number;
  /** Ceiling the player can realistically reach, 1-99. */
  potential: number;
  /**
   * D4 development rate, 0.70–1.30 (Slow / Steady / Rapid). Set for
   * real-pack players only; fictional players leave it unset and the
   * UI shows no development band for them.
   */
  developmentRate?: number;
  clubId: string;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  /** Hex colour used for badges and UI accents. */
  primaryColor: string;
  /** Starting cash for the career, in the game's fictional currency. */
  funds: number;
}

export interface League {
  clubs: Club[];
  players: Player[];
}

export interface GoalEvent {
  minute: number;
  scorerId: string;
  clubId: string;
}

export interface MatchResult {
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  /** Chronological goal events. Empty for a goalless draw. */
  events: GoalEvent[];
}

/**
 * Everything a save needs to store. The league itself is NOT stored:
 * it is regenerated deterministically from `seed`, so saves stay tiny
 * and two devices with the same seed see the same world.
 */
/**
 * One league fixture in a D5 domestic season. `result` is present
 * only once the fixture has been played; unplayed fixtures carry no
 * result, so a season's played state is exactly its played fixtures.
 * D5 generates fixtures; it never reuses the real 2024-25 schedule.
 */
export interface SeasonFixture {
  round: number;
  homeClubId: string;
  awayClubId: string;
  result?: MatchResult;
}

/** One row of a league table, computed from played fixtures only. */
export interface TableRow {
  clubId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/** A club's record in one completed season, for season history. */
export interface SeasonUserRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

/**
 * Compact record of one completed season. This is the only unbounded
 * season-history growth in D5 (about 1.5-2 KB per season). Fixture-by-
 * fixture scores and goal events of past seasons are deliberately not
 * retained beyond the final table; a future match-history screen
 * needs its own storage budget and approval.
 */
export interface SeasonRecord {
  season: number;
  leagueId: string;
  membershipVersion: string;
  championClubId: string;
  userClubId: string;
  userPosition: number;
  userRecord: SeasonUserRecord;
  finalTable: TableRow[];
  totalRounds: number;
}

/** One recent result for the user's club, labelled by season/round. */
export interface RecentResult {
  season: number;
  round: number;
  result: MatchResult;
}

/**
 * D5 season state, present only for qualifying real careers (a club
 * in the 2024-25 top-flight membership). Terminal state: after the
 * final round is simulated, currentRound becomes totalRounds + 1,
 * status becomes 'complete', and championClubId is set, all in the
 * same single save. Continue is disabled in that state.
 */
export interface SeasonData {
  leagueId: string;
  membershipVersion: string;
  fixtures: SeasonFixture[];
  currentRound: number;
  status: 'inProgress' | 'complete';
  championClubId?: string;
}

export interface GameState {
  seed: number;
  userClubId: string;
  season: number;
  /**
   * Legacy test-match history. Frozen for season careers: D5 season
   * play never appends to it and never clears it. Non-season careers
   * keep appending exactly as before.
   */
  results: MatchResult[];
  /** Current-season results for the user's club only, capped at 10. */
  recentResults?: RecentResult[];
  /** Completed-season records, one per finished season. */
  pastSeasons?: SeasonRecord[];
  /** D5 season state; absent for non-season careers. */
  seasonData?: SeasonData;
  /**
   * Dataset provenance, added in D2. Saves written before D2 have
   * neither field: those are legacy fictional saves and keep working
   * unchanged (the store treats a missing datasetSource as fictional).
   * Real careers record datasetSource 'real' and datasetVersion
   * like "v1@2026-11-02" from the data pack.
   */
  datasetSource?: 'real' | 'fictional';
  datasetVersion?: string;
}

export interface SaveMeta {
  id: string;
  name: string;
  updatedAt: number;
}
