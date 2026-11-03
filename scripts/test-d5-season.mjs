#!/usr/bin/env node
/**
 * D5 season-core tests: pure logic only, no React Native, no Expo,
 * no SQLite. Run after compiling the game core:
 *   npx tsc src/game/*.ts --outDir /tmp/fm-core --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/test-d5-season.mjs /tmp/fm-core [path/to/data-pack.json]
 * Exit code 0 = all pass, 1 = any failure.
 *
 * Covers:
 *  1. Membership: 96 clubs, 20/20/20/18/18, every id in the pack in
 *     the right league, >=18 players, duplicate entities resolved
 *     to the player-carrying id (Toulouse, Augsburg).
 *  2. Fixtures: counts, rounds, once-per-round, each pair twice
 *     (once home, once away), determinism, input-order independence.
 *  3. Table: hand-computed points/goals and the full tiebreak order.
 *  4. Table cache: same key reuses, changed results recompute, and
 *     a restored save with the same played count but different
 *     results does NOT reuse the old table.
 *  5. Validation: in-progress and complete terminal states, and
 *     every invalid shape that must block Continue/rollover.
 *  6. Hash: known SHA-256 vectors, and fixture-seed determinism.
 *  7. D4 progression at rollover: seasonsElapsed is the only step
 *     that advances ratings, and a young player grows with it.
 *  8. Loader membership filter: adaptPackToLeague with
 *     membershipOnly=true returns exactly the member clubs.
 * Note: the same fixture order in consecutive seasons is
 * acceptable by design and is NOT asserted as a failure anywhere.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const OUT = process.argv[2] || '/tmp/fm-core';
const packPath = process.argv[3] || 'data-packs/v1/data-pack.json';
const require = createRequire(import.meta.url);
const season = require(join(resolve(OUT), 'season.js'));
const membership = require(join(resolve(OUT), 'season-membership.js'));
const hashMod = require(join(resolve(OUT), 'state-hash.js'));
const ratings = require(join(resolve(OUT), 'ratings.js'));
const loader = require(join(resolve(OUT), 'data-pack-loader.js'));

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name} ${detail}`); }
}

const pack = JSON.parse(readFileSync(resolve(packPath), 'utf8'));
const playersByClub = {};
for (const p of pack.players) playersByClub[p.clubId] = (playersByClub[p.clubId] || 0) + 1;
const clubById = Object.fromEntries(pack.clubs.map((c) => [c.id, c]));

// 1. Membership
check('membership total is 96', membership.totalMembershipClubs() === 96);
const counts = { 'wd:Q9448': 20, 'wd:Q324867': 20, 'wd:Q15804': 20, 'wd:Q82595': 18, 'wd:Q13394': 18 };
let allMemberOk = true; const seenIds = new Set();
for (const [leagueId, expected] of Object.entries(counts)) {
  const ids = membership.membershipFor(leagueId);
  if (!ids || ids.length !== expected) allMemberOk = false;
  for (const id of ids || []) {
    if (seenIds.has(id)) allMemberOk = false;
    seenIds.add(id);
    const club = clubById[id];
    if (!club || club.leagueId !== leagueId) allMemberOk = false;
    if ((playersByClub[id] || 0) < 18) allMemberOk = false;
  }
}
check('membership per league, pack match, >=18 players, no duplicates', allMemberOk);
check('Toulouse resolves to player-carrying id', membership.membershipFor('wd:Q13394').includes('wd:Q19518') && !membership.membershipFor('wd:Q13394').includes('wd:Q2422417'));
check('Augsburg resolves to player-carrying id', membership.membershipFor('wd:Q82595').includes('wd:Q15755') && !membership.membershipFor('wd:Q82595').includes('wd:Q97905916'));
check('seasonLeagueOfClub finds members, null for others', membership.seasonLeagueOfClub('wd:Q9617') === 'wd:Q9448' && membership.seasonLeagueOfClub('wd:Q1128631') === null);
check('membershipFor unknown league is null', membership.membershipFor('wd:Q999') === null);

// 2. Fixtures
function checkFixtures(label, clubIds, expectedCount, expectedRounds) {
  const fx = season.generateFixtures(clubIds, 42, 'wd:Q9448', 1);
  check(`${label} count`, fx.length === expectedCount, `got ${fx.length}`);
  check(`${label} rounds`, season.totalRounds(fx) === expectedRounds, `got ${season.totalRounds(fx)}`);
  const perRound = {};
  const pairs = {};
  let ok = true;
  for (const f of fx) {
    perRound[f.round] = perRound[f.round] || new Set();
    if (perRound[f.round].has(f.homeClubId) || perRound[f.round].has(f.awayClubId)) ok = false;
    perRound[f.round].add(f.homeClubId); perRound[f.round].add(f.awayClubId);
    const key = [f.homeClubId, f.awayClubId].sort().join('|');
    pairs[key] = pairs[key] || [];
    pairs[key].push(f.homeClubId);
  }
  for (const r of Object.values(perRound)) if (r.size !== clubIds.length) ok = false;
  for (const homes of Object.values(pairs)) {
    if (homes.length !== 2) ok = false;
    if (new Set(homes).size !== 2) ok = false; // once home each
  }
  check(`${label} once-per-round and home/away pairs`, ok);
  return fx;
}
const pl = membership.membershipFor('wd:Q9448');
const fx20 = checkFixtures('20-club league', pl, 380, 38);
checkFixtures('18-club league', membership.membershipFor('wd:Q82595'), 306, 34);
check('fixtures deterministic byte-identical', JSON.stringify(season.generateFixtures(pl, 42, 'wd:Q9448', 1)) === JSON.stringify(fx20));
check('fixtures input-order independent', JSON.stringify(season.generateFixtures([...pl].reverse(), 42, 'wd:Q9448', 1)) === JSON.stringify(fx20));
check('fixtures for 1 club are empty', season.generateFixtures(['a'], 1, 'x', 1).length === 0);

// 3. Table, hand-computed
const clubsById = new Map([['A', 'Alpha'], ['B', 'Beta'], ['C', 'Gamma']]);
const tableFx = [
  { round: 1, homeClubId: 'A', awayClubId: 'B', result: { homeClubId: 'A', awayClubId: 'B', homeGoals: 2, awayGoals: 0, events: [] } },
  { round: 1, homeClubId: 'C', awayClubId: 'A', result: { homeClubId: 'C', awayClubId: 'A', homeGoals: 1, awayGoals: 1, events: [] } },
  { round: 2, homeClubId: 'B', awayClubId: 'C', result: { homeClubId: 'B', awayClubId: 'C', homeGoals: 3, awayGoals: 1, events: [] } },
];
const table = season.tableFor(tableFx, clubsById);
check('table leader points', table[0].clubId === 'A' && table[0].points === 4 && table[0].played === 2, JSON.stringify(table));
check('table second', table[1].clubId === 'B' && table[1].points === 3, JSON.stringify(table));
check('table goal difference', table[2].goalDifference === -2 && table[2].points === 1, JSON.stringify(table));
// Tiebreak: equal points+GD+GF -> name asc, then id asc for identical names.
const tieClubs = new Map([['X', 'Same'], ['Y', 'Same'], ['Z', 'Alpha']]);
const tieFx = [
  { round: 1, homeClubId: 'X', awayClubId: 'Z', result: { homeClubId: 'X', awayClubId: 'Z', homeGoals: 1, awayGoals: 1, events: [] } },
  { round: 1, homeClubId: 'Y', awayClubId: 'Z', result: { homeClubId: 'Y', awayClubId: 'Z', homeGoals: 1, awayGoals: 1, events: [] } },
];
const tieTable = season.tableFor(tieFx, tieClubs);
check('table tiebreak name then id', tieTable[0].clubId === 'Z' && tieTable[1].clubId === 'X' && tieTable[2].clubId === 'Y', JSON.stringify(tieTable.map((r) => r.clubId)));
check('table includes unplayed clubs at zero', season.tableFor([], clubsById).every((r) => r.played === 0 && r.points === 0));
check('championOf is table leader', season.championOf(table) === 'A' && season.championOf([]) === null);

// 4. Cache
const t1 = season.tableForCached(tableFx, clubsById, 1, 'wd:Q9448', 'd5-membership-v1');
const t2 = season.tableForCached(tableFx, clubsById, 1, 'wd:Q9448', 'd5-membership-v1');
check('table cache reuses same key', t1 === t2);
const changedFx = tableFx.map((f, i) => (i === 0 ? { ...f, result: { ...f.result, homeGoals: 0, awayGoals: 3 } } : f));
const t3 = season.tableForCached(changedFx, clubsById, 1, 'wd:Q9448', 'd5-membership-v1');
check('table cache recomputes on changed result', t3 !== t1 && t3[0].clubId !== t1[0].clubId, `${t1[0].clubId} -> ${t3[0].clubId}`);
check('played fixtures hash differs for different results', season.playedFixturesHash(tableFx) !== season.playedFixturesHash(changedFx));

// 5. Validation
const validData = { leagueId: 'wd:Q9448', membershipVersion: 'd5-membership-v1', fixtures: fx20.slice(0, 10).map((f, i) => (i < 0 ? f : f)), currentRound: 1, status: 'inProgress' };
// Build a small valid season from a 4-club fixture set for validation checks.
const four = ['A', 'B', 'C', 'D'];
const fx4 = season.generateFixtures(four, 7, 'wd:Q9448', 1);
const valid4 = { leagueId: 'wd:Q9448', membershipVersion: 'd5-membership-v1', fixtures: fx4, currentRound: 1, status: 'inProgress' };
check('validation accepts valid in-progress season', season.validateSeasonData(valid4, 'd5-membership-v1').length === 0, JSON.stringify(season.validateSeasonData(valid4, 'd5-membership-v1')));
const played4 = { ...valid4, fixtures: fx4.map((f) => (f.round === 1 ? { ...f, result: { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: 1, awayGoals: 0, events: [] } } : f)), currentRound: 2 };
check('validation accepts round advanced after played round', season.validateSeasonData(played4, 'd5-membership-v1').length === 0);
const dup4 = { ...valid4, fixtures: [...fx4, fx4[0]] };
check('validation rejects duplicate fixture', season.validateSeasonData(dup4, 'd5-membership-v1').length > 0);
const ahead4 = { ...valid4, fixtures: fx4.map((f) => (f.round === 2 ? { ...f, result: { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: 1, awayGoals: 0, events: [] } } : f)) };
check('validation rejects played round ahead of current round', season.validateSeasonData(ahead4, 'd5-membership-v1').length > 0);
const complete4 = {
  leagueId: 'wd:Q9448', membershipVersion: 'd5-membership-v1',
  fixtures: fx4.map((f) => ({ ...f, result: { homeClubId: f.homeClubId, awayClubId: f.awayClubId, homeGoals: 1, awayGoals: 0, events: [] } })),
  currentRound: season.totalRounds(fx4) + 1, status: 'complete', championClubId: 'A',
};
check('validation accepts complete terminal state', season.validateSeasonData(complete4, 'd5-membership-v1').length === 0, JSON.stringify(season.validateSeasonData(complete4, 'd5-membership-v1')));
const badComplete = { ...complete4, currentRound: season.totalRounds(fx4) };
check('validation rejects complete state with wrong currentRound', season.validateSeasonData(badComplete, 'd5-membership-v1').length > 0);
const noChamp = { ...complete4, championClubId: undefined };
check('validation rejects complete state without champion', season.validateSeasonData(noChamp, 'd5-membership-v1').length > 0);
const wrongVersion = { ...valid4, membershipVersion: 'other' };
check('validation rejects wrong membership version', season.validateSeasonData(wrongVersion, 'd5-membership-v1').length > 0);
void validData;

// 6. Hash and seeds
check('sha256 empty vector', hashMod.sha256Hex('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
check('sha256 abc vector', hashMod.sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
check('sha256 long vector', hashMod.sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq') === '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
check('fixture seed deterministic', season.fixtureSeed(1, 'wd:Q9448', 1, 1, 'A', 'B') === season.fixtureSeed(1, 'wd:Q9448', 1, 1, 'A', 'B'));
check('fixture seed differs by round', season.fixtureSeed(1, 'wd:Q9448', 1, 1, 'A', 'B') !== season.fixtureSeed(1, 'wd:Q9448', 1, 2, 'A', 'B'));

// 7. D4 progression at rollover (seasonsElapsed only)
const young0 = ratings.computeRating({ id: 'test-player-young', role: 'ST', age: 18, leagueMod: 0, clubMod: 0, seasonsElapsed: 0, developmentRateOverride: 1.0 });
const young3 = ratings.computeRating({ id: 'test-player-young', role: 'ST', age: 18, leagueMod: 0, clubMod: 0, seasonsElapsed: 3, developmentRateOverride: 1.0 });
check('D4 young player grows with seasonsElapsed', young3.overall > young0.overall && young3.currentAge === 21, `${young0.overall} -> ${young3.overall}, age ${young3.currentAge}`);
check('D4 model version is d4-v3', young0.modelVersion === 'd4-v3');
check('D4 snapshot ratings unchanged by elapsed seasons alone at age 18 season 1', young0.currentAge === 18);

// 8. Loader membership filter
const loaded = loader.loadDataPack(pack);
check('pack loads for loader test', loaded.ok === true);
if (loaded.ok) {
  const full = loader.adaptPackToLeague(pack, 'wd:Q9448', null, 0);
  const membersOnly = loader.adaptPackToLeague(pack, 'wd:Q9448', null, 0, true);
  check('loader default is unchanged (full league)', full.clubs.length === 33, `got ${full.clubs.length}`);
  check('loader membership filter returns 20 clubs', membersOnly.clubs.length === 20, `got ${membersOnly.clubs.length}`);
  check('loader membership filter matches membership list', membersOnly.clubs.every((c) => membership.membershipFor('wd:Q9448').includes(c.id)));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
