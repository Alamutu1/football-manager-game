# D5 — Domestic Season Engine: implementation report (3 Nov 2026)

Status: IMPLEMENTED, NOT APPROVED. The user will test the preview on
his Android phone before deciding whether D5 passes. Nothing here
claims approval or completion on his behalf.

Preview: https://beautiful-panda-5f869c.netlify.app/
(temporary Netlify Drop site; previews never hold career storage.)

## Backup and rollback

- Pre-implementation backup: `~/workspace/pcm-d5-preimplementation-backup-2026-11-03.zip`
  (7.3 MB, zip test OK, 855 files). Verified to contain the approved
  D4 v3 `src/game/ratings.ts` (model version d4-v3) and the Stage 1
  `src/app/squad.tsx`, plus the v1 data pack and all prior reports
  and approval records, which were preserved, not rewritten.
- Rollback: restore the project files from that archive and re-run
  the regression suites. Published previews are never promoted if a
  phone-test defect is found; they hold no career storage.

## Files created

- `src/game/season.ts` — fixture generation (seeded circle method),
  table calculation, table cache (in-memory only), validation,
  fixture seeds, terminal-state helpers.
- `src/game/season-membership.ts` — the 96-club 2024-25 top-flight
  membership (Premier League 20, La Liga 20, Serie A 20,
  Bundesliga 18, Ligue 1 18), resolved by pack club id.
- `src/game/state-hash.ts` — pure-TypeScript SHA-256 and FNV-1a
  seed hashing; no new dependency.
- `src/app/fixtures.tsx` — fixtures screen, grouped by round.
- `src/app/table.tsx` — league table screen.
- `scripts/test-d5-season.mjs` — pure-core D5 tests.
- `scripts/test-d5-migration.mjs` — migration/backup/staging/
  snapshot/restore/queue tests (see the honest scope note below).
- `scripts/test-d5-season-full.mjs` — full-season integration test.

## Files modified (approved list only)

- `src/game/types.ts` — added SeasonFixture, TableRow,
  SeasonRecord, RecentResult, SeasonData; GameState gained optional
  seasonData, recentResults, pastSeasons. Nothing removed or renamed;
  legacy `results` stays required and unchanged.
- `src/game/storage.ts` — added `save_backups`, `save_staging`,
  `save_snapshots` tables and verified-insert/read/delete helpers,
  plus raw save read/write. The `saves` table schema is unchanged.
- `src/game/store.ts` — shared write queue, Continue, next-season
  rollover, migration, restore/snapshot flow, and the playTestMatch
  save-then-set correction. Internal functions never enqueue and
  never call public actions; the enqueue path never rejects a
  concurrent external action.
- `src/game/data-pack-loader.ts` — optional `membershipOnly` flag
  on `adaptPackToLeague` (default unchanged, so existing behaviour
  is not altered).
- `src/app/index.tsx` — Club screen season progress, Continue,
  season-end panel, start-next-season, fixtures/table links, backup
  and corrupted-save restore UI. Season careers no longer offer
  "Play test match"; non-season careers are unchanged.
- `src/components/app-tabs.tsx`, `src/components/app-tabs.web.tsx`
  — added Fixtures and Table tabs.
- `.expo/types/router.d.ts` — regenerated automatically by Expo
  when the new routes were added (generated file, not a source edit).

## Features implemented

- Deterministic round-robin fixtures: 20-club leagues 38 rounds /
  380 matches, 18-club leagues 34 rounds / 306 matches; every club
  plays every other club twice (once home, once away) and exactly
  once per round. Same inputs give byte-identical fixtures; same
  fixture order in consecutive seasons is acceptable by design.
- League table from played fixtures only, updated after each round:
  points, goal difference, goals for, club name (code-unit order),
  then club id. Season tables contain membership clubs only.
