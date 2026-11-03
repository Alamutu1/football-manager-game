import type { Attributes, Position, Role } from './types';
import { clamp, createRng } from './rng';

/**
 * D4 player rating model (model version d4-v3, 3 Nov 2026 calibration).
 *
 * What this is: an independently generated estimate built from public
 * facts (position, age, league, team-level 2024–25 results) plus a
 * deterministic per-player signature. It is NOT measured performance
 * and it is NOT EA Sports FC or Football Manager data: no value,
 * weight, or formula below comes from either product.
 *
 * What it is not: a claim about any real player. A rating carries
 * modelVersion + basis + evidence on every computed profile so any
 * consumer can tell an estimate from verified individual data. When
 * individual evidence arrives, it plugs into the reserved evidence
 * slot (see computeRating's evidence parameter) instead of silently
 * replacing the model.
 *
 * Determinism: every function here is pure. Same inputs (player id,
 * role, age, league/club modifiers, seasons elapsed) always give the
 * same profile, including multi-season trajectories.
 */

/** Model version stamped on every computed profile. v3 = 3 Nov 2026 calibration (GK rebalance, role-mean alignment, reduced signature, steeper GK decline). v2 is preserved in ~/workspace/pcm-d4v2-backup-2026-11-03.zip and in docs/D4-REPORT.md. */
export const RATING_MODEL_VERSION = 'd4-v3';
/** Basis flag: all D4 ratings are model estimates today. */
export const RATING_BASIS = 'model-estimate';
/** Evidence that goes into a real-pack rating today. */
export const RATING_EVIDENCE = ['position', 'age', 'club-results-2024-25'] as const;

export type Tier = 'Developing' | 'Professional' | 'Established' | 'Exceptional';
export type DevelopmentBand = 'Slow' | 'Steady' | 'Rapid';

/**
 * Overall rating from attributes, weighted by coarse position.
 * Kept for the fictional generator (Phase 0 path), which still uses
 * its own bell-curve attributes. Weights sum to 1 for every position.
 * D4 real-pack ratings use overallForRole instead.
 */
const WEIGHTS: Record<Position, Record<keyof Attributes, number>> = {
  GK: { pace: 0.05, shooting: 0.02, passing: 0.08, dribbling: 0.02, defending: 0.08, physical: 0.1, goalkeeping: 0.55, tactical: 0.1 },
  DF: { pace: 0.13, shooting: 0.05, passing: 0.13, dribbling: 0.05, defending: 0.36, physical: 0.16, goalkeeping: 0.02, tactical: 0.1 },
  MF: { pace: 0.13, shooting: 0.13, passing: 0.27, dribbling: 0.18, defending: 0.09, physical: 0.07, goalkeeping: 0.02, tactical: 0.11 },
  FW: { pace: 0.23, shooting: 0.32, passing: 0.09, dribbling: 0.18, defending: 0.02, physical: 0.05, goalkeeping: 0.02, tactical: 0.09 },
};

export function overallFor(position: Position, attrs: Attributes): number {
  const w = WEIGHTS[position];
  const total =
    w.pace * attrs.pace +
    w.shooting * attrs.shooting +
    w.passing * attrs.passing +
    w.dribbling * attrs.dribbling +
    w.defending * attrs.defending +
    w.physical * attrs.physical +
    w.goalkeeping * attrs.goalkeeping +
    w.tactical * attrs.tactical;
  return clamp(Math.round(total + 1e-9), 1, 99);
}

