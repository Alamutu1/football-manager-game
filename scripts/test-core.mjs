/**
 * Node tests for the pure game core (no React Native, no Expo).
 * Run after compiling the core:
 *   npx tsc src/game/*.ts --outDir /tmp/fm-core --module commonjs --target es2020 --skipLibCheck
 *   node scripts/test-core.mjs
 * Exit code 0 = all pass, 1 = any failure.
 */
// The compiled output dir is passed as argv[2] or defaults to /tmp/fm-core.
import { createRequire } from 'node:module';

const OUT = process.argv[2] || '/tmp/fm-core';
const require = createRequire(import.meta.url);
const { generateLeague, playersOfClub, bestXI } = require(`${OUT}/seed.js`);
const { simulateMatch } = require(`${OUT}/engine.js`);
const { formatMoney } = require(`${OUT}/format.js`);

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`PASS ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${name} ${detail}`);
  }
}

// 1. Seed determinism: same seed -> identical league.
const leagueA = generateLeague(12345);
const leagueB = generateLeague(12345);
check('seed determinism', JSON.stringify(leagueA) === JSON.stringify(leagueB));

// 2. Different seed -> different league.
const leagueC = generateLeague(999);
check('different seed differs', JSON.stringify(leagueA) !== JSON.stringify(leagueC));

// 3. League shape: 16 clubs, 22 players each, 2 GK / 7 DF / 8 MF / 5 FW.
check('16 clubs', leagueA.clubs.length === 16, `got ${leagueA.clubs.length}`);
let shapeOk = true;
for (const club of leagueA.clubs) {
  const squad = playersOfClub(leagueA, club.id);
  const counts = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const p of squad) counts[p.position] += 1;
  if (squad.length !== 22 || counts.GK !== 2 || counts.DF !== 7 || counts.MF !== 8 || counts.FW !== 5) {
    shapeOk = false;
    console.log(`  shape mismatch at ${club.name}: ${JSON.stringify(counts)} total ${squad.length}`);
  }
}
check('squad shape 2/7/8/5 x22', shapeOk);

// 4. Player value bounds.
let boundsOk = true;
for (const p of leagueA.players) {
  const attrs = Object.values(p.attributes);
  if (
    p.overall < 1 || p.overall > 99 || p.potential < 1 || p.potential > 99 ||
    p.potential < p.overall || p.age < 17 || p.age > 38 ||
    attrs.some((v) => v < 1 || v > 99)
  ) {
    boundsOk = false;
    console.log(`  bounds violation: ${JSON.stringify(p)}`);
    break;
  }
}
check('player bounds (overall/potential/age/attributes)', boundsOk);

// 5. Best XI: 11 players, exactly 1 GK.
const xi = bestXI(leagueA, leagueA.clubs[0].id);
check('best XI is 11 with 1 GK', xi.length === 11 && xi.filter((p) => p.position === 'GK').length === 1);

// 6. Engine determinism.
const r1 = simulateMatch(leagueA, 'club-0', 'club-1', 777);
const r2 = simulateMatch(leagueA, 'club-0', 'club-1', 777);
check('engine determinism', JSON.stringify(r1) === JSON.stringify(r2));

// 7. Event consistency: events == goals, minutes unique in 1..90, scorers belong to the scoring club.
const totalGoals = r1.homeGoals + r1.awayGoals;
const minutes = r1.events.map((e) => e.minute);
let eventsOk =
  r1.events.length === totalGoals &&
  minutes.every((m) => m >= 1 && m <= 90) &&
  new Set(minutes).size === minutes.length &&
  r1.events.every((e) => {
    const scorer = leagueA.players.find((p) => p.id === e.scorerId);
    return scorer && scorer.clubId === e.clubId;
  });
check('event consistency', eventsOk, JSON.stringify(r1));

// 8. Sanity over many matches: goals finite, non-negative, plausible average.
let goalsSum = 0;
let sane = true;
for (let s = 0; s < 50; s += 1) {
  const r = simulateMatch(leagueA, 'club-0', 'club-15', 1000 + s);
  if (!Number.isFinite(r.homeGoals) || !Number.isFinite(r.awayGoals) || r.homeGoals < 0 || r.awayGoals < 0) sane = false;
  goalsSum += r.homeGoals + r.awayGoals;
}
const avg = goalsSum / 50;
check('50-match goal sanity (avg 0.5-6)', sane && avg >= 0.5 && avg <= 6, `avg=${avg.toFixed(2)}`);

// 9. Money formatting.
check('formatMoney', formatMoney(42000000) === '$42.0M' && formatMoney(850000) === '$850K' && formatMoney(500) === '$500');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
