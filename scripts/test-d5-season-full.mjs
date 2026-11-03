#!/usr/bin/env node
/**
 * D5 full-season integration test (pure core + engine, no SQLite):
 * adapts the real Premier League from the v1 pack, generates a
 * season, simulates all 38 rounds round-by-round exactly as
 * Continue does (fixture seeds, one round at a time), and checks
 * round progression, replay prevention, table totals, the complete
 * terminal state, rollover record construction, recent-results
 * capping, and the 20-season size bound.
 * Run after compiling the game core (see test-d5-season.mjs).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const OUT = process.argv[2] || '/tmp/fm-core';
const packPath = process.argv[3] || 'data-packs/v1/data-pack.json';
const require = createRequire(import.meta.url);
const season = require(join(resolve(OUT), 'season.js'));
const membership = require(join(resolve(OUT), 'season-membership.js'));
const loader = require(join(resolve(OUT), 'data-pack-loader.js'));
const engine = require(join(resolve(OUT), 'engine.js'));

let passed = 0; let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name} ${detail}`); }
}

const pack = JSON.parse(readFileSync(resolve(packPath), 'utf8'));
const loaded = loader.loadDataPack(pack);
if (!loaded.ok) { console.log('FAIL pack did not load'); process.exit(1); }
const strength = JSON.parse(readFileSync(resolve('data-packs/v1/club-strength.json'), 'utf8'));
// adaptPackToLeague expects a ClubStrength object or null; the
// loader's loadClubStrength validates the table, so use it when present.
let strengthObj = null;
try { strengthObj = require(join(resolve(OUT), 'ratings.js')).loadClubStrength(strength); } catch { strengthObj = null; }
const adapted = loader.adaptPackToLeague(pack, 'wd:Q9448', strengthObj, 0);
check('adapted PL has 33 clubs (full league, season uses 20 members)', adapted.clubs.length === 33);
const members = membership.membershipFor('wd:Q9448');
const userClub = 'wd:Q9617'; // Arsenal
let fixtures = season.generateFixtures(members, 12345, 'wd:Q9448', 1);
const clubsById = new Map(adapted.clubs.filter((c) => members.includes(c.id)).map((c) => [c.id, c.name]));
let recent = [];
const total = season.totalRounds(fixtures);
check('full season total rounds is 38', total === 38);
for (let round = 1; round <= total; round += 1) {
  // Replay guard: the round must be fully unplayed before simulating.
  const roundFx = season.roundFixtures(fixtures, round);
  if (roundFx.some((f) => f.result)) { check(`round ${round} replay guard`, false); break; }
  fixtures = fixtures.map((f) => {
    if (f.round !== round) return f;
    const result = engine.simulateMatch(adapted, f.homeClubId, f.awayClubId, season.fixtureSeed(12345, 'wd:Q9448', 1, round, f.homeClubId, f.awayClubId));
    return { ...f, result };
  });
  const userFx = fixtures.find((f) => f.round === round && (f.homeClubId === userClub || f.awayClubId === userClub));
  if (userFx?.result) recent.push({ season: 1, round, result: userFx.result });
  recent = recent.slice(-10);
}
const table = season.tableFor(fixtures, clubsById);
const totalGoals = table.reduce((s, r) => s + r.goalsFor, 0);
const totalPoints = table.reduce((s, r) => s + r.points, 0);
const playedSum = table.reduce((s, r) => s + r.played, 0);
check('all 380 fixtures played', fixtures.every((f) => f.result));
check('every club played 38', table.every((r) => r.played === 38), JSON.stringify(table.filter((r) => r.played !== 38)));
check('table played sum is 760 (380 x 2)', playedSum === 760, `got ${playedSum}`);
check('table goals balance (for == against)', table.reduce((s, r) => s + r.goalsFor, 0) === table.reduce((s, r) => s + r.goalsAgainst, 0));
check('table points are within draw/win bounds', totalPoints >= 760 && totalPoints <= 1140, `got ${totalPoints}`);
check('champion is table leader with most points', season.championOf(table) === table[0].clubId);
check('recent results capped at 10 after 38 rounds', recent.length === 10 && recent[0].round === 29 && recent[9].round === 38);
const terminal = { leagueId: 'wd:Q9448', membershipVersion: 'd5-membership-v1', fixtures, currentRound: total + 1, status: 'complete', championClubId: season.championOf(table) };
check('terminal state validates', season.validateSeasonData(terminal, 'd5-membership-v1').length === 0);
// Rollover record + next season, mirroring the store's rollover.
const userRow = table.find((r) => r.clubId === userClub);
const record = { season: 1, leagueId: 'wd:Q9448', membershipVersion: 'd5-membership-v1', championClubId: season.championOf(table), userClubId: userClub, userPosition: userRow.position, userRecord: { played: userRow.played, won: userRow.won, drawn: userRow.drawn, lost: userRow.lost, goalsFor: userRow.goalsFor, goalsAgainst: userRow.goalsAgainst, goalDifference: userRow.goalDifference, points: userRow.points }, finalTable: table, totalRounds: total };
const nextFixtures = season.generateFixtures(members, 12345, 'wd:Q9448', 2);
check('next season fixtures regenerate (380, round 1 unplayed)', nextFixtures.length === 380 && nextFixtures.filter((f) => f.round === 1).every((f) => !f.result));
check('next season table starts at zero', season.tableFor(nextFixtures, clubsById).every((r) => r.played === 0));
// Size bound: current season + recent + 20 season records.
const size = JSON.stringify({ fixtures, recent, past: Array(20).fill(record) }).length;
check('size bound under 250 KB after 20 seasons (simulated)', size < 250 * 1024, `${size} bytes`);
check('one season record is compact (under 5 KB)', JSON.stringify(record).length < 5 * 1024, `${JSON.stringify(record).length} bytes`);
console.log(`Champion: ${clubsById.get(season.championOf(table))}, total goals: ${totalGoals}, Arsenal position: ${userRow.position}, points: ${userRow.points}`);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
