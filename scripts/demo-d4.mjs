/**
 * D4 demonstration output for the report (not a pass/fail test):
 * multi-season trajectories for named players, and a deterministic
 * match-outcome batch showing that ageing and tactical awareness move
 * results. Run after compiling the core.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const OUT = process.argv[2] || '/tmp/fm-core';
const require = createRequire(import.meta.url);
const R = require(`${OUT}/ratings.js`);
const L = require(`${OUT}/data-pack-loader.js`);
const E = require(`${OUT}/engine.js`);
const pack = JSON.parse(readFileSync('data-packs/v1/data-pack.json', 'utf8'));
const strength = R.loadClubStrength(JSON.parse(readFileSync('data-packs/v1/club-strength.json', 'utf8')));

function ratingOf(name, seasons) {
  const p = pack.players.find((x) => x.name === name);
  const league = pack.leagues.find((l) => l.id === pack.clubs.find((c) => c.id === p.clubId).leagueId);
  return R.computeRating({
    id: p.id,
    role: R.roleOf(p.position),
    age: L.ageAt(pack.snapshotDate, p.dateOfBirth),
    leagueMod: R.leagueModFor(league.name),
    clubMod: R.clubModFor(strength, p.clubId),
    seasonsElapsed: seasons,
  });
}

console.log('--- Multi-season trajectories (overall, pace, tactical) ---');
for (const name of ['Bukayo Saka', 'William Saliba', 'Alisson Becker', 'Honest Ahanor', 'Kennet Eichhorn', 'Mario Götze']) {
  const row = [];
  for (const s of [0, 1, 3, 5]) {
    const r = ratingOf(name, s);
    row.push(`+${s}s: ${r.overall} (PAC ${r.attributes.pace}, TAC ${r.attributes.tactical})`);
  }
  console.log(`${name}: ${row.join(' | ')}`);
}

console.log('\n--- Match batch: synthetic pace-heavy XI, young vs aged 5 seasons ---');
function xiFromRatings(seasons) {
  // Same 11 ids at 0 and 5 seasons: only ageing differs.
  const roles = ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'AM', 'W', 'W', 'ST'];
  return roles.map((role, i) => {
    const r = R.computeRating({ id: `demo-xi-${i}`, role, age: 24, leagueMod: 0, clubMod: 0, seasonsElapsed: seasons });
    return {
      id: `demo-${i}`, firstName: 'Demo', lastName: `${i}`, age: 24 + seasons,
      position: R.positionGroup(role), role, attributes: r.attributes,
      overall: r.overall, potential: r.potential, clubId: 'demo',
    };
  });
}
function fixedOpponent() {
  const roles = ['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'AM', 'W', 'W', 'ST'];
  return roles.map((role, i) => {
    const r = R.computeRating({ id: `demo-opp-${i}`, role, age: 27, leagueMod: 0, clubMod: 0, seasonsElapsed: 0 });
    return {
      id: `opp-${i}`, firstName: 'Opp', lastName: `${i}`, age: 27,
      position: R.positionGroup(role), role, attributes: r.attributes,
      overall: r.overall, potential: r.potential, clubId: 'opp',
    };
  });
}
function batch(homePlayers, awayPlayers, n) {
  const league = {
    clubs: [
      { id: 'demo', name: 'Demo', shortName: 'DEM', primaryColor: '#000', funds: 0 },
      { id: 'opp', name: 'Opp', shortName: 'OPP', primaryColor: '#000', funds: 0 },
    ],
    players: [...homePlayers, ...awayPlayers],
  };
  let hg = 0;
  let ag = 0;
  let wins = 0;
  for (let s = 1; s <= n; s += 1) {
    const r = E.simulateMatch(league, 'demo', 'opp', s);
    hg += r.homeGoals;
    ag += r.awayGoals;
    if (r.homeGoals > r.awayGoals) wins += 1;
  }
  return { homeGoals: (hg / n).toFixed(2), awayGoals: (ag / n).toFixed(2), winPct: ((wins / n) * 100).toFixed(1) };
}
const opp = fixedOpponent();
console.log('young XI:', JSON.stringify(batch(xiFromRatings(0), opp, 1000)));
console.log('aged 5 seasons:', JSON.stringify(batch(xiFromRatings(5), opp, 1000)));

console.log('\n--- Match batch: same XI, defenders tactical -10 vs +10 ---');
function tacXI(delta) {
  return xiFromRatings(0).map((p) => {
    if (p.position === 'DF' || p.position === 'GK') {
      return { ...p, attributes: { ...p.attributes, tactical: Math.max(1, Math.min(99, p.attributes.tactical + delta)) } };
    }
    return p;
  });
}
console.log('tactical -10:', JSON.stringify(batch(tacXI(-10), opp, 1000)));
console.log('tactical +10:', JSON.stringify(batch(tacXI(10), opp, 1000)));
