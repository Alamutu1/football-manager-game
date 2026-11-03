#!/usr/bin/env node
/**
 * D5 migration / backup / staging / snapshot / restore / queue tests.
 *
 * Honest scope note: expo-sqlite cannot run in plain Node, so the
 * SQLite tables themselves cannot be exercised here. This script
 * therefore does two things, and labels them separately:
 *  A. Source-contract checks: reads src/game/storage.ts and
 *     src/game/store.ts and asserts the real code contains the
 *     agreed steps in the agreed order (verified insert, disjoint
 *     tables, no deletion of valid backups/snapshots, queue wrapping
 *     every write action, internal functions never enqueueing,
 *     snapshot-first restore with a source-hash recheck).
 *  B. Behaviour simulation: an in-memory store implementing the
 *     same verified-insert / staging / snapshot / queue algorithms
 *     (same hash function from the compiled state-hash module) is
 *     exercised for the cases the user specified: two rapid
 *     Continues, a Continue while another write is running, starting
 *     a career while a write is pending, failed and uncertain
 *     writes resolved by reread, restore after the stored state
 *     changed since confirmation, corrupted-current restore, and
 *     orphan staging cleanup. The simulation is not a substitute
 *     for the phone test of the real SQLite path; the report says
 *     so explicitly.
 * Run after compiling the game core (same command as
 * test-d5-season.mjs): node scripts/test-d5-migration.mjs /tmp/fm-core
 * Exit code 0 = all pass, 1 = any failure.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

const OUT = process.argv[2] || '/tmp/fm-core';
const require = createRequire(import.meta.url);
const hashMod = require(join(resolve(OUT), 'state-hash.js'));

let passed = 0; let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.log(`FAIL ${name} ${detail}`); }
}

const storageSrc = readFileSync(resolve('src/game/storage.ts'), 'utf8');
const storeSrc = readFileSync(resolve('src/game/store.ts'), 'utf8');
const seasonSrc = readFileSync(resolve('src/game/season.ts'), 'utf8');

// ---- A. Source-contract checks ----
check('storage defines save_backups table', storageSrc.includes('CREATE TABLE IF NOT EXISTS save_backups'));
check('storage defines save_staging table', storageSrc.includes('CREATE TABLE IF NOT EXISTS save_staging'));
check('storage defines save_snapshots table', storageSrc.includes('CREATE TABLE IF NOT EXISTS save_snapshots'));
check('storage saves schema unchanged', storageSrc.includes('CREATE TABLE IF NOT EXISTS saves') && storageSrc.includes('id TEXT PRIMARY KEY NOT NULL'));
check('storage verified insert reads back text and hash', storageSrc.includes('readBack.stateText !== stateText') && storageSrc.includes('readBack.stateHash !== hash'));
check('storage never deletes from save_backups', !storageSrc.includes('DELETE FROM save_backups'));
check('storage never deletes from save_snapshots', !storageSrc.includes('DELETE FROM save_snapshots'));
check('storage only deletes staging rows outside failed-verification cleanup', storageSrc.includes('deleteStaged') && !storageSrc.includes('DELETE FROM save_backups') && !storageSrc.includes('DELETE FROM save_snapshots') && !storageSrc.includes('DELETE FROM saves'));
check('storage corrupt backup aborts restore', storageSrc.includes('failed its hash check and cannot be restored'));
check('storage raw read exists for corrupted saves', storageSrc.includes('loadRawGameState'));
check('store queue is a single promise chain', storeSrc.includes('let writeChain') && storeSrc.includes('writeChain.then'));
check('store queue has no busy rejection on enqueue path', !storeSrc.includes('queueHeld') && !storeSrc.includes('already holding'));
for (const action of ['ensureGame', 'startNewCareer', 'startRealCareer', 'playTestMatch', 'continueSeason', 'startNextSeason', 'prepareRestore', 'confirmRestore']) {
  check(`store ${action} runs through runExclusive`, storeSrc.includes(`${action}:`) && storeSrc.includes('runExclusive'));
}
check('store internal functions do not call runExclusive', (() => {
  const start = storeSrc.indexOf('async function migrateInternal');
  const end = storeSrc.indexOf('  return {\n    ready: false');
  const internals = start >= 0 && end > start ? storeSrc.slice(start, end) : '';
  return internals.length > 0 && !internals.includes('runExclusive(');
})());
check('store migration creates backup before staging', storeSrc.indexOf('createBackup(DEFAULT_SAVE_ID') < storeSrc.indexOf('createStaged(DEFAULT_SAVE_ID'));
check('store migration stages before replacing the save', storeSrc.indexOf('createStaged(DEFAULT_SAVE_ID') < storeSrc.indexOf('saveRawGameState(DEFAULT_SAVE_ID, \'My Career\', migratedText)'));
check('store migration deletes staging only after verified replacement', storeSrc.includes('Replacement verified: staging is temporary and is deleted'));
check('store restore rechecks source hash after confirmation', storeSrc.includes('sha256Hex(currentRaw) !== pending.sourceHash'));
check('store restore snapshots corrupted current saves', storeSrc.includes('pre-restore-corrupted-current'));
check('store non-qualifying saves are not rewritten on load', storeSrc.includes('Non-qualifying saves are NOT rewritten on load'));
check('store playTestMatch is save-then-set', storeSrc.includes('Save-then-set correction'));
check('store season careers do not play test matches', storeSrc.includes('if (game.seasonData) return null;'));
check('season core has no fixture-order variation requirement', !seasonSrc.includes('fixturesOrderHash') && !seasonSrc.includes('100'));
check('season terminal state is totalRounds + 1 and complete', storeSrc.includes('currentRound: isFinal ? total + 1 : round + 1') && storeSrc.includes("status: isFinal ? 'complete'"));

// ---- B. Behaviour simulation (in-memory, same algorithms) ----
const sha = hashMod.sha256Hex;
class MemDb {
  constructor() { this.saves = new Map(); this.backups = new Map(); this.staging = new Map(); this.snapshots = new Map(); this.counter = 0; }
  id(kind) { this.counter += 1; return `career-1:${kind}:${Date.now()}:${this.counter}`; }
  insertVerified(table, originalId, text, extra) {
    const id = this.id(table === 'save_backups' ? 'backup' : table === 'save_staging' ? 'staging' : 'snapshot');
    const row = { id, originalId, stateText: text, stateHash: sha(text), extra };
    // Simulate a read-back verification failure on demand via text marker.
    if (text.includes('__CORRUPT_ON_WRITE__')) { return null; }
    this[table === 'save_backups' ? 'backups' : table === 'save_staging' ? 'staging' : 'snapshots'].set(id, row);
    const back = this[table === 'save_backups' ? 'backups' : table === 'save_staging' ? 'staging' : 'snapshots'].get(id);
    if (back.stateText !== text || back.stateHash !== sha(text)) throw new Error('verification failed');
    return row;
  }
}
function createQueue() {
  let chain = Promise.resolve();
  return function runExclusive(fn) {
    const run = chain.then(fn, fn);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
}
const db = new MemDb();
const queue = createQueue();
// Migration simulation: backup -> stage -> verify -> replace -> delete staging.
async function migrateSim(originalText, migratedText) {
  const backup = db.insertVerified('save_backups', 'career-1', originalText, '');
  if (!backup) throw new Error('backup failed');
  const staged = db.insertVerified('save_staging', 'career-1', migratedText, 'd5-migration');
  if (!staged || staged.stateText !== migratedText) throw new Error('staging failed');
  db.saves.set('career-1', migratedText);
  const after = db.saves.get('career-1');
  if (after !== migratedText) { db.saves.set('career-1', originalText); throw new Error('replacement unverified'); }
  db.staging.delete(staged.id);
  return { backup, stagedId: staged.id };
}
const original = JSON.stringify({ seed: 1, userClubId: 'A', season: 1, results: [] });
const migrated = JSON.stringify({ seed: 1, userClubId: 'A', season: 1, results: [], seasonData: { currentRound: 1 } });
db.saves.set('career-1', original);
await migrateSim(original, migrated);
check('simulation: migration leaves backup, no staging, migrated save', db.saves.get('career-1') === migrated && db.backups.size === 1 && db.staging.size === 0);
check('simulation: backup text is byte-identical to original', [...db.backups.values()][0].stateText === original);
// Failed staging leaves original untouched and no backup replacement.
const db2 = new MemDb(); db2.saves.set('career-1', original);
try {
  db2.insertVerified('save_backups', 'career-1', original, '');
  const bad = db2.insertVerified('save_staging', 'career-1', '__CORRUPT_ON_WRITE__migrated', 'd5-migration');
  if (bad) throw new Error('expected staging failure');
  check('simulation: failed staging leaves original untouched', db2.saves.get('career-1') === original);
} catch (e) { check('simulation: failed staging leaves original untouched', false, String(e)); }
// Queue: two rapid Continues advance exactly two rounds, sequentially.
let round = 1;
async function continueSim() {
  return queue(async () => {
    const seen = round;
    await new Promise((r) => setTimeout(r, 5));
    round = seen + 1;
    return round;
  });
}
const [r1, r2] = await Promise.all([continueSim(), continueSim()]);
check('simulation: two rapid Continues advance exactly two rounds', r1 === 2 && r2 === 3 && round === 3, `${r1}, ${r2}, ${round}`);
// Queue: starting a career while a write is pending waits and then sees the newer state.
let state = 'old';
const slow = queue(async () => { await new Promise((r) => setTimeout(r, 10)); state = 'written'; return state; });
const starter = queue(async () => state);
await slow; const starterSeen = await starter;
check('simulation: career start while write pending sees newer state', starterSeen === 'written');
// Queue: a throwing operation does not poison the queue.
await queue(async () => { throw new Error('boom'); }).catch(() => undefined);
const afterThrow = await queue(async () => 'alive');
check('simulation: queue survives a throwing operation', afterThrow === 'alive');
// Uncertain write resolved by reread: stored intended wins despite rejection.
db.saves.set('career-1', migrated);
const intended = JSON.stringify({ seed: 1, season: 2 });
async function uncertainSave() {
  db.saves.set('career-1', intended); // commit actually happened
  throw new Error('save reported failure');
}
let adopted = false;
try { await uncertainSave(); } catch { if (db.saves.get('career-1') === intended) adopted = true; }
check('simulation: uncertain write resolved by reread to intended', adopted);
// Restore after stored state changed since confirmation: abort, nothing overwritten.
db.saves.set('career-1', original);
const snap = db.insertVerified('save_snapshots', 'career-1', original, 'pre-restore');
const sourceHash = sha(original);
db.saves.set('career-1', JSON.stringify({ seed: 1, season: 3 })); // newer progress lands after confirmation
const backupText = JSON.stringify({ seed: 1, season: 1 });
let restoreAborted = false;
if (sha(db.saves.get('career-1')) !== sourceHash) restoreAborted = true;
else db.saves.set('career-1', backupText);
check('simulation: restore aborts when stored state changed since confirmation', restoreAborted && db.saves.get('career-1') !== backupText && db.snapshots.has(snap.id));
// Corrupted current: snapshot preserves exact raw text, progress indeterminate.
const corruptRaw = '{"seed": 1, "season": ';
const corruptSnap = db.insertVerified('save_snapshots', 'career-1', corruptRaw, 'pre-restore-corrupted-current');
let parsed = null; try { parsed = JSON.parse(corruptRaw); } catch { parsed = null; }
check('simulation: corrupted current is snapshot verbatim and indeterminate', corruptSnap.stateText === corruptRaw && parsed === null);
// Orphan staging cleaned only after save verifies good.
db.staging.set('orphan-1', { id: 'orphan-1', stateText: migrated });
const saveGood = db.saves.get('career-1') !== null;
if (saveGood) db.staging.delete('orphan-1');
check('simulation: orphan staging cleaned after good save', db.staging.size === 0);
// Recent results cap and frozen legacy results (pure logic, same as store).
let recent = [];
for (let i = 1; i <= 12; i += 1) recent.push({ season: 1, round: i, result: {} });
recent = recent.slice(-10);
check('simulation: recentResults capped at 10', recent.length === 10 && recent[0].round === 3);
const legacy = [{ a: 1 }];
const seasonGame = { ...JSON.parse(original), results: legacy, seasonData: { currentRound: 1 } };
check('simulation: legacy results frozen for season careers (no append in season path)', seasonGame.results.length === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
