# D1 report: data-pack schema, licence manifest, snapshot builder (2 Nov 2026)

Status: **D1 complete and tested. D2 has NOT started**, as instructed.

## Deliverables

| File | What it is |
|---|---|
| `src/game/data-pack.ts` | Pack schema + validator (pure TypeScript, no react-native/expo imports). Types: `DataPack`, `DataPackSource`, `DataPackLeague`, `DataPackClub`, `DataPackPlayer`, `ValidationReport`. |
| `scripts/build-data-pack.mjs` | Reproducible snapshot builder (Wikidata + openfootball, CC0 only). Incremental with cached raws, retry-with-backoff on Wikidata errors, `--from-cache` (no network) and `--force-refresh` flags. |
| `scripts/validate-data-pack.mjs` | Validates a pack JSON with the TypeScript validator and writes the report. Exits 1 on any error. |
| `scripts/test-data-pack.mjs` | Automated tests for generation + validation (see below). |
| `data-packs/v1/data-pack.json` | **The pack itself: 1.6 MB, one JSON file, readable offline with no network.** 5 leagues, 174 clubs, 6,426 players, 20 manifest entries. |
| `data-packs/v1/MANIFEST.json` | Licence manifest on its own (same 20 entries as in the pack). |
| `data-packs/v1/validation.json` | Validation report for this pack. |
| `data-packs/v1/cross-check.json` | Wikidata vs openfootball name comparison per league. |
| `data-packs/v1/raw/` | Every raw response (190 files), the audit trail that makes rebuilds reproducible. |

No shipped game code was changed: no screen, store, engine or save
file was touched. The fictional generator stays intact for tests. D2
(the dataset loader) is where the pack first enters the app.

## What was collected (real-world data, snapshot date 2 Nov 2026)

- **Leagues (5):** Premier League (England), La Liga (Spain),
  Serie A (Italy), Bundesliga (Germany), Ligue 1 (France). League
  entities are resolved by label search, never by guessed QIDs.
- **Clubs (174):** all clubs Wikidata associates with those leagues,
  current and historical (for example the Premier League list includes
  Burnley, Cardiff City and Coventry City alongside the 2024-25 clubs).
- **Players (6,426):** recent-era associated players per club: the
  query requires a recorded position and a birth date from 1990
  onward, and a team association with no recorded end date.
- **Fixtures (1,752 matches):** openfootball 2024-25 season files:
  380 matches each for England, Spain and Italy; 306 each for Germany
  and France (18-team leagues). Used for the manifest and the
  cross-check, not yet for career fixtures.

Every manifest entry records: dataset key, source name, source URL,
licence (all 20 are CC0-1.0), attribution requirement, fetched date
and snapshot date, record count, and status (all 20 "ok").

## Examples from the actual pack

- Arsenal F.C. (Premier League): 52 players, including Bukayo Saka
  (winger), Declan Rice (defensive midfielder), David Raya
  (goalkeeper), Cristhian Mosquera (centre-back).
- Real Madrid Club de Fútbol (La Liga): 54 players, including
  Endrick (forward), Dean Huijsen (centre-back), Franco Mastantuono
  (midfielder).
- FC Barcelona (La Liga): 62 players, including Gavi (midfielder),
  Alejandro Balde (full-back), Fermín López (midfielder).
- FC Bayern Munich (Bundesliga): 51 players, including Daniel Peretz
  (goalkeeper), Lennart Karl (winger).
- Paris Saint-Germain FC (Ligue 1): 44 players, including Désiré Doué
  (winger), Lucas Beraldo (centre-back).
- Manchester City F.C. (Premier League): 56 players, including
  James Trafford (goalkeeper), Abdukodir Khusanov (defender).
- All 6,426 players carry a position and a birth date (required by
  the query); 6,251 also carry a nationality.

**Honest caveat on these examples:** the player lists are
associations *as recorded in Wikidata*, not verified current squads.
Spot checks show noise: women's-team and youth associations, and
occasional plainly wrong statements (for example a Monaco player
listed under PSG, a Forest player under Manchester City). The pack
documents this as a currency gap; it does not claim squad accuracy.
D3's coverage work and any later licensed source must narrow this.

## Test results

