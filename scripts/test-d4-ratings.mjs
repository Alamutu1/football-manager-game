/**
 * Node tests for the D4 rating model (calibration v3, 3 Nov 2026; v2 anchors preserved in ~/workspace/pcm-d4v2-backup-2026-11-03.zip).
 * Run after compiling the core:
 *   npx tsc src/game/*.ts --outDir /tmp/fm-core --module commonjs --target es2020 --skipLibCheck
 *   node scripts/test-d4-ratings.mjs /tmp/fm-core data-packs/v1/data-pack.json \
 *     data-packs/v1/quality.json data-packs/v1/club-strength.json
 * Exit code 0 = all pass, 1 = any failure.
 *
 * Design anchors pinned here: snapshot numbers for named players must
 * match the v3 calibration examples exactly; post-season numbers are
 * asserted as ranges because the shipped overall is computed from
 * rounded attributes while the draft computed it from floats.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const OUT = process.argv[2] || '/tmp/fm-core';
const PACK = process.argv[3] || 'data-packs/v1/data-pack.json';
const QUALITY = process.argv[4] || 'data-packs/v1/quality.json';
const STRENGTH = process.argv[5] || 'data-packs/v1/club-strength.json';
const require = createRequire(import.meta.url);
const R = require(`${OUT}/ratings.js`);
const L = require(`${OUT}/data-pack-loader.js`);
const Q = require(`${OUT}/data-quality.js`);
const E = require(`${OUT}/engine.js`);

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

const pack = JSON.parse(readFileSync(PACK, 'utf8'));
const quality = Q.loadQuality(JSON.parse(readFileSync(QUALITY, 'utf8')));
const strength = R.loadClubStrength(JSON.parse(readFileSync(STRENGTH, 'utf8')));
const loaded = L.loadDataPack(pack);
check('pack loads', loaded.ok === true);

// ---- Fixture-level: curves, roles, bands, tiers, values ----
check(
  'pace falls before goalkeeping (factor at 30)',
  R.ageFactor('pace', 30) < R.ageFactor('goalkeeping', 30),
  `pace ${R.ageFactor('pace', 30)} goalkeeping ${R.ageFactor('goalkeeping', 30)}`,
);
check('pace factor at 30 is 0.92', Math.abs(R.ageFactor('pace', 30) - 0.92) < 1e-9);
check('goalkeeping factor at 30 is 1.00', R.ageFactor('goalkeeping', 30) === 1.0);
check('tactical outlasts pace at 36', R.ageFactor('tactical', 36) > R.ageFactor('pace', 36));

const roleCases = [
  ['goalkeeper', 'GK'],
  ['centre-back', 'CB'],
  ['full-back', 'FB'],
  ['defensive midfielder', 'DM'],
  ['central midfielder', 'CM'],
  ['attacking midfielder', 'AM'],
  ['winger', 'W'],
  ['centre-forward', 'ST'],
  ['defender', 'CB'],
  ['midfielder', 'CM'],
  ['forward', 'ST'],
  ['shooting guard', 'CM'],
];
check(
  'role mapping',
  roleCases.every(([text, want]) => R.roleOf(text) === want),
  roleCases.filter(([text, want]) => R.roleOf(text) !== want).map(([t]) => t).join(','),
);
check('position groups', R.positionGroup('CB') === 'DF' && R.positionGroup('AM') === 'MF' && R.positionGroup('W') === 'FW');
check('tier boundaries', R.tierFor(61) === 'Developing' && R.tierFor(62) === 'Professional' && R.tierFor(74) === 'Professional' && R.tierFor(75) === 'Established' && R.tierFor(82) === 'Established' && R.tierFor(83) === 'Exceptional');
check('development bands', R.developmentBand(0.84) === 'Slow' && R.developmentBand(0.85) === 'Steady' && R.developmentBand(1.15) === 'Steady' && R.developmentBand(1.16) === 'Rapid');
check('value rises with overall, falls with age', R.valueEstimate(80, 25) > R.valueEstimate(70, 25) && R.valueEstimate(75, 25) > R.valueEstimate(75, 35));

// ---- Determinism and estimate metadata ----
const detA = R.computeRating({ id: 'wd:Qxxx', role: 'ST', age: 24, leagueMod: 1, clubMod: 4, seasonsElapsed: 3 });
const detB = R.computeRating({ id: 'wd:Qxxx', role: 'ST', age: 24, leagueMod: 1, clubMod: 4, seasonsElapsed: 3 });
check('determinism (same inputs, identical profile)', JSON.stringify(detA) === JSON.stringify(detB));
check('estimate metadata', detA.modelVersion === 'd4-v3' && detA.basis === 'model-estimate' && detA.evidence.includes('position') && detA.evidence.includes('age') && detA.evidence.includes('club-results-2024-25'));

// ---- Potential discipline ----
let potentialOk = true;
for (const age of [17, 20, 25, 30, 35]) {
  for (const role of ['GK', 'CB', 'CM', 'W', 'ST']) {
    const p0 = R.computeRating({ id: `pot-${role}-${age}`, role, age, leagueMod: 0, clubMod: 0, seasonsElapsed: 0 });
    const p5 = R.computeRating({ id: `pot-${role}-${age}`, role, age, leagueMod: 0, clubMod: 0, seasonsElapsed: 5 });
    for (const a of Object.keys(p0.attributes)) {
      if (p0.potentialAttributes[a] < p0.attributes[a] || p5.potentialAttributes[a] < p5.attributes[a]) potentialOk = false;
    }
  }
}
check('potential >= current, snapshot and after 5 seasons', potentialOk);
const old = R.computeRating({ id: 'old-34', role: 'CB', age: 34, leagueMod: 0, clubMod: 0, seasonsElapsed: 0 });
check(
  'past-prime potential equals current (age 34, all curves ended)',
  Object.keys(old.attributes).every((a) => old.potentialAttributes[a] === old.attributes[a]),
);

// ---- Slow developer stalls below potential (T3) ----
let t3 = null;
for (let i = 0; i < 26; i += 1) {
  const p0 = R.computeRating({ id: `t3-${i}`, role: 'CB', age: 18, leagueMod: 0, clubMod: 0, seasonsElapsed: 0, developmentRateOverride: 0.7 });
  if (p0.potential - p0.overall >= 8) {
    t3 = { id: `t3-${i}`, start: p0 };
    break;
  }
}
let t3Ok = false;
if (t3) {
  t3Ok = true;
  for (let s = 0; s <= 12; s += 1) {
    const p = R.computeRating({ id: t3.id, role: 'CB', age: 18, leagueMod: 0, clubMod: 0, seasonsElapsed: s, developmentRateOverride: 0.7 });
    if (p.overall >= p.potential) t3Ok = false;
  }
}
check('slow developer (0.70) never reaches potential by age 30', t3Ok, t3 ? `gap ${t3.start.potential - t3.start.overall}` : 'no fixture found');

// ---- Real pack: named examples (approved v2) ----
function packPlayer(name, clubName) {
  const club = pack.clubs.find((c) => c.name === clubName);
  return pack.players.find((p) => p.name === name && p.clubId === club.id);
}
function ratingOf(p, seasons = 0) {
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
const saka = ratingOf(packPlayer('Bukayo Saka', 'Arsenal F.C.'));
check('Saka 76 / potential 77', saka.overall === 76 && saka.potential === 77, `${saka.overall}/${saka.potential}`);
const saliba = ratingOf(packPlayer('William Saliba', 'Arsenal F.C.'));
check('Saliba 80 / potential 84', saliba.overall === 80 && saliba.potential === 84, `${saliba.overall}/${saliba.potential}`);
const alisson = ratingOf(packPlayer('Alisson Becker', 'Liverpool F.C.'));
check('Alisson 77 / potential 77', alisson.overall === 77 && alisson.potential === 77, `${alisson.overall}/${alisson.potential}`);
const ahanor = ratingOf(packPlayer('Honest Ahanor', 'Crystal Palace F.C.'));
const ahanor5 = ratingOf(packPlayer('Honest Ahanor', 'Crystal Palace F.C.'), 5);
check('Ahanor 66 / potential 78', ahanor.overall === 66 && ahanor.potential === 78, `${ahanor.overall}/${ahanor.potential}`);
check('Ahanor after 5 seasons in 72-76', ahanor5.overall >= 72 && ahanor5.overall <= 76, `${ahanor5.overall}`);
const eichhorn = ratingOf(packPlayer('Kennet Eichhorn', 'Bayer 04 Leverkusen'));
const eichhorn3 = ratingOf(packPlayer('Kennet Eichhorn', 'Bayer 04 Leverkusen'), 3);
check('Eichhorn 65 / potential 79', eichhorn.overall === 65 && eichhorn.potential === 79, `${eichhorn.overall}/${eichhorn.potential}`);
check('Eichhorn after 3 seasons in 69-73', eichhorn3.overall >= 69 && eichhorn3.overall <= 73, `${eichhorn3.overall}`);
const gotze = ratingOf(packPlayer('Mario Götze', 'Eintracht Frankfurt'));
const gotze5 = ratingOf(packPlayer('Mario Götze', 'Eintracht Frankfurt'), 5);
check(
  'Gotze pace falls faster than tactical over 5 seasons',
  gotze5.attributes.pace < gotze.attributes.pace &&
    gotze.attributes.pace - gotze5.attributes.pace > gotze.attributes.tactical - gotze5.attributes.tactical,
  `pace ${gotze.attributes.pace}->${gotze5.attributes.pace} tactical ${gotze.attributes.tactical}->${gotze5.attributes.tactical}`,
);
const endrick = ratingOf(packPlayer('Endrick', 'Real Madrid Club de Fútbol'));
const endrick5 = ratingOf(packPlayer('Endrick', 'Real Madrid Club de Fútbol'), 5);
const issoufou = ratingOf(packPlayer('Yanis Issoufou', 'Montpellier Hérault Sport Club'));
const issoufou5 = ratingOf(packPlayer('Yanis Issoufou', 'Montpellier Hérault Sport Club'), 5);
check(
  'rate divergence: Rapid closes more of the gap than Slow',
  endrick.developmentRate < issoufou.developmentRate &&
    (endrick5.overall - endrick.overall) / Math.max(1, endrick.potential - endrick.overall) <
      (issoufou5.overall - issoufou.overall) / Math.max(1, issoufou.potential - issoufou.overall),
  `Endrick rate ${endrick.developmentRate.toFixed(2)} gap ${endrick.potential - endrick.overall}->${endrick5.overall - endrick.overall}; Issoufou rate ${issoufou.developmentRate.toFixed(2)} gap ${issoufou.potential - issoufou.overall}->${issoufou5.overall - issoufou.overall}`,
);
// Uncertain player: same formula, flagged status, never hidden.
const simon = packPlayer('Carolin Simon', 'VfL Wolfsburg');
const simonRating = ratingOf(simon);
const simonEntry = Q.playerStatus(quality, simon.id, simon.clubId);
check('uncertain player still rated, status uncertain', simonRating.overall >= 1 && simonEntry && simonEntry.status === 'uncertain', `${simonRating.overall} / ${simonEntry && simonEntry.status}`);

// ---- Safeguard 1: club modifier can never make an ordinary player exceptional ----
let maxClubDelta = 0;
let ordinaryToExceptional = 0;
let maxLeagueDelta = 0;
const allProfiles = [];
for (const p of pack.players) {
  const league = pack.leagues.find((l) => l.id === pack.clubs.find((c) => c.id === p.clubId).leagueId);
  const base = R.computeRating({ id: p.id, role: R.roleOf(p.position), age: L.ageAt(pack.snapshotDate, p.dateOfBirth), leagueMod: 0, clubMod: 0, seasonsElapsed: 0 });
  // Club effect in isolation: league term held at 0 on both sides.
  const withMod = R.computeRating({ id: p.id, role: R.roleOf(p.position), age: L.ageAt(pack.snapshotDate, p.dateOfBirth), leagueMod: 0, clubMod: R.clubModFor(strength, p.clubId), seasonsElapsed: 0 });
  maxClubDelta = Math.max(maxClubDelta, Math.abs(withMod.overall - base.overall));
  if (base.overall <= 74 && withMod.overall >= 83) ordinaryToExceptional += 1;
  const leagueOnly = R.computeRating({ id: p.id, role: R.roleOf(p.position), age: L.ageAt(pack.snapshotDate, p.dateOfBirth), leagueMod: 1, clubMod: 0, seasonsElapsed: 0 });
  maxLeagueDelta = Math.max(maxLeagueDelta, Math.abs(leagueOnly.overall - base.overall));
  allProfiles.push(withMod);
}
check('club modifier moves overall by at most 4', maxClubDelta <= 4, `max ${maxClubDelta}`);
check('no ordinary (<=74) player becomes exceptional (>=83) via club mod', ordinaryToExceptional === 0);
check('league modifier moves overall by at most 1', maxLeagueDelta <= 1, `max ${maxLeagueDelta}`);

// ---- Distribution ----
const mean = allProfiles.reduce((s, p) => s + p.overall, 0) / allProfiles.length;
const maxOvr = Math.max(...allProfiles.map((p) => p.overall));
const exceptional = allProfiles.filter((p) => p.tier === 'Exceptional').length;
const sigs = new Set(allProfiles.map((p) => Object.values(p.attributes).join(',')));
check('distribution mean 65-75', mean >= 65 && mean <= 75, `mean ${mean.toFixed(1)}`);
check('distribution max >= 83', maxOvr >= 83, `max ${maxOvr}`);
check('exceptional under 2%', exceptional / allProfiles.length < 0.02, `${exceptional} of ${allProfiles.length}`);
check('no identical 8-attribute profiles', sigs.size === allProfiles.length);

// ---- Safeguard 3: transfer/loan consistency (snapshot anchor contract) ----
const anchorBefore = [];
const anchorAfter = [];
for (let s = 0; s <= 5; s += 1) {
  // Same snapshot modifiers before and after a hypothetical transfer:
  // the trajectory must be identical, because computeRating takes no
  // current-club input at all.
  anchorBefore.push(R.computeRating({ id: 'wd:Qanchor', role: 'ST', age: 22, leagueMod: 1, clubMod: 4, seasonsElapsed: s }));
  anchorAfter.push(R.computeRating({ id: 'wd:Qanchor', role: 'ST', age: 22, leagueMod: 1, clubMod: 4, seasonsElapsed: s }));
}
check('trajectory identical across a transfer (anchor preserved)', JSON.stringify(anchorBefore) === JSON.stringify(anchorAfter));
// Loader wiring: adapted rating equals direct computation with snapshot mod.
const pl = L.adaptPackToLeague(pack, pack.leagues.find((l) => l.name === 'Premier League').id, strength, 0);
const sakaAdapted = pl.players.find((p) => p.id === packPlayer('Bukayo Saka', 'Arsenal F.C.').id);
check('loader passes snapshot club mod (Saka adapted = 76)', sakaAdapted && sakaAdapted.overall === 76, sakaAdapted ? `${sakaAdapted.overall}` : 'missing');
const pl5 = L.adaptPackToLeague(pack, pack.leagues.find((l) => l.name === 'Premier League').id, strength, 5);
const sakaAdapted5 = pl5.players.find((p) => p.id === packPlayer('Bukayo Saka', 'Arsenal F.C.').id);
check('loader seasonsElapsed advances ratings (Saka 5 seasons < snapshot)', sakaAdapted5 && sakaAdapted5.overall < sakaAdapted.overall, sakaAdapted5 ? `${sakaAdapted5.overall}` : 'missing');

// ---- Club-strength evidence ----
function strengthOf(clubName) {
  const club = pack.clubs.find((c) => c.name === clubName);
  return strength.entries.find((e) => e.clubId === club.id);
}
const ars = strengthOf('Arsenal F.C.');
const liv = strengthOf('Liverpool F.C.');
const psg = strengthOf('Paris Saint-Germain FC');
check('Arsenal +4, 74 pts, GD +35, rank 2 of 20', ars && ars.modifier === 4 && ars.points === 74 && ars.goalDifference === 35 && ars.rank === 2 && ars.teams === 20, JSON.stringify(ars));
check('Liverpool +4, 84 pts, GD +45, rank 1', liv && liv.modifier === 4 && liv.points === 84 && liv.goalDifference === 45 && liv.rank === 1, JSON.stringify(liv));
check('PSG +4, 84 pts, GD +57, rank 1 of 18', psg && psg.modifier === 4 && psg.points === 84 && psg.goalDifference === 57 && psg.rank === 1 && psg.teams === 18, JSON.stringify(psg));
check('club without 2024-25 results gets modifier 0', R.clubModFor(strength, pack.clubs.find((c) => c.name === 'Xerez C.D.').id) === 0);
check('loadClubStrength garbage returns null', R.loadClubStrength(null) === null && R.loadClubStrength({ nope: 1 }) === null);
check(
  'loadClubStrength drops malformed entries',
  R.loadClubStrength({ packVersion: 'v1@2026-11-02', entries: [{ clubId: 'x' }, { clubId: 'y', modifier: 1, points: 1, goalDifference: 0, rank: 1, teams: 2 }] }).entries.length === 1,
);

// ---- Match consequences: tactical blend moves defence, pace moves attack ----
function miniLeague(tacticalDelta, paceDelta) {
  const mk = (pos, attrs) => ({ id: `m-${pos}`, firstName: 'T', lastName: 'T', age: 25, position: pos, role: 'CB', attributes: attrs, overall: 70, potential: 70, clubId: 'c' });
  const base = { pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70, goalkeeping: 20, tactical: 65 };
  const players = [];
  for (let i = 0; i < 4; i += 1) players.push(mk('DF', { ...base, tactical: 65 + tacticalDelta }));
  for (let i = 0; i < 4; i += 1) players.push(mk('MF', base));
  for (let i = 0; i < 2; i += 1) players.push(mk('FW', { ...base, pace: 70 + paceDelta }));
  players.push(mk('GK', { ...base, goalkeeping: 80, tactical: 65 + tacticalDelta }));
  return { clubs: [{ id: 'c', name: 'C', shortName: 'C', primaryColor: '#000', funds: 0 }], players };
}
const lowTac = miniLeague(-10, 0);
const highTac = miniLeague(10, 0);
check('higher tactical raises defence', E.defenceOf(highTac.players) > E.defenceOf(lowTac.players), `${E.defenceOf(lowTac.players)} vs ${E.defenceOf(highTac.players)}`);
const youngPace = miniLeague(0, 0);
const agedPace = miniLeague(0, -10);
check('lower pace lowers attack', E.attackOf(agedPace.players) < E.attackOf(youngPace.players), `${E.attackOf(youngPace.players)} vs ${E.attackOf(agedPace.players)}`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