/** D4 role weights for overall. Each row sums to 1. */
const ROLE_WEIGHTS: Record<Role, Partial<Record<keyof Attributes, number>>> = {
  GK: { goalkeeping: 0.5, tactical: 0.15, passing: 0.13, physical: 0.12, pace: 0.05, defending: 0.03, dribbling: 0.02 },
  CB: { defending: 0.35, physical: 0.2, tactical: 0.18, pace: 0.1, passing: 0.11, shooting: 0.03, dribbling: 0.03 },
  FB: { defending: 0.3, pace: 0.24, passing: 0.14, dribbling: 0.12, tactical: 0.08, physical: 0.1, shooting: 0.02 },
  WB: { pace: 0.22, defending: 0.18, dribbling: 0.15, passing: 0.15, physical: 0.12, tactical: 0.1, shooting: 0.08 },
  DM: { defending: 0.25, tactical: 0.2, passing: 0.2, physical: 0.15, pace: 0.08, dribbling: 0.08, shooting: 0.04 },
  CM: { passing: 0.28, tactical: 0.18, dribbling: 0.15, defending: 0.11, physical: 0.11, shooting: 0.09, pace: 0.08 },
  AM: { passing: 0.23, dribbling: 0.21, shooting: 0.19, tactical: 0.14, pace: 0.11, physical: 0.07, defending: 0.05 },
  W: { dribbling: 0.24, pace: 0.24, shooting: 0.16, passing: 0.14, tactical: 0.09, physical: 0.09, defending: 0.04 },
  ST: { shooting: 0.35, pace: 0.18, dribbling: 0.15, physical: 0.12, tactical: 0.1, passing: 0.07, defending: 0.03 },
  SS: { shooting: 0.22, dribbling: 0.18, passing: 0.18, tactical: 0.14, pace: 0.12, physical: 0.12, defending: 0.04 },
};

/**
 * The role's three most-weighted attributes, highest weight first.
 * Used only to emphasise key attributes in the profile view; it does
 * not change any rating. Every role has at least three weights.
 */
export function keyAttributesFor(role: Role): (keyof Attributes)[] {
  const w = ROLE_WEIGHTS[role];
  return (Object.keys(w) as (keyof Attributes)[])
    .sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0))
    .slice(0, 3);
}

export function overallForRole(role: Role, attrs: Attributes): number {
  const w = ROLE_WEIGHTS[role];
  let total = 0;
  for (const key of Object.keys(w) as (keyof Attributes)[]) {
    total += (w[key] ?? 0) * attrs[key];
  }
  // 1e-9 corrects binary float representation error only: true sums
  // are multiples of 0.01 (integer attributes × two-decimal weights),
  // so no true value sits within 1e-9 of a .5 rounding boundary
  // except an exact .5, which must round up. Without it, a true 68.5
  // stored as 68.49999999999999 rounds down, and a uniform +1 shift
  // can then appear as a +2 overall jump.
  return clamp(Math.round(total + 1e-9), 1, 99);
}

/** Role templates: typical peak-age profile for the role, 1–99. */
const TEMPLATES: Record<Role, Attributes> = {
  GK: { pace: 45, shooting: 20, passing: 58, dribbling: 38, defending: 32, physical: 65, goalkeeping: 84, tactical: 65 },
  CB: { pace: 60, shooting: 38, passing: 60, dribbling: 50, defending: 84, physical: 78, goalkeeping: 12, tactical: 70 },
  FB: { pace: 76, shooting: 45, passing: 66, dribbling: 64, defending: 72, physical: 66, goalkeeping: 12, tactical: 66 },
  WB: { pace: 80, shooting: 50, passing: 68, dribbling: 68, defending: 64, physical: 68, goalkeeping: 12, tactical: 64 },
  DM: { pace: 64, shooting: 52, passing: 72, dribbling: 62, defending: 76, physical: 74, goalkeeping: 12, tactical: 76 },
  CM: { pace: 66, shooting: 59, passing: 80, dribbling: 68, defending: 62, physical: 68, goalkeeping: 12, tactical: 74 },
  AM: { pace: 70, shooting: 66, passing: 80, dribbling: 80, defending: 44, physical: 59, goalkeeping: 12, tactical: 72 },
  W: { pace: 84, shooting: 64, passing: 66, dribbling: 82, defending: 34, physical: 60, goalkeeping: 12, tactical: 60 },
  ST: { pace: 74, shooting: 84, passing: 60, dribbling: 70, defending: 30, physical: 72, goalkeeping: 12, tactical: 64 },
  SS: { pace: 72, shooting: 76, passing: 72, dribbling: 74, defending: 39, physical: 66, goalkeeping: 12, tactical: 70 },
};

/**
 * Per-attribute age curves. `start`/`end` bound the peak window;
 * `decline` is the factor lost per year past `end` (snapshot curve);
 * `declinePts` is the points lost per season past `end` (step curve).
 * Pace goes early, tactical awareness and goalkeeping late — that is
 * the whole point of having eight curves instead of one.
 */