- **Data-pack suite: 22/22 pass** (`node scripts/test-data-pack.mjs
  /tmp/fm-datapack data-packs/v1/data-pack.json`): 10 fixture tests
  (valid pack passes; dangling league/club, duplicate ids, missing
  licence/attribution/fetch date, unknown manifest reference, and
  non-object input all caught; missing position/birth date reported
  as gaps, not errors; club with no players reported as a gap) plus
  12 real-pack tests (structurally valid, 5 leagues with the right
  names, clubs and players present, manifest complete on all 20
  entries, every entry CC0, no ratings fields smuggled in).
- **Determinism: proven.** Rebuilding with `--from-cache` produced a
  byte-identical `data-pack.json` (verified with `diff`).
- **Offline bundle: proven.** The real-pack tests read the pack from
  disk and perform no fetch at all; the pack is a single 1.6 MB JSON
  file the app can bundle as an asset.
- **Existing core suite: 10/10 pass, unchanged.** `npx tsc --noEmit`
  clean; `npx eslint` on all new files clean (0 errors, 0 warnings).

## Validation report: 0 errors, 0 warnings, 14 gaps

All 14 gaps are `CLUB_NO_PLAYERS`: clubs with no recent-era players
in the pack. Most are defunct or historical clubs (Società Ginnastica
di Torino, U.S. Fiumana, SC Fives, Olympique Lillois, FC Torinese,
Alba Roma 1907, Fortitudo-Pro Roma). Three current clubs also show
up (Toulouse FC, FC Augsburg, Hamburger SV), which means their
Wikidata associations did not satisfy the recent-era query filters
— a data gap, not a validation failure, and a D3 follow-up.

## Cross-check: Wikidata vs openfootball (2024-25)

- Premier League: **20 of 20** openfootball teams matched in
  Wikidata. The 13 extra Wikidata clubs are historical members, not
  errors.
- Other leagues match less on raw strings because of name variants,
  not missing clubs: "Real Madrid CF" (openfootball) vs "Real Madrid
  Club de Fútbol" (Wikidata); "FC Bayern München" vs "FC Bayern
  Munich"; "FC Internazionale Milano" vs "Inter Milan". A name
  normaliser for these variants is a D3 task, not a D1 blocker.
- No club's player fetch failed in the final run (all leagues report
  zero player-fetch failures).

## Bugs found and fixed during D1 (kept here so they are not repeated)

1. **P118 alone matches players and seasons**, not just clubs
   (2,603 raw Premier League hits). Fixed: require instance-of
   association-football-club through subclasses.
2. **Truthy `wdt:P118` hides normal-rank statements** when a
   preferred-rank league statement exists. This silently dropped
   West Ham United. Fixed: read league statements directly
   (`p:/ps:`) at any rank.
3. **A SPARQL query with DISTINCT + a REGEX label filter returned
   zero rows** while the same filters without them returned 59.
   Fixed: dedupe and QID-label filtering happen in code, not in
   SPARQL.
4. **Wikidata HTML error pages (502/504) killed the first build.**
   Fixed: retry with backoff (10s/30s/60s), per-club failure
   isolation, and incremental resume from cached raws.
5. **Argument-parsing bug:** reading `args[indexOf("--out-dir") + 1]`
   without guarding a missing `--out-dir` swallowed `--from-cache`
   as the output directory, sending a cache-only run to a stray
   directory and skipping every league. Found by the determinism
   check, fixed with a guarded parse, stray directory removed.

## Known limits carried forward (not hidden)

- Player lists are recent-era associations, not verified squads
  (see caveat above). No ratings exist yet (D4).
- Club lists mix current and historical members; the game must not
  present a historical club as a current-season club without the D3
  season filter.
- Name variants between sources need normalisation (D3).
- No live data, no logos, no photographs, no proprietary database
  anywhere in the pack. All 20 sources are CC0.
- Rebuild commands:
  `node scripts/build-data-pack.mjs` (incremental),
  `node scripts/build-data-pack.mjs --from-cache` (offline rebuild),
  `node scripts/build-data-pack.mjs --force-refresh` (fresh snapshot),
  `node scripts/validate-data-pack.mjs data-packs/v1/data-pack.json
  data-packs/v1/validation.json data-packs/v1/cross-check.json`.

## Next step (needs approval, not started)

D2: the dataset loader that makes the app read this pack instead of
the fictional generator, with the fictional generator kept for tests.
