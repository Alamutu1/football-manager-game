/**
 * Game store (zustand). Holds the live career and talks to storage.ts
 * for persistence. Screens never touch SQLite directly.
 *
 * D2 dataset rules:
 * - The bundled real-world data pack (data-packs/v1) is loaded and
 *   validated on startup. It works fully offline: the pack is a
 *   build-time JSON import, never a network fetch.
 * - A fresh install starts a REAL career by default (first club of
 *   the first league, alphabetically). The Leagues tab lets the user
 *   pick any other real club instead.
 * - Legacy saves (written before D2, no dataset fields) keep working
 *   exactly as before on the fictional generator. New fictional
 *   careers are still available through startNewCareer, and the
 *   fictional generator remains the automated-test path.
 * - If the pack fails to load, a real-club save is NOT destroyed and
 *   the app does NOT crash: the store reports an error and the Club
 *   screen offers a fictional career instead.
 *
 * D5 write queue (see the final reviewed plan and addenda):
 * - Every save-writing public action runs through one shared promise
 *   chain, `runExclusive`. The queue holds the ENTIRE read, modify,
 *   write, verify and update sequence, not just the database write:
 *   a queued section reads the latest state inside the section,
 *   builds the next state, writes it, rereads storage to verify,
 *   and only then updates the in-memory state.
 * - A second action triggered while one is running enqueues and
 *   waits its turn; it is never rejected for being concurrent.
 * - Internal implementation functions never enqueue and never call
 *   public store actions. Public actions are the only callers of
 *   runExclusive, and internal functions call storage primitives
 *   directly. That one-way separation is what prevents nested
 *   enqueueing (and therefore queue deadlocks). No runtime busy
 *   check sits on the enqueue path.
 * - User confirmations (restore) happen OUTSIDE the queue. The
 *   restore section then re-checks that the stored state still
 *   matches the snapshot's source hash before replacing anything;
 *   if it changed since confirmation was requested, the restore
 *   aborts and the snapshot is preserved.
 * - On any save failure, the section rereads actual storage and
 *   decides by what is stored: intended state present means the
 *   commit succeeded despite the error (adopt it); previous state
 *   present means it did not happen (keep it and report); anything
 *   else blocks further writes with an error and no guessed repair.
 */
import { create } from 'zustand';
import { generateLeague } from './seed';
import { simulateMatch } from './engine';
import {
  DEFAULT_SAVE_ID,
  createBackup,
  createSnapshot,
  createStaged,
  deleteStaged,
  listBackups,
  listSnapshots,
  listStaging,
  listSaves,
  loadGameState,
  loadRawGameState,
  parseStoredGame,
  readBackup,
  readSnapshot,
  readStaged,
  saveGameState,
  saveRawGameState,
  type StoredRow,
} from './storage';
import {
  adaptPackToLeague,
  clubsOfLeague,
  datasetOf,
  leagueOfClub,
  loadDataPack,
  packVersion,
  playersOfClub,
} from './data-pack-loader';
import { loadQuality } from './data-quality';
import { loadClubStrength, type ClubStrength } from './ratings';
import { sha256Hex } from './state-hash';
import { SEASON_MEMBERSHIP_VERSION, membershipFor, seasonLeagueOfClub } from './season-membership';
import {
  championOf,
  fixtureSeed,
  generateFixtures,
  roundFixtures,
  tableFor,
  totalRounds,
  validateSeasonData,
} from './season';
import type { DataPack } from './data-pack';
import type { DataQuality } from './data-quality';
import type { GameState, League, MatchResult, SeasonData, SeasonRecord } from './types';

// Bundled at build time, so the loader works with no connection.
// `require` (not a static import) keeps the 1.6 MB JSON out of the
// TypeScript literal-type inference path, matching the image requires
// already used elsewhere in this app.
const bundledPackJson = require('../../data-packs/v1/data-pack.json');
// D3 quality overlay, built by scripts/build-quality-overlay.mjs.
// A missing or stale overlay (pack version mismatch) degrades to
// null: screens then show "Unverified" instead of statuses.
const bundledQualityJson = require('../../data-packs/v1/quality.json');
// D4 club-strength table, built by scripts/build-club-strength.mjs
// from 2024-25 results. Same degrade-to-null rule; a missing table
// just means club modifiers of 0, ratings still compute.
const bundledClubStrengthJson = require('../../data-packs/v1/club-strength.json');

export interface BackupEntry {
  id: string;
  kind: 'backup' | 'snapshot';
  createdAt: number;
  season: number | null;
  round: number | null;
  reason: string;
}