const CURVES: Record<keyof Attributes, { start: number; end: number; decline: number; declinePts: number }> = {
  pace: { start: 21, end: 26, decline: 0.02, declinePts: 1.6 },
  physical: { start: 24, end: 29, decline: 0.012, declinePts: 1.1 },
  shooting: { start: 25, end: 30, decline: 0.008, declinePts: 0.7 },
  passing: { start: 25, end: 31, decline: 0.008, declinePts: 0.7 },
  dribbling: { start: 24, end: 29, decline: 0.009, declinePts: 0.8 },
  defending: { start: 26, end: 30, decline: 0.01, declinePts: 0.9 },
  goalkeeping: { start: 28, end: 33, decline: 0.013, declinePts: 1.2 },
  tactical: { start: 28, end: 33, decline: 0.004, declinePts: 0.35 },
};

/** Attribute order. Fixed: the signature draw sequence depends on it. */
const ATTR_ORDER: (keyof Attributes)[] = [
  'pace',
  'physical',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'goalkeeping',
  'tactical',
];

/**
 * League context modifier, deliberately minimal (D4 v2 reduced it from
 * +2/+1 to +1/0). A player's ability comes primarily from his own
 * profile; the league term moves an overall by at most ~1 point.
 */
export function leagueModFor(leagueName: string | undefined): number {
  return leagueName === 'Premier League' ? 1 : 0;
}

/**
 * Map a Wikidata position string to a detailed role. Generic labels
 * take the central template of their line (defender → CB, midfielder
 * → CM, forward → ST); unrecognised labels fall back to CM, the same
 * fallback D2 already used for buckets.
 */
export function roleOf(positionText: string | undefined): Role {
  const s = (positionText ?? '').toLowerCase();
  if (s.includes('goalkeeper')) return 'GK';
  if (
    s.includes('centre-back') ||
    s.includes('center-back') ||
    s.includes('stopper') ||
    s.includes('sweeper')
  ) {
    return 'CB';
  }
  if (
    s.includes('full-back') ||
    s.includes('fullback') ||
    s.includes('right-back') ||
    s.includes('right back')
  ) {
    return 'FB';
  }
  if (s.includes('defensive midfielder')) return 'DM';
  if (s.includes('attacking midfielder')) return 'AM';
  if (s.includes('central midfielder') || s.includes('playmaker')) return 'CM';
  if (
    s.includes('winger') ||
    s.includes('wing half') ||
    s.includes('wide midfielder') ||
    s.includes('left wing') ||
    s.includes('inside forward')
  ) {
    return 'W';
  }
  if (
    s.includes('centre-forward') ||
    s.includes('center-forward') ||
    s.includes('forward center')
  ) {
    return 'ST';
  }
  if (s.includes('forward') || s.includes('attacker') || s.includes('striker')) return 'ST';
  if (s.includes('defender') || s.includes('defend')) return 'CB';
  if (s.includes('midfield')) return 'CM';
  return 'CM';
}

/** Coarse bucket for a role (engine and best-XI shape still use buckets). */
export function positionGroup(role: Role): Position {
  if (role === 'GK') return 'GK';
  if (role === 'CB' || role === 'FB' || role === 'WB') return 'DF';
  if (role === 'DM' || role === 'CM' || role === 'AM') return 'MF';
  return 'FW';
}

/** FNV-1a hash of a string, used to seed the per-player signature. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Snapshot age factor for one attribute at one age. */
export function ageFactor(attr: keyof Attributes, age: number): number {
  const c = CURVES[attr];
  if (age < c.start) return 0.86 + 0.14 * ((age - 16) / (c.start - 16));
  if (age <= c.end) return 1.0;
  return Math.max(0.75, 1.0 - c.decline * (age - c.end));
}

export interface RatedProfile {
  role: Role;
  /** Age at the snapshot (before seasons elapsed are applied). */
  age: number;
  /** Age after seasons elapsed are applied. */
  currentAge: number;
  /** Current attributes, rounded integers for display and storage. */
  attributes: Attributes;
  /** Per-attribute potential ceilings (integers). */
  potentialAttributes: Attributes;
  overall: number;
  potential: number;
  developmentRate: number;
  developmentBand: DevelopmentBand;
  tier: Tier;
  /** Estimated transfer value in euros (model estimate, never a real valuation). */
  valueEstimate: number;
  modelVersion: string;
  basis: string;
  evidence: readonly string[];
}

