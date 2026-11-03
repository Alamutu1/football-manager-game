/**
 * Save storage, backed by expo-sqlite (an Expo SDK module, included in
 * Expo Go, so this works in Expo Go, dev builds, and production builds
 * with no custom native code).
 *
 * Design note for future multiplayer: this module is the ONLY place that
 * touches the database. The store talks to this interface, never to SQL
 * directly, so a cloud save backend can replace this file later without
 * touching game logic or screens.
 *
 * D5 adds three disjoint tables beside `saves` (whose schema is
 * unchanged):
 * - `save_backups`: verified migration backups. A row is only a
 *   backup once its creation verification (read-back text equality
 *   plus hash equality) has passed. Valid backups are never deleted
 *   by D5 code. A row that fails creation verification is not a
 *   backup at all: it is a failed candidate and is removed at once,
 *   before any migration proceeds, while the original stays intact.
 * - `save_staging`: temporary migrated states, pending replacement.
 *   Deleted after a successful verified replacement, and after a
 *   failed staged verification. On a crash, an orphaned staging row
 *   is deleted on the next load only after the current save verifies
 *   good; if the save does not verify good, the staging row is kept
 *   because it may be re-verified to complete the replacement.
 * - `save_snapshots`: preserved current states taken before a
 *   restore, including states too corrupted to parse. Snapshots are
 *   never auto-deleted in D5. A corrupted backup (a valid backup
 *   whose hash later fails on a restore read) is preserved, never
 *   written from, never auto-deleted, and the restore aborts.
 *
 * Storage primitives never enqueue and never call store actions:
 * the store's write queue is the only serialisation layer, and
 * these functions are what a queued section calls directly. That
 * separation is what makes nested enqueueing impossible.
 */
import * as SQLite from 'expo-sqlite';
import { sha256Hex } from './state-hash';
import type { GameState, SaveMeta } from './types';

const DB_NAME = 'pocket-club-manager.db';
export const DEFAULT_SAVE_ID = 'career-1';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS saves (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          state TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS save_backups (
          backup_id TEXT PRIMARY KEY NOT NULL,
          original_id TEXT NOT NULL,
          state TEXT NOT NULL,
          state_hash TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS save_staging (
          staging_id TEXT PRIMARY KEY NOT NULL,
          original_id TEXT NOT NULL,
          state TEXT NOT NULL,
          state_hash TEXT NOT NULL,
          purpose TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS save_snapshots (
          snapshot_id TEXT PRIMARY KEY NOT NULL,
          original_id TEXT NOT NULL,
          state TEXT NOT NULL,
          state_hash TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ id: string; name: string; updated_at: number }>(
    'SELECT id, name, updated_at FROM saves ORDER BY updated_at DESC',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, updatedAt: r.updated_at }));
}

export async function saveGameState(id: string, name: string, state: GameState): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO saves (id, name, state, updated_at) VALUES (?, ?, ?, ?)',
    [id, name, JSON.stringify(state), Date.now()],
  );
}

/** Write an exact raw state text (used for migration replacement and restore). */
export async function saveRawGameState(id: string, name: string, stateText: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO saves (id, name, state, updated_at) VALUES (?, ?, ?, ?)',
    [id, name, stateText, Date.now()],
  );
}

export async function loadGameState(id: string): Promise<GameState | null> {
  const raw = await loadRawGameState(id);
  if (raw === null) return null;
  return JSON.parse(raw) as GameState;
}

/** Read the stored text without parsing it: the corrupted-save path. */
export async function loadRawGameState(id: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ state: string }>(
    'SELECT state FROM saves WHERE id = ?',
    [id],
  );
  if (!row) return null;
  return row.state;
}

let uniqueCounter = 0;

/** Unique id: original id + kind + millisecond timestamp + counter. */
export function makeStoredId(originalId: string, kind: string): string {
  uniqueCounter += 1;
  return `${originalId}:${kind}:${Date.now()}:${uniqueCounter}`;
}

export interface StoredRow {
  id: string;
  originalId: string;
  stateText: string;
  stateHash: string;
  createdAt: number;
  purposeOrReason: string;
}

async function readRow(table: string, idColumn: string, id: string): Promise<StoredRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    state: string; state_hash: string; original_id: string; created_at: number;
    purpose?: string; reason?: string;
  }>(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [id]);
  if (!row) return null;
  return {
    id,
    originalId: row.original_id,
    stateText: row.state,
    stateHash: row.state_hash,
    createdAt: row.created_at,
    purposeOrReason: row.purpose ?? row.reason ?? '',
  };
}