export interface PendingRestore {
  backupId: string;
  snapshotId: string;
  sourceHash: string;
  backupSeason: number | null;
  backupRound: number | null;
  currentSeason: number | null;
  currentRound: number | null;
  /** False when the current save cannot be parsed well enough to determine progress. */
  currentDeterminate: boolean;
}

export interface CorruptedSave {
  saveId: string;
  rawLength: number;
  rawHash: string;
}

interface GameStore {
  ready: boolean;
  loading: boolean;
  /** True while any queued write section is running; write UI is disabled then. */
  saving: boolean;
  error: string | null;
  league: League | null;
  game: GameState | null;
  pack: DataPack | null;
  packError: string | null;
  quality: DataQuality | null;
  clubStrength: ClubStrength | null;
  backups: BackupEntry[];
  pendingRestore: PendingRestore | null;
  corruptedSave: CorruptedSave | null;
  ensureGame: () => Promise<void>;
  startNewCareer: () => Promise<void>;
  startRealCareer: (clubId: string) => Promise<boolean>;
  playTestMatch: () => Promise<MatchResult | null>;
  /** Advance exactly one season round. Returns true when a round was saved. */
  continueSeason: () => Promise<boolean>;
  /** Start the next season; only valid from the complete terminal state. */
  startNextSeason: () => Promise<boolean>;
  /** Snapshot the current save and prepare a confirmed restore. Returns the pending restore, or null. */
  prepareRestore: (storedId: string) => Promise<PendingRestore | null>;
  /** Execute a prepared restore, after the user confirmed it outside the queue. */
  confirmRestore: () => Promise<boolean>;
  cancelRestore: () => void;
  refreshBackups: () => Promise<void>;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}