export function tierFor(overall: number): Tier {
  if (overall < 62) return 'Developing';
  if (overall < 75) return 'Professional';
  if (overall < 83) return 'Established';
  return 'Exceptional';
}

export function developmentBand(rate: number): DevelopmentBand {
  if (rate < 0.85) return 'Slow';
  if (rate > 1.15) return 'Rapid';
  return 'Steady';
}

function ageMultiplier(age: number): number {
  if (age < 21) return 1.15;
  if (age <= 27) return 1.0;
  if (age <= 30) return 0.9;
  if (age <= 32) return 0.75;
  if (age <= 34) return 0.55;
  return 0.4;
}

export function valueEstimate(overall: number, age: number): number {
  return Math.round(50000 * Math.pow(1.16, overall - 40) * ageMultiplier(age));
}

export function formatValueEstimate(euros: number): string {
  if (euros >= 1000000) return `€${(euros / 1000000).toFixed(1)}m`;
  if (euros >= 1000) return `€${Math.round(euros / 1000)}k`;
  return `€${Math.round(euros)}`;
}

export interface RatingInput {
  /** Stable player id (pack id for real players). Seeds the signature. */
  id: string;
  role: Role;
  /** Age at the snapshot. */
  age: number;
  /** League context modifier (leagueModFor). Snapshot-anchored. */
  leagueMod: number;
  /**
   * Club context modifier (club-strength table). Snapshot-anchored:
   * this is the modifier of the club the player belonged to at the
   * snapshot, NOT necessarily his current club. A future transfer
   * changes clubId but must keep passing the snapshot modifier here,
   * so development stays consistent across transfers and loans.
   */
  clubMod: number;
  /** Seasons elapsed since the snapshot (career season − 1). */
  seasonsElapsed: number;
  /**
   * Reserved individual-evidence adjustment (goals, assists,
   * appearances, minutes, clean sheets). Absent today: pass nothing
   * and the term is 0. When a future pack carries stats, they adjust
   * the prime profile here without changing the formula's shape.
   */
  evidenceAdjustment?: Partial<Record<keyof Attributes, number>>;
  /**
   * Test/synthetic use only: replaces the seeded development rate.
   * Production callers never pass this; real rates always come from
   * the player id hash.
   */
  developmentRateOverride?: number;
}

function roundAttrs(attrs: Record<keyof Attributes, number>): Attributes {
  return {
    pace: Math.round(attrs.pace),
    shooting: Math.round(attrs.shooting),
    passing: Math.round(attrs.passing),
    dribbling: Math.round(attrs.dribbling),
    defending: Math.round(attrs.defending),
    physical: Math.round(attrs.physical),
    goalkeeping: Math.round(attrs.goalkeeping),
    tactical: Math.round(attrs.tactical),
  };
}

/**
 * Compute a player's full D4 profile. Pure and deterministic.
 *
 * Prime = template + signature + league + club (+ evidence when
 * present). Snapshot current = prime × per-attribute age factor.
 * Potential = prime + ceiling bonus while the attribute is still
 * growing, else current. Then seasonsElapsed season steps are
 * simulated with floats internally (so sub-point tactical decline is
 * not rounded away) and rounded only at the end.
 */