async function listRows(table: string, idColumn: string, originalId: string): Promise<StoredRow[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    state: string; state_hash: string; original_id: string; created_at: number;
    purpose?: string; reason?: string;
    backup_id?: string; staging_id?: string; snapshot_id?: string;
  }>(`SELECT * FROM ${table} WHERE original_id = ? ORDER BY created_at DESC`, [originalId]);
  return rows.map((row) => ({
    id: (row.backup_id ?? row.staging_id ?? row.snapshot_id ?? '') as string,
    originalId: row.original_id,
    stateText: row.state,
    stateHash: row.state_hash,
    createdAt: row.created_at,
    purposeOrReason: row.purpose ?? row.reason ?? '',
  }));
}

async function deleteRow(table: string, idColumn: string, id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${table} WHERE ${idColumn} = ?`, [id]);
}

/**
 * Insert a verified row: the row is read back immediately and must
 * match on exact text and hash, or the candidate row is removed and
 * an error is thrown. The caller must not proceed on failure.
 * `extra` is the optional purpose/reason column for staging/snapshots.
 */
async function insertVerifiedRow(
  table: string,
  idColumn: string,
  id: string,
  originalId: string,
  stateText: string,
  extraColumn: string | null,
  extraValue: string,
): Promise<StoredRow> {
  const db = await getDb();
  const hash = sha256Hex(stateText);
  const columns = extraColumn
    ? `${idColumn}, original_id, state, state_hash, ${extraColumn}, created_at`
    : `${idColumn}, original_id, state, state_hash, created_at`;
  const placeholders = extraColumn ? '?, ?, ?, ?, ?, ?' : '?, ?, ?, ?, ?';
  const params: (string | number)[] = extraColumn
    ? [id, originalId, stateText, hash, extraValue, Date.now()]
    : [id, originalId, stateText, hash, Date.now()];
  try {
    await db.runAsync(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`, params);
  } catch (e) {
    throw new Error(`Could not create ${table} row: ${e instanceof Error ? e.message : 'insert failed'}`);
  }
  const readBack = await readRow(table, idColumn, id);
  if (!readBack || readBack.stateText !== stateText || readBack.stateHash !== hash) {
    await deleteRow(table, idColumn, id).catch(() => undefined);
    throw new Error(`${table} row failed creation verification and was removed.`);
  }
  return readBack;
}

export async function createBackup(originalId: string, stateText: string): Promise<StoredRow> {
  return insertVerifiedRow('save_backups', 'backup_id', makeStoredId(originalId, 'backup'), originalId, stateText, null, '');
}

export async function readBackup(backupId: string): Promise<StoredRow | null> {
  const row = await readRow('save_backups', 'backup_id', backupId);
  if (!row) return null;
  if (sha256Hex(row.stateText) !== row.stateHash) {
    throw new Error(`Backup ${backupId} failed its hash check and cannot be restored.`);
  }
  return row;
}

export async function listBackups(originalId: string): Promise<StoredRow[]> {
  return listRows('save_backups', 'backup_id', originalId);
}

export async function createStaged(
  originalId: string,
  stateText: string,
  purpose: string,
): Promise<StoredRow> {
  return insertVerifiedRow('save_staging', 'staging_id', makeStoredId(originalId, 'staging'), originalId, stateText, 'purpose', purpose);
}

export async function readStaged(stagingId: string): Promise<StoredRow | null> {
  const row = await readRow('save_staging', 'staging_id', stagingId);
  if (!row) return null;
  if (sha256Hex(row.stateText) !== row.stateHash) {
    throw new Error(`Staged state ${stagingId} failed its hash check.`);
  }
  return row;
}

export async function deleteStaged(stagingId: string): Promise<void> {
  await deleteRow('save_staging', 'staging_id', stagingId);
}

export async function listStaging(originalId: string): Promise<StoredRow[]> {
  return listRows('save_staging', 'staging_id', originalId);
}

/** Verified snapshot of a current state, even if it cannot be parsed. */
export async function createSnapshot(
  originalId: string,
  stateText: string,
  reason: string,
): Promise<StoredRow> {
  return insertVerifiedRow('save_snapshots', 'snapshot_id', makeStoredId(originalId, 'snapshot'), originalId, stateText, 'reason', reason);
}

export async function readSnapshot(snapshotId: string): Promise<StoredRow | null> {
  const row = await readRow('save_snapshots', 'snapshot_id', snapshotId);
  if (!row) return null;
  if (sha256Hex(row.stateText) !== row.stateHash) {
    throw new Error(`Snapshot ${snapshotId} failed its hash check.`);
  }
  return row;
}

export async function listSnapshots(originalId: string): Promise<StoredRow[]> {
  return listRows('save_snapshots', 'snapshot_id', originalId);
}

/** Parse a stored row's text, or return null when it cannot be parsed. */
export function parseStoredGame(row: StoredRow): GameState | null {
  try {
    return JSON.parse(row.stateText) as GameState;
  } catch {
    return null;
  }
}
