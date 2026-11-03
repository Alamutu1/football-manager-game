import { createRng, int } from './rng';
import type { GoalEvent, League, MatchResult, Player } from './types';
import { bestXI } from './seed';

/**
 * Match engine, v0.
 *
 * What it does: takes each side's best XI, turns attack vs defence into
 * expected goals, samples actual goals from a Poisson distribution, and
 * picks scorers weighted by shooting. The result is deterministic for a
 * given seed, so the same fixture can be replayed and verified.
 * Since D4, defensive strength blends in tactical awareness (85/15),
 * so D4 development and ageing move match outcomes; attack still runs
 * on shooting and pace, so pace decline directly weakens attack.
 *
 * What it does NOT do yet (roadmap Phase 3): minute-by-minute play,
 * formations and tactics, stamina and substitutions, injuries in-match,
 * home crowd effects beyond the small home edge, or individual
 * chance-by-chance commentary. Those arrive as separate, tested modules
 * behind this same `simulateMatch` signature.
 */

function poisson(rng: () => number, lambda: number): number {
  // Knuth's algorithm. Fine for football lambdas (roughly 0-4).
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > limit);
  return k - 1;
}

/** Exported for D4 tests: mean shooting+pace of attackers, halved. */
export function attackOf(xi: Player[]): number {
  const attackers = xi.filter((p) => p.position === 'FW' || p.position === 'MF');
  const base = attackers.reduce((sum, p) => sum + p.attributes.shooting + p.attributes.pace, 0);
  return base / Math.max(1, attackers.length * 2);
}

/** Exported for D4 tests: mean blended defensive strength. */
export function defenceOf(xi: Player[]): number {
  const defenders = xi.filter((p) => p.position === 'DF' || p.position === 'GK');
  // D4: tactical awareness blends into defensive strength (85/15),
  // so tactical development now matters in matches, and the blend
  // keeps the v0 xG baselines intact (typical defence still ~70).
  const base = defenders.reduce(
    (sum, p) =>
      sum +
      (p.position === 'GK'
        ? 0.85 * p.attributes.goalkeeping + 0.15 * p.attributes.tactical
        : 0.85 * p.attributes.defending + 0.15 * p.attributes.tactical),
    0,
  );
  return base / Math.max(1, defenders.length);
}

function pickScorer(rng: () => number, xi: Player[]): Player {
  // Forwards score most, midfielders sometimes, defenders rarely.
  const weights: { player: Player; weight: number }[] = xi.map((p) => ({
    player: p,
    weight:
      (p.position === 'FW' ? 5 : p.position === 'MF' ? 2 : p.position === 'DF' ? 0.5 : 0.05) *
      (p.attributes.shooting / 50),
  }));
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.player;
  }
  return weights[weights.length - 1].player;
}

export function simulateMatch(
  league: League,
  homeClubId: string,
  awayClubId: string,
  seed: number,
): MatchResult {
  const rng = createRng(seed);
  const homeXI = bestXI(league, homeClubId);
  const awayXI = bestXI(league, awayClubId);

  const homeAttack = attackOf(homeXI);
  const awayAttack = attackOf(awayXI);
  const homeDefence = defenceOf(homeXI);
  const awayDefence = defenceOf(awayXI);

  // Expected goals: ~1.35 for an evenly matched side, scaled by attack
  // advantage and defensive weakness, with a small home edge.
  const homeXg = 1.35 * Math.pow(homeAttack / 70, 1.2) * Math.pow(70 / Math.max(20, awayDefence), 0.8) * 1.12;
  const awayXg = 1.35 * Math.pow(awayAttack / 70, 1.2) * Math.pow(70 / Math.max(20, homeDefence), 0.8);

  const homeGoals = poisson(rng, homeXg);
  const awayGoals = poisson(rng, awayXg);

  const events: GoalEvent[] = [];
  const usedMinutes = new Set<number>();
  const addGoals = (count: number, xi: Player[], clubId: string) => {
    for (let i = 0; i < count; i += 1) {
      let minute = int(rng, 1, 90);
      while (usedMinutes.has(minute)) minute = int(rng, 1, 90);
      usedMinutes.add(minute);
      events.push({ minute, scorerId: pickScorer(rng, xi).id, clubId });
    }
  };
  addGoals(homeGoals, homeXI, homeClubId);
  addGoals(awayGoals, awayXI, awayClubId);
  events.sort((a, b) => a.minute - b.minute);

  return { homeClubId, awayClubId, homeGoals, awayGoals, events };
}

export function scorersOf(result: MatchResult, league: League): { minute: number; name: string; clubId: string }[] {
  return result.events.map((e) => {
    const player = league.players.find((p) => p.id === e.scorerId);
    return {
      minute: e.minute,
      name: player ? `${player.firstName} ${player.lastName}` : 'Unknown',
      clubId: e.clubId,
    };
  });
}