- Continue advances exactly one round, simulating every fixture in
  that round (including the user's club) with the existing v0 engine
  and deterministic per-fixture seeds. A second Continue, or a
  Continue while another write is running, queues and then advances
  the next round; replaying a played round writes nothing.
- Save and resume: one SQLite save, verified by reread after every
  write; failed or uncertain writes are decided by rereading actual
  storage, never by the rejected promise alone.
- Season completion: after the final round, currentRound becomes
  totalRounds + 1, status becomes 'complete', the champion is
  recorded, and Continue is disabled. Rollover records the compact
  SeasonRecord (final table, user position and record), starts the
  next season with newly generated fixtures, and advances D4 v3
  ratings only through seasonsElapsed = season - 1. Ratings never
  change mid-season.
- Season history: past seasons are kept as compact records only;
  past fixtures and goal events are not retained beyond the final
  table. Recent results hold the user's club matches only, capped
  at 10, labelled by season and round. Legacy `results` is frozen
  for season careers and unchanged for non-season careers.
- Migration: qualifying pre-D5 real saves (member club, no season
  data) migrate to Round 1 of their current season via verified
  backup, verified staging, single replacement and read-back
  verification. Non-qualifying and fictional saves are never
  rewritten on load. Corrupted current saves are never auto-restored
  and never replaced by a fresh career; restore requires a verified
  snapshot first and explicit confirmation, with the exact progress
  difference stated as undeterminable when the current save cannot
  be parsed.

## Tests executed and actual results

All executed 3 Nov 2026, after compiling the pure core with
`npx tsc src/game/*.ts --outDir /tmp/fm-core`:

- `test-d5-season.mjs` — 44/44: membership, fixtures, table,
  cache, validation, hash vectors, D4 progression, loader filter.
- `test-d5-migration.mjs` — 43/43: source-contract checks for the
  storage/store steps plus in-memory simulations of migration,
  queue concurrency, failed/uncertain writes, restore-after-change
  abort, corrupted-current snapshot, and orphan staging cleanup.
- `test-d5-season-full.mjs` — 14/14: a full adapted Premier League
  season simulated round by round (380 matches, 962 goals,
  champion Arsenal in that simulation, user club position verified
  in the test run), terminal state, rollover, recent cap, size bound.
- Regression: core 10/10, data-pack 10/10, D2 loader 43/43,
  D3 quality 35/35 (2 pre-existing SKIPs for missing optional paths),
  D4 ratings 43/43, Stage 1 profile 19/19, UI display 26/26.
- `npx tsc --noEmit` — clean, 0 errors.
- `npx eslint` on all D5 files — 0 errors, 0 warnings.

Honest scope note on the migration/queue tests: expo-sqlite cannot
run in plain Node, so the SQLite tables themselves were not
exercised in the automated suites. Those suites verify the real
code's steps by source contract and exercise the same algorithms
in simulation. The real SQLite path (migration on a pre-D5 save,
backup/restore in the app) is therefore covered by the phone-test
checklist below and by the store's own read-back verification on
every write, not by a Node SQLite test. This limitation is stated
in the delivery report, not hidden.

## Outstanding issues and observations

1. Measured save size — CORRECTION recorded 3 Nov 2026 (the
   delivery report's 221 KB figure was wrong and is superseded
   here; see also the clarification answer of the same day).
   Re-measured for the same simulation (career seed 12345,
   Premier League, season 1) after the table bug was fixed:
   a serialized save at the season-end peak, with one fully
   played season plus 20 past-season records plus 10 recent
   results, is approximately **186 KB**, above the original
   ~150 KB target at that point in the season cycle. Breakdown:
   current-season fixtures 120,347 bytes (fixture/score
   structure 62,079 bytes; goal events 58,268 bytes, 962 events
   at about 60.6 bytes each); season history 62,661 bytes
   (3,132 bytes per completed season); recent results 2,742
   bytes; base fields about 260 bytes. Previous-season fixture
   events are NOT retained: a SeasonRecord holds only the final
   table and the user's record. Growth is linear at one record
   per season (3,132 bytes; verified: 40 records measure exactly
   62,660 bytes more than 20). The current season is a fixed
   size that resets at rollover: unplayed fixtures are 23,775
   bytes, so the same save measures about 87 KB immediately
   after rollover into the next season (under the 150 KB
   target), and about 186 KB at the season-end peak (above
   it). The original target did not specify peak versus
   post-rollover, so both figures are stated. For a fixed
   career seed the measurement reproduces exactly; for a
   different seed it varies by roughly 60 bytes per goal.
   No goal events and no historical information have been
   removed to reduce the size, and none will be removed
   without a separate discussion and decision first.
2. A real bug found and fixed during testing: season tables
   initially included the full adapted league (33 clubs for the
   Premier League) instead of the 20 members. Fixed by filtering
   every table map to membership clubs (store, Club screen, Table
   screen) and covered by the full-season test.
3. Migration and restore on a real device cannot be fully exercised
   from a fresh preview install (a fresh install starts a new
   season directly, so there is no pre-D5 save to migrate). The
   phone checklist therefore covers the paths a fresh install can
   exercise, and migration/restore remain to be exercised when a
   pre-D5 save exists.
4. Save backups interface limitation (recorded 3 Nov 2026, interface
   unchanged, no manual backup feature added): the "Save backups"
   card on the normal Club screen appears only when at least one
   backup or snapshot row already exists, and shows only the 3
   most recent entries. No backup is created by Continue, rollover
   or starting a career, and there is no "Create backup" button in
   the UI. `createBackup` runs only during migration and
   `createSnapshot` only when a restore is prepared, so on a fresh
   install the panel is correctly absent until one of those events
   happens. The corrupted-save screen lists all entries, not just
   3. Testers must not treat the panel's absence on a fresh
   career as a failure.
4. No other outstanding issues. No test was claimed passed without
   being executed; the two test-script failures seen during
   development were test bugs (a literal DELETE check against a
   dynamic query, and a substring slice that included the public
   actions), fixed in the test scripts, not in game code.

## Protected files and excluded systems: untouched

Verified by hash against the pre-implementation backup:
`src/game/ratings.ts`, `src/game/engine.ts`, `src/game/seed.ts`,
`src/app/squad.tsx`, `src/components/formation-board.tsx`,
`app.json` (temporarily switched to static output for the export
and restored byte-identical), and everything under
`data-packs/v1/`. No tactics, transfers, training, injuries,
scouting, finances, facilities, stadiums, cups, European
competitions, promotion, relegation, multi-division expansion,
music, Phase C corrections, new data packs, or 2D/3D match
presentation were introduced. Existing fictional-save behaviour
and legacy test-match behaviour are unchanged.

## Android phone-testing checklist (for the user)

1. Open the preview on your Android phone. A fresh install should
   start a real career (first club alphabetically in the first
   league) with a season panel on the Club screen: "Round 1 of 38"
   (or 34 for Bundesliga/Ligue 1), the 2024-25 top-flight membership
   note, and a Continue button. No "Play test match" button should
   appear for a season career.
2. Tap Fixtures: all rounds are listed, Round 1 shows "vs" (no
   scores yet), and your club's fixture is highlighted.
3. Tap Table: all 20 (or 18) member clubs appear at zero, no extra
   clubs at the bottom.
4. Tap Continue once: Round 1 scores appear on Fixtures, the table
   updates, the Club screen shows Round 2, and Last result shows
   your club's Round 1 result labelled "Season 1 · Round 1".
5. Double-tap Continue quickly: exactly one further round must
   advance (not two, and no round must be replayed or lost).
6. Close the app fully and reopen it: the same club, season,
   round, table and last result must still be there.
7. On the Table screen, check the leader and your position match
   the fixtures played so far; points must be 3 for a win, 1 for a
   draw, and goal difference must match the scores.
8. Tap Squad and Formation: they must work exactly as in Stage 1
   (no overlap, no clipping, Profile still scrolls to the player).
   Report any regression here as a D5 failure, even though those
   files were not touched.
9. If you can reach the final round (or if a later build fast-
   forwards you there): after the final round, the Club screen
   must show "Season complete", the champion, and "Start next
   season" instead of Continue, and tapping Continue must not be
   possible. Starting the next season must show Round 1 again with
   a zeroed table and the previous season preserved in history.
10. Report back pass/fail per item, with screenshots for any fail.
    D5 is not approved until you say so after this test.