export const useGameStore = create<GameStore>()((set, get) => {
  // Shared write queue. One chain, no busy check on the enqueue
  // path: every caller chains behind whatever is running and waits.
  let writeChain: Promise<unknown> = Promise.resolve();

  function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const wrapped = async (): Promise<T> => {
      set({ saving: true });
      try {
        return await fn();
      } finally {
        set({ saving: false });
      }
    };
    const run = writeChain.then(wrapped, wrapped);
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async function rereadStored(): Promise<{ text: string | null; game: GameState | null }> {
    try {
      const text = await loadRawGameState(DEFAULT_SAVE_ID);
      if (text === null) return { text: null, game: null };
      try {
        return { text, game: JSON.parse(text) as GameState };
      } catch {
        return { text, game: null };
      }
    } catch {
      return { text: null, game: null };
    }
  }

  /** Decide an ambiguous write by rereading storage. Returns 'adopted' | 'kept' | 'blocked'. */
  async function resolveWrite(
    intendedText: string,
    previousText: string,
    onAdopt: (game: GameState) => void,
  ): Promise<'adopted' | 'kept' | 'blocked'> {
    const reread = await rereadStored();
    if (reread.text === null) return 'blocked';
    if (reread.text === intendedText && reread.game) {
      onAdopt(reread.game);
      return 'adopted';
    }
    if (reread.text === previousText) return 'kept';
    return 'blocked';
  }

  /** Club-name map for season tables: membership clubs only, never the full adapted league. */
  function seasonClubsById(league: League, leagueId: string): Map<string, string> {
    const members = membershipFor(leagueId);
    return new Map(
      league.clubs.filter((c) => !members || members.includes(c.id)).map((c) => [c.id, c.name]),
    );
  }

  function leagueForGame(pack: DataPack | null, game: GameState): League | null {
    if (datasetOf(game).source === 'real') {
      if (!pack) return null;
      const league = leagueOfClub(pack, game.userClubId);
      if (!league) return null;
      return adaptPackToLeague(pack, league.id, get().clubStrength, Math.max(0, (game.season ?? 1) - 1));
    }
    return generateLeague(game.seed);
  }

  function toBackupEntry(row: StoredRow, kind: 'backup' | 'snapshot'): BackupEntry {
    const parsed = parseStoredGame(row);
    return {
      id: row.id,
      kind,
      createdAt: row.createdAt,
      season: parsed && typeof parsed.season === 'number' ? parsed.season : null,
      round: parsed?.seasonData ? parsed.seasonData.currentRound : null,
      reason: row.purposeOrReason,
    };
  }

  async function loadBackupEntries(): Promise<BackupEntry[]> {
    try {
      const [backups, snapshots] = await Promise.all([
        listBackups(DEFAULT_SAVE_ID),
        listSnapshots(DEFAULT_SAVE_ID),
      ]);
      const entries = [
        ...backups.map((r) => toBackupEntry(r, 'backup' as const)),
        ...snapshots.map((r) => toBackupEntry(r, 'snapshot' as const)),
      ];
      entries.sort((a, b) => b.createdAt - a.createdAt);
      return entries;
    } catch {
      return get().backups;
    }
  }

  /** Internal: clean orphaned staging rows, only after the current save verifies good. */
  async function cleanOrphanStaging(): Promise<void> {
    try {
      const rows = await listStaging(DEFAULT_SAVE_ID);
      for (const row of rows) await deleteStaged(row.id);
    } catch {
      // Orphan cleanup is best-effort; a leftover staging row is
      // harmless (it is never read as a save) and is retried next load.
    }
  }

  /** Internal D5 migration for a qualifying real save without season data. */
  async function migrateInternal(
    saved: GameState,
    rawText: string,
    leagueId: string,
  ): Promise<GameState | null> {
    const members = membershipFor(leagueId);
    if (!members) return null;
    // (1) Read and validate in memory only; invalid input stops here.
    if (typeof saved.season !== 'number' || saved.season < 1) return null;
    // (2) Insert a verified backup; a failed candidate is removed by
    // storage and the original is untouched, so abort on any error.
    try {
      await createBackup(DEFAULT_SAVE_ID, rawText);
    } catch (e) {
      set({ error: `Migration backup failed: ${e instanceof Error ? e.message : 'backup failed'}. Your career was not changed.` });
      return null;
    }
    // (3) Build the migrated state in memory only, serialise once.
    const seasonData: SeasonData = {
      leagueId,
      membershipVersion: SEASON_MEMBERSHIP_VERSION,
      fixtures: generateFixtures(members, saved.seed, leagueId, saved.season),
      currentRound: 1,
      status: 'inProgress',
    };
    const migrated: GameState = { ...saved, seasonData };
    const migratedText = JSON.stringify(migrated);
    // (4) Stage and verify the migrated text before touching saves.
    let stagedId: string;
    try {
      const staged = await createStaged(DEFAULT_SAVE_ID, migratedText, 'd5-migration');
      stagedId = staged.id;
    } catch (e) {
      set({ error: `Migration staging failed: ${e instanceof Error ? e.message : 'staging failed'}. Your career was not changed.` });
      return null;
    }
    try {
      const readBack = await readStaged(stagedId);
      const stagedGame = readBack ? parseStoredGame(readBack) : null;
      const semanticOk =
        readBack !== null &&
        readBack.stateText === migratedText &&
        stagedGame !== null &&
        stagedGame.userClubId === saved.userClubId &&
        stagedGame.season === saved.season &&
        stagedGame.results.length === saved.results.length &&
        stagedGame.seasonData !== undefined &&
        stagedGame.seasonData.currentRound === 1 &&
        stagedGame.seasonData.fixtures.length === seasonData.fixtures.length &&
        validateSeasonData(stagedGame.seasonData, SEASON_MEMBERSHIP_VERSION).length === 0;
      if (!semanticOk) {
        await deleteStaged(stagedId).catch(() => undefined);
        set({ error: 'Migration verification failed. Your career was not changed.' });
        return null;
      }
    } catch (e) {
      await deleteStaged(stagedId).catch(() => undefined);
      set({ error: `Migration verification failed: ${e instanceof Error ? e.message : 'verification failed'}. Your career was not changed.` });
      return null;
    }
    // (5) Only now replace the save, then verify by read-back.
    try {
      await saveRawGameState(DEFAULT_SAVE_ID, 'My Career', migratedText);
    } catch (e) {
      await deleteStaged(stagedId).catch(() => undefined);
      set({ error: `Migration save failed: ${e instanceof Error ? e.message : 'save failed'}. Your career was not changed.` });
      return null;
    }
    const after = await loadRawGameState(DEFAULT_SAVE_ID);
    if (after !== migratedText || sha256Hex(after) !== sha256Hex(migratedText)) {
      // Replacement did not verify: restore the backup text.
      try {
        await saveRawGameState(DEFAULT_SAVE_ID, 'My Career', rawText);
      } catch {
        // Restore itself failed: leave the stored state for the
        // corrupted-save path on the next load; never guess a repair.
        set({ error: 'Migration replacement could not be verified and the backup restore also failed. Your career has not been deleted; please restart the app and use the backup restore.' });
        return null;
      }
      await deleteStaged(stagedId).catch(() => undefined);
      set({ error: 'Migration replacement could not be verified, so your original career was restored unchanged.' });
      return null;
    }
    // (6) Replacement verified: staging is temporary and is deleted.
    await deleteStaged(stagedId).catch(() => undefined);
    return migrated;
  }

  async function startNewCareerInternal(): Promise<void> {
    set({ loading: true, error: null, corruptedSave: null, pendingRestore: null });
    try {
      const seed = randomSeed();
      const league = generateLeague(seed);
      const game: GameState = {
        seed,
        userClubId: league.clubs[0].id,
        season: 1,
        results: [],
        datasetSource: 'fictional',
      };
      const previous = await loadRawGameState(DEFAULT_SAVE_ID);
      try {
        await saveGameState(DEFAULT_SAVE_ID, 'My Career', game);
      } catch {
        const outcome = await resolveWrite(JSON.stringify(game), previous ?? '', (adopted) => {
          set({ league: generateLeague(adopted.seed), game: adopted, ready: true, loading: false });
        });
        if (outcome === 'adopted') return;
        set({ error: 'Failed to start career: the save could not be verified.', loading: false });
        return;
      }
      const reread = await loadGameState(DEFAULT_SAVE_ID);
      if (!reread || JSON.stringify(reread) !== JSON.stringify(game)) {
        set({ error: 'Failed to start career: the saved career could not be verified.', loading: false });
        return;
      }
      set({ league, game, ready: true, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to start career.', loading: false });
    }
  }

  async function startRealCareerInternal(clubId: string): Promise<boolean> {
    const { pack } = get();
    if (!pack) {
      set({ error: 'The data pack is not available, so a real club cannot be selected.' });
      return false;
    }
    const league = leagueOfClub(pack, clubId);
    if (!league) {
      set({ error: 'That club is not in the data pack.' });
      return false;
    }
    if (playersOfClub(pack, clubId).length === 0) {
      set({
        error:
          'That club has no players recorded in the data pack, so it cannot start a career yet. ' +
          'Pick a club with players listed.',
      });
      return false;
    }
    set({ loading: true, error: null, corruptedSave: null, pendingRestore: null });
    try {
      const seed = randomSeed();
      const members = membershipFor(league.id);
      const seasonLeague = seasonLeagueOfClub(clubId);
      const seasonData: SeasonData | undefined =
        seasonLeague && members
          ? {
              leagueId: seasonLeague,
              membershipVersion: SEASON_MEMBERSHIP_VERSION,
              fixtures: generateFixtures(members, seed, seasonLeague, 1),
              currentRound: 1,
              status: 'inProgress',
            }
          : undefined;
      const game: GameState = {
        seed,
        userClubId: clubId,
        season: 1,
        results: [],
        datasetSource: 'real',
        datasetVersion: packVersion(pack),
        ...(seasonData ? { seasonData } : {}),
      };
      const previous = await loadRawGameState(DEFAULT_SAVE_ID);
      try {
        await saveGameState(DEFAULT_SAVE_ID, 'My Career', game);
      } catch {
        const outcome = await resolveWrite(JSON.stringify(game), previous ?? '', (adopted) => {
          const adoptedLeague = leagueForGame(pack, adopted);
          set({ league: adoptedLeague, game: adopted, ready: true, loading: false });
        });
        if (outcome === 'adopted') return true;
        set({ error: 'Failed to start career: the save could not be verified.', loading: false });
        return false;
      }
      const reread = await loadGameState(DEFAULT_SAVE_ID);
      if (!reread || JSON.stringify(reread) !== JSON.stringify(game)) {
        set({ error: 'Failed to start career: the saved career could not be verified.', loading: false });
        return false;
      }
      set({
        league: adaptPackToLeague(pack, league.id, get().clubStrength, 0),
        game,
        ready: true,
        loading: false,
      });
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to start career.', loading: false });
      return false;
    }
  }

  async function ensureGameInternal(): Promise<void> {
    if (get().ready) return;
    set({ loading: true, error: null });
    try {
      const loaded = loadDataPack(bundledPackJson);
      const pack = loaded.ok ? loaded.pack : null;
      const packError = loaded.ok
        ? null
        : loaded.issues
            .filter((i) => i.severity === 'error')
            .map((i) => i.message)
            .join('; ');
      const loadedQuality = loadQuality(bundledQualityJson);
      const quality =
        pack && loadedQuality && loadedQuality.packVersion === packVersion(pack) ? loadedQuality : null;
      const loadedStrength = loadClubStrength(bundledClubStrengthJson);
      const clubStrength =
        pack && loadedStrength && loadedStrength.packVersion === packVersion(pack)
          ? loadedStrength
          : null;
      set({ pack, packError, quality, clubStrength });

      const saves = await listSaves();
      if (saves.length > 0) {
        const rawText = await loadRawGameState(saves[0].id);
        let saved: GameState | null = null;
        let parseFailed = false;
        if (rawText !== null) {
          try {
            saved = JSON.parse(rawText) as GameState;
          } catch {
            parseFailed = true;
          }
        }
        if (parseFailed && rawText !== null) {
          // Corrupted current save: never guess, never auto-restore,
          // never start a fresh career in its place. Surface the
          // backup/snapshot information for an explicit restore.
          const entries = await loadBackupEntries();
          set({
            corruptedSave: { saveId: saves[0].id, rawLength: rawText.length, rawHash: sha256Hex(rawText) },
            backups: entries,
            error:
              'Your saved career cannot be read, so its season and progress cannot be determined. ' +
              'Nothing has been overwritten. Choose a backup below to restore it, after confirming.',
            loading: false,
            ready: true,
            league: null,
            game: null,
          });
          return;
        }
        if (saved) {
          if (datasetOf(saved).source === 'real') {
            if (!pack) {
              set({
                error:
                  'Your real-club career needs the data pack, which failed to load. ' +
                  'Your save was not deleted — start a fictional career below to keep playing.',
                loading: false,
                ready: true,
                league: null,
                game: null,
              });
              return;
            }
            const savedLeague = leagueOfClub(pack, saved.userClubId);
            if (!savedLeague) {
              set({
                error:
                  'Your saved club is no longer in the data pack. ' +
                  'Start a new career to keep playing.',
                loading: false,
                ready: true,
                league: null,
                game: null,
              });
              return;
            }
            const seasonLeague = seasonLeagueOfClub(saved.userClubId);
            const seasonsElapsed = Math.max(0, (saved.season ?? 1) - 1);
            const adapted = adaptPackToLeague(pack, savedLeague.id, get().clubStrength, seasonsElapsed);
            if (seasonLeague && !saved.seasonData && rawText !== null) {
              // Qualifying pre-D5 save: migrate in this same section.
              const migrated = await migrateInternal(saved, rawText, seasonLeague);
              if (migrated) {
                const entries = await loadBackupEntries();
                set({
                  league: adaptPackToLeague(pack, savedLeague.id, get().clubStrength, seasonsElapsed),
                  game: migrated,
                  backups: entries,
                  ready: true,
                  loading: false,
                });
                return;
              }
              // Migration failed or was aborted: the original save
              // is intact (migrateInternal reports the reason). Load
              // it unchanged so the user can retry or restore.
              if (get().error) {
                set({ league: adapted, game: saved, ready: true, loading: false });
                return;
              }
            }
            if (saved.seasonData) {
              const issues = validateSeasonData(saved.seasonData, SEASON_MEMBERSHIP_VERSION);
              if (issues.length > 0) {
                // Invalid season state: block Continue via the error
                // and the screen's own validation; never guess a repair.
                set({
                  league: adapted,
                  game: saved,
                  error: `This season state is invalid, so Continue is blocked: ${issues.join(' ')}`,
                  ready: true,
                  loading: false,
                });
                return;
              }
            }
            // Non-qualifying saves are NOT rewritten on load: no
            // backup, no staging, no save call at all in this path.
            await cleanOrphanStaging();
            const entries = await loadBackupEntries();
            set({ league: adapted, game: saved, backups: entries, ready: true, loading: false });
            return;
          }
          // Legacy fictional save (or an explicit fictional career):
          // exactly the old behaviour, seed-regenerated, never rewritten.
          await cleanOrphanStaging();
          const entries = await loadBackupEntries();
          set({ league: generateLeague(saved.seed), game: saved, backups: entries, ready: true, loading: false });
          return;
        }
      }

      // No save: real career by default when the pack loaded.
      if (pack && pack.leagues.length > 0) {
        const firstLeague = [...pack.leagues].sort((a, b) => a.name.localeCompare(b.name))[0];
        const clubs = clubsOfLeague(pack, firstLeague.id);
        if (clubs.length > 0) {
          await startRealCareerInternal(clubs[0].id);
          return;
        }
      }
      await startNewCareerInternal();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to load save.', loading: false });
    }
  }

  async function playTestMatchInternal(): Promise<MatchResult | null> {
    const { league, game } = get();
    if (!league || !game) return null;
    // Season careers do not offer test matches: their legacy results
    // array is frozen, and a test result would create a second
    // competing last-result source. Non-season careers only.
    if (game.seasonData) return null;
    const homeIndex = league.clubs.findIndex((c) => c.id === game.userClubId);
    const awayClub = league.clubs[(homeIndex + 1) % league.clubs.length];
    const result = simulateMatch(league, game.userClubId, awayClub.id, randomSeed());
    const next: GameState = { ...game, results: [...game.results, result] };
    const previousText = JSON.stringify(game);
    const intendedText = JSON.stringify(next);
    try {
      await saveGameState(DEFAULT_SAVE_ID, 'My Career', next);
    } catch {
      // Save-then-set correction: do not set the unsaved result.
      const outcome = await resolveWrite(intendedText, previousText, (adopted) => {
        set({ game: adopted });
      });
      if (outcome === 'adopted') return result;
      set({ error: 'Result could not be saved, so it was not recorded.' });
      return null;
    }
    // Save resolved: verify by reread before setting state.
    const reread = await loadGameState(DEFAULT_SAVE_ID);
    if (!reread || JSON.stringify(reread) !== intendedText) {
      const outcome = await resolveWrite(intendedText, previousText, (adopted) => {
        set({ game: adopted });
      });
      if (outcome === 'adopted') return result;
      set({ error: 'Result could not be verified in storage, so it was not recorded.' });
      return null;
    }
    set({ game: next });
    return result;
  }

  async function continueSeasonInternal(): Promise<boolean> {
    const { league, game } = get();
    if (!league || !game) return false;
    if (!game.seasonData) {
      set({ error: 'Season play is not available for this club\'s league in D5.' });
      return false;
    }
    const data = game.seasonData;
    const issues = validateSeasonData(data, SEASON_MEMBERSHIP_VERSION);
    if (issues.length > 0) {
      set({ error: `Continue is blocked: ${issues.join(' ')}` });
      return false;
    }
    if (data.status === 'complete') {
      set({ error: 'This season is complete. Start the next season to continue.' });
      return false;
    }
    const round = data.currentRound;
    const fixtures = roundFixtures(data.fixtures, round);
    // Replay guard: if any fixture in this round already has a
    // result, write nothing at all.
    if (fixtures.length === 0 || fixtures.some((f) => f.result)) {
      set({ error: 'This round has already been played, so nothing was written.' });
      return false;
    }
    const total = totalRounds(data.fixtures);
    const nextFixtures = data.fixtures.map((f) => {
      if (f.round !== round) return f;
      const result = simulateMatch(
        league,
        f.homeClubId,
        f.awayClubId,
        fixtureSeed(game.seed, data.leagueId, game.season, round, f.homeClubId, f.awayClubId),
      );
      return { ...f, result };
    });
    const userFixture = nextFixtures.find(
      (f) => f.round === round && (f.homeClubId === game.userClubId || f.awayClubId === game.userClubId),
    );
    const nextRecent = [...(game.recentResults ?? [])];
    if (userFixture?.result) {
      nextRecent.push({ season: game.season, round, result: userFixture.result });
    }
    const cappedRecent = nextRecent.slice(-10);
    const isFinal = round === total;
    let nextData: SeasonData = {
      ...data,
      fixtures: nextFixtures,
      currentRound: isFinal ? total + 1 : round + 1,
      status: isFinal ? 'complete' : 'inProgress',
    };
    if (isFinal) {
      const clubsById = seasonClubsById(league, data.leagueId);
      nextData = { ...nextData, championClubId: championOf(tableFor(nextFixtures, clubsById)) ?? undefined };
    }
    const next: GameState = { ...game, seasonData: nextData, recentResults: cappedRecent };
    const previousText = JSON.stringify(game);
    const intendedText = JSON.stringify(next);
    let saveFailed = false;
    try {
      await saveGameState(DEFAULT_SAVE_ID, 'My Career', next);
    } catch {
      saveFailed = true;
    }
    // Whether the save resolved or rejected, decide by rereading
    // storage: never conclude from the promise alone.
    const reread = await rereadStored();
    if (reread.text === intendedText && reread.game) {
      set({ game: reread.game, error: null });
      return true;
    }
    if (saveFailed || reread.text !== intendedText) {
      const outcome = await resolveWrite(intendedText, previousText, (adopted) => {
        set({ game: adopted, error: null });
      });
      if (outcome === 'adopted') return true;
      if (outcome === 'kept') {
        set({ error: 'The round could not be saved, so it remains unplayed. You can try Continue again.' });
        return false;
      }
      set({ error: 'The saved season state could not be verified, so Continue is blocked. Your career has not been deleted.' });
      return false;
    }
    set({ game: next, error: null });
    return true;
  }

  async function startNextSeasonInternal(): Promise<boolean> {
    const { league, game, pack } = get();
    if (!league || !game || !game.seasonData) return false;
    const data = game.seasonData;
    const issues = validateSeasonData(data, SEASON_MEMBERSHIP_VERSION);
    if (issues.length > 0 || data.status !== 'complete') {
      set({ error: 'The next season can only start from a completed season.' });
      return false;
    }
    const clubsById = seasonClubsById(league, data.leagueId);
    const finalTable = tableFor(data.fixtures, clubsById);
    const champion = championOf(finalTable);
    if (!champion) {
      set({ error: 'The completed season has no champion, so rollover cannot proceed.' });
      return false;
    }
    const userRow = finalTable.find((r) => r.clubId === game.userClubId);
    if (!userRow) {
      set({ error: 'Your club is missing from the final table, so rollover cannot proceed.' });
      return false;
    }
    const members = membershipFor(data.leagueId);
    if (!members) {
      set({ error: 'This league has no season membership, so rollover cannot proceed.' });
      return false;
    }
    const record: SeasonRecord = {
      season: game.season,
      leagueId: data.leagueId,
      membershipVersion: SEASON_MEMBERSHIP_VERSION,
      championClubId: champion,
      userClubId: game.userClubId,
      userPosition: userRow.position,
      userRecord: {
        played: userRow.played, won: userRow.won, drawn: userRow.drawn, lost: userRow.lost,
        goalsFor: userRow.goalsFor, goalsAgainst: userRow.goalsAgainst,
        goalDifference: userRow.goalDifference, points: userRow.points,
      },
      finalTable,
      totalRounds: totalRounds(data.fixtures),
    };
    const nextSeason = game.season + 1;
    const nextData: SeasonData = {
      leagueId: data.leagueId,
      membershipVersion: SEASON_MEMBERSHIP_VERSION,
      fixtures: generateFixtures(members, game.seed, data.leagueId, nextSeason),
      currentRound: 1,
      status: 'inProgress',
    };
    // D4 v3 ratings advance only here, via seasonsElapsed = season - 1
    // on the next load/adaptation; the stored season number is the
    // single step that advances them. Ratings are never changed
    // mid-season: Continue does not touch seasonsElapsed.
    const next: GameState = {
      ...game,
      season: nextSeason,
      seasonData: nextData,
      pastSeasons: [...(game.pastSeasons ?? []), record],
    };
    const previousText = JSON.stringify(game);
    const intendedText = JSON.stringify(next);
    try {
      await saveGameState(DEFAULT_SAVE_ID, 'My Career', next);
    } catch {
      const outcome = await resolveWrite(intendedText, previousText, (adopted) => {
        const adoptedLeague = pack ? leagueForGame(pack, adopted) : league;
        set({ league: adoptedLeague, game: adopted, error: null });
      });
      if (outcome === 'adopted') return true;
      set({ error: 'The next season could not be saved, so the completed season is unchanged. You can retry.' });
      return false;
    }
    const reread = await loadGameState(DEFAULT_SAVE_ID);
    if (!reread || JSON.stringify(reread) !== intendedText) {
      const outcome = await resolveWrite(intendedText, previousText, (adopted) => {
        const adoptedLeague = pack ? leagueForGame(pack, adopted) : league;
        set({ league: adoptedLeague, game: adopted, error: null });
      });
      if (outcome === 'adopted') return true;
      set({ error: 'The next season could not be verified in storage, so the completed season is unchanged.' });
      return false;
    }
    const nextLeague = pack ? leagueForGame(pack, next) : league;
    set({ league: nextLeague, game: next, error: null });
    return true;
  }

  async function prepareRestoreInternal(storedId: string): Promise<PendingRestore | null> {
    set({ error: null });
    try {
      const isSnapshot = storedId.includes(':snapshot:');
      const row = isSnapshot ? await readSnapshot(storedId) : await readBackup(storedId);
      if (!row) {
        set({ error: 'That backup could not be found.' });
        return null;
      }
      const backupGame = parseStoredGame(row);
      if (!backupGame) {
        set({ error: 'That backup cannot be parsed, so it cannot be restored.' });
        return null;
      }
      const currentRaw = await loadRawGameState(DEFAULT_SAVE_ID);
      if (currentRaw === null) {
        set({ error: 'There is no current save to replace.' });
        return null;
      }
      // Preserve the current state first, even if it cannot be parsed.
      const currentParsed = (() => {
        try {
          return JSON.parse(currentRaw) as GameState;
        } catch {
          return null;
        }
      })();
      const snapshot = await createSnapshot(
        DEFAULT_SAVE_ID,
        currentRaw,
        currentParsed ? 'pre-restore' : 'pre-restore-corrupted-current',
      );
      const pending: PendingRestore = {
        backupId: storedId,
        snapshotId: snapshot.id,
        sourceHash: sha256Hex(currentRaw),
        backupSeason: typeof backupGame.season === 'number' ? backupGame.season : null,
        backupRound: backupGame.seasonData ? backupGame.seasonData.currentRound : null,
        currentSeason: currentParsed && typeof currentParsed.season === 'number' ? currentParsed.season : null,
        currentRound: currentParsed?.seasonData ? currentParsed.seasonData.currentRound : null,
        currentDeterminate: currentParsed !== null && typeof currentParsed.season === 'number',
      };
      set({ pendingRestore: pending });
      return pending;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Restore preparation failed.' });
      return null;
    }
  }

  async function confirmRestoreInternal(): Promise<boolean> {
    const pending = get().pendingRestore;
    if (!pending) {
      set({ error: 'No restore is prepared.' });
      return false;
    }
    set({ error: null });
    try {
      // The stored state must still match the snapshot's source:
      // if it changed since confirmation was requested, abort.
      const currentRaw = await loadRawGameState(DEFAULT_SAVE_ID);
      if (currentRaw === null || sha256Hex(currentRaw) !== pending.sourceHash) {
        set({
          pendingRestore: null,
          error:
            'The stored career changed since this restore was prepared, so the restore was aborted and nothing was overwritten. ' +
            'The snapshot of your previous state is preserved.',
        });
        return false;
      }
      const isSnapshot = pending.backupId.includes(':snapshot:');
      const row = isSnapshot ? await readSnapshot(pending.backupId) : await readBackup(pending.backupId);
      if (!row) {
        set({ pendingRestore: null, error: 'That backup could not be found.' });
        return false;
      }
      const backupGame = parseStoredGame(row);
      if (!backupGame) {
        set({ pendingRestore: null, error: 'That backup cannot be parsed, so it cannot be restored.' });
        return false;
      }
      await saveRawGameState(DEFAULT_SAVE_ID, 'My Career', row.stateText);
      const after = await loadRawGameState(DEFAULT_SAVE_ID);
      if (after !== row.stateText) {
        // Replacement did not verify: restore the snapshot back.
        const snapshotRow = await readSnapshot(pending.snapshotId);
        if (snapshotRow) {
          await saveRawGameState(DEFAULT_SAVE_ID, 'My Career', snapshotRow.stateText).catch(() => undefined);
        }
        set({ pendingRestore: null, error: 'Restore could not be verified, so your previous state was restored instead.' });
        return false;
      }
      let restored: GameState = backupGame;
      let restoredLeague = get().pack ? leagueForGame(get().pack, restored) : get().league;
      // A restored pre-D5 qualifying save still needs migration;
      // run it inside this same section via the internal function.
      const seasonLeague = seasonLeagueOfClub(restored.userClubId);
      if (seasonLeague && !restored.seasonData && datasetOf(restored).source === 'real') {
        const migrated = await migrateInternal(restored, row.stateText, seasonLeague);
        if (migrated) {
          restored = migrated;
          restoredLeague = get().pack ? leagueForGame(get().pack, restored) : restoredLeague;
        }
      }
      const entries = await loadBackupEntries();
      set({
        game: restored,
        league: restoredLeague,
        backups: entries,
        pendingRestore: null,
        corruptedSave: null,
        error: null,
        ready: true,
        loading: false,
      });
      return true;
    } catch (e) {
      set({ pendingRestore: null, error: e instanceof Error ? e.message : 'Restore failed.' });
      return false;
    }
  }

  return {
    ready: false,
    loading: false,
    saving: false,
    error: null,
    league: null,
    game: null,
    pack: null,
    packError: null,
    quality: null,
    clubStrength: null,
    backups: [],
    pendingRestore: null,
    corruptedSave: null,

    ensureGame: () => runExclusive(ensureGameInternal),
    startNewCareer: () => runExclusive(startNewCareerInternal),
    startRealCareer: (clubId: string) => runExclusive(() => startRealCareerInternal(clubId)),
    playTestMatch: () => runExclusive(playTestMatchInternal),
    continueSeason: () => runExclusive(continueSeasonInternal),
    startNextSeason: () => runExclusive(startNextSeasonInternal),
    prepareRestore: (storedId: string) => runExclusive(() => prepareRestoreInternal(storedId)),
    confirmRestore: () => runExclusive(confirmRestoreInternal),
    cancelRestore: () => set({ pendingRestore: null }),
    refreshBackups: async () => {
      const entries = await loadBackupEntries();
      set({ backups: entries });
    },
  };
});
