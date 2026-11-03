import { bell, chance, clamp, createRng, int, pick } from './rng';
import { overallFor } from './ratings';
import { CLUB_SEEDS, FIRST_NAMES, LAST_NAMES } from './names';
import type { Attributes, Club, League, Player, Position } from './types';

/** Squad shape every club is generated with: 2 GK, 7 DF, 8 MF, 5 FW. */
const SQUAD_SHAPE: { position: Position; count: number }[] = [
  { position: 'GK', count: 2 },
  { position: 'DF', count: 7 },
  { position: 'MF', count: 8 },
  { position: 'FW', count: 5 },
];

function generateAttributes(
  rng: ReturnType<typeof createRng>,
  position: Position,
  strength: number,
): Attributes {
  // Key attributes for the position sit near club strength; the rest sit lower.
  const key = (spread: number) => clamp(bell(rng, strength - spread, strength + spread), 1, 99);
  const off = (spread: number) => clamp(bell(rng, strength - 18 - spread, strength - 6 + spread), 1, 99);
  if (position === 'GK') {
    return {
      pace: off(4), shooting: off(6), passing: key(8), dribbling: off(6),
      defending: off(4), physical: key(8), goalkeeping: key(6), tactical: key(8),
    };
  }
  if (position === 'DF') {
    return {
      pace: key(8), shooting: off(4), passing: key(8), dribbling: off(4),
      defending: key(6), physical: key(6), goalkeeping: 20, tactical: key(8),
    };
  }
  if (position === 'MF') {
    return {
      pace: key(8), shooting: key(10), passing: key(6), dribbling: key(8),
      defending: off(4), physical: key(8), goalkeeping: 20, tactical: key(6),
    };
  }
  return {
    pace: key(6), shooting: key(6), passing: off(4), dribbling: key(8),
    defending: off(6), physical: key(8), goalkeeping: 20, tactical: off(4),
  };
}

function generatePlayer(
  rng: ReturnType<typeof createRng>,
  clubId: string,
  clubIndex: number,
  slot: number,
  position: Position,
  strength: number,
): Player {
  const veteran = chance(rng, 0.22);
  const wonderkid = chance(rng, 0.15);
  const age = veteran ? int(rng, 30, 38) : wonderkid ? int(rng, 17, 20) : int(rng, 21, 29);
  const attributes = generateAttributes(rng, position, strength);
  const overall = overallFor(position, attributes);
  // Young players have headroom; veterans are what they are.
  const headroom = wonderkid ? int(rng, 8, 20) : veteran ? int(rng, 0, 2) : int(rng, 2, 10);
  // Fictional players keep the Phase 0 bell-curve generation (this is
  // the test path, not the shipped experience); D4 only adds the
  // detailed role (central default per bucket) and the tactical
  // attribute. Real-pack players get the full D4 model in the loader.
  // developmentRate stays unset for fictional players: the UI shows
  // no development band for them.
  const role = position === 'GK' ? 'GK' : position === 'DF' ? 'CB' : position === 'MF' ? 'CM' : 'ST';
  return {
    id: `p-${clubIndex}-${slot}`,
    firstName: pick(rng, FIRST_NAMES),
    lastName: pick(rng, LAST_NAMES),
    age,
    position,
    role,
    attributes,
    overall,
    potential: clamp(overall + headroom, 1, 99),
    clubId,
  };
}

/**
 * Generate the whole fictional league from one seed.
 * Same seed in, same clubs, same players, same ratings out — always.
 * That is what lets a save store just a number instead of a world.
 */
export function generateLeague(seed: number): League {
  const rng = createRng(seed);
  const clubs: Club[] = CLUB_SEEDS.map((c, i) => ({
    id: `club-${i}`,
    name: c.name,
    shortName: c.shortName,
    primaryColor: c.primaryColor,
    funds: c.funds,
  }));
  const players: Player[] = [];
  clubs.forEach((club, clubIndex) => {
    const strength = CLUB_SEEDS[clubIndex].strength;
    let slot = 0;
    for (const { position, count } of SQUAD_SHAPE) {
      for (let n = 0; n < count; n += 1) {
        players.push(generatePlayer(rng, club.id, clubIndex, slot, position, strength));
        slot += 1;
      }
    }
  });
  return { clubs, players };
}

export function playersOfClub(league: League, clubId: string): Player[] {
  return league.players.filter((p) => p.clubId === clubId);
}

/** Best XI by overall, in a 4-4-2 shape, for v0 match simulation. */
export function bestXI(league: League, clubId: string): Player[] {
  const squad = playersOfClub(league, clubId);
  const byPos = (pos: Position) =>
    squad.filter((p) => p.position === pos).sort((a, b) => b.overall - a.overall);
  const xi = [
    ...byPos('GK').slice(0, 1),
    ...byPos('DF').slice(0, 4),
    ...byPos('MF').slice(0, 4),
    ...byPos('FW').slice(0, 2),
  ];
  return xi;
}

/** Mean overall of a team's XI. Used for quick strength display. */
export function teamRating(xi: Player[]): number {
  if (xi.length === 0) return 0;
  return Math.round(xi.reduce((sum, p) => sum + p.overall, 0) / xi.length);
}