export function computeRating(input: RatingInput): RatedProfile {
  const tpl = TEMPLATES[input.role];
  const rng = createRng(hashId(input.id));
  // Signature draw sequence. Order matters: changing it changes every
  // rating, so it is frozen with the model version.
  const devs = {} as Record<keyof Attributes, number>;
  for (const a of ATTR_ORDER) devs[a] = Math.round((rng() * 2 - 1) * 6);
  const strength = ATTR_ORDER[Math.floor(rng() * ATTR_ORDER.length)];
  let weakness = ATTR_ORDER[Math.floor(rng() * ATTR_ORDER.length)];
  if (weakness === strength) weakness = ATTR_ORDER[(ATTR_ORDER.indexOf(strength) + 3) % ATTR_ORDER.length];
  devs[strength] += 5 + Math.floor(rng() * 5);
  devs[weakness] -= 5 + Math.floor(rng() * 5);
  const bonus = {} as Record<keyof Attributes, number>;
  for (const a of ATTR_ORDER) bonus[a] = Math.floor(rng() * 9);
  const rate = input.developmentRateOverride ?? 0.7 + rng() * 0.6;

  const prime = {} as Record<keyof Attributes, number>;
  const snapshotCurrent = {} as Record<keyof Attributes, number>;
  const potential = {} as Record<keyof Attributes, number>;
  for (const a of ATTR_ORDER) {
    prime[a] = clamp(
      tpl[a] + devs[a] + input.leagueMod + input.clubMod + (input.evidenceAdjustment?.[a] ?? 0),
      1,
      99,
    );
    snapshotCurrent[a] = clamp(Math.round(prime[a] * ageFactor(a, input.age)), 1, 99);
    potential[a] =
      input.age < CURVES[a].start ? clamp(prime[a] + bonus[a], 1, 99) : snapshotCurrent[a];
  }

  // Season simulation with floats internally.
  const cur = { ...snapshotCurrent } as Record<keyof Attributes, number>;
  let age = input.age;
  for (let s = 0; s < input.seasonsElapsed; s += 1) {
    const nextAge = age + 1;
    for (const a of ATTR_ORDER) {
      const c = CURVES[a];
      if (nextAge <= c.start) {
        const frac = clamp(0.2 * rate * (nextAge <= 19 ? 1.25 : 1.0), 0.1, 0.4);
        cur[a] = clamp(cur[a] + (potential[a] - cur[a]) * frac, 1, 99);
      } else if (nextAge > c.end) {
        cur[a] = clamp(cur[a] - c.declinePts, 1, 99);
      }
      // Plateau (start < age <= end): no change; potential = current.
    }
    age = nextAge;
  }

  const attributes = roundAttrs(cur);
  const potentialAttributes = roundAttrs(
    Object.fromEntries(ATTR_ORDER.map((a) => [a, potential[a]])) as Record<keyof Attributes, number>,
  );
  const overall = overallForRole(input.role, attributes);
  const potentialOverall = overallForRole(input.role, potentialAttributes);
  return {
    role: input.role,
    age: input.age,
    currentAge: age,
    attributes,
    potentialAttributes,
    overall,
    potential: potentialOverall,
    developmentRate: rate,
    developmentBand: developmentBand(rate),
    tier: tierFor(overall),
    valueEstimate: valueEstimate(overall, age),
    modelVersion: RATING_MODEL_VERSION,
    basis: RATING_BASIS,
    evidence: RATING_EVIDENCE,
  };
}

/** One club-strength table entry (built from 2024–25 results). */
export interface ClubStrengthEntry {
  clubId: string;
  modifier: number;
  points: number;
  goalDifference: number;
  rank: number;
  teams: number;
}

export interface ClubStrength {
  packVersion: string;
  season: string;
  entries: ClubStrengthEntry[];
}

/** Modifier for a club, or 0 when the club has no 2024–25 results. */
export function clubModFor(strength: ClubStrength | null, clubId: string): number {
  if (!strength) return 0;
  return strength.entries.find((e) => e.clubId === clubId)?.modifier ?? 0;
}

/**
 * Safely load a club-strength table. Malformed entries are dropped;
 * garbage returns null. Never throws.
 */
export function loadClubStrength(input: unknown): ClubStrength | null {
  try {
    if (!input || typeof input !== 'object') return null;
    const obj = input as { packVersion?: unknown; season?: unknown; entries?: unknown };
    if (typeof obj.packVersion !== 'string' || !Array.isArray(obj.entries)) return null;
    const entries: ClubStrengthEntry[] = [];
    for (const e of obj.entries as unknown[]) {
      if (!e || typeof e !== 'object') continue;
      const entry = e as Record<string, unknown>;
      if (
        typeof entry.clubId !== 'string' ||
        typeof entry.modifier !== 'number' ||
        typeof entry.points !== 'number' ||
        typeof entry.goalDifference !== 'number' ||
        typeof entry.rank !== 'number' ||
        typeof entry.teams !== 'number'
      ) {
        continue;
      }
      entries.push({
        clubId: entry.clubId,
        modifier: entry.modifier,
        points: entry.points,
        goalDifference: entry.goalDifference,
        rank: entry.rank,
        teams: entry.teams,
      });
    }
    return {
      packVersion: obj.packVersion,
      season: typeof obj.season === 'string' ? obj.season : '2024-25',
      entries,
    };
  } catch {
    return null;
  }
}
