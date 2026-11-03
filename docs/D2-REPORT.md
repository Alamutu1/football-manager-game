# D2 Report — Dataset Loader (2 Nov 2026)

## Result

The game now loads the real-world D1 data pack, browses it offline,
and starts careers from real clubs. All tests pass and the Android
bundle builds with the pack inside it.

## What was built

- `src/game/data-pack-loader.ts` (new, pure, no network, no file
  access): validates a pack via the D1 validator, returns a failure
  object instead of throwing on bad input, and provides the browse
  helpers (`leaguesOf`, `clubsOfLeague`, `playersOfClub`,
  `leagueOfClub`), the version string (`v1@2026-11-02`), age
  calculation from date of birth, Wikidata position mapping
  (goalkeeper/centre-back/full-back/midfielder/winger/...), and
  `adaptPackToLeague`, which converts one real league into the
  game's existing League shape so the store, engine and screens work
  unchanged.
- `src/game/types.ts`: `GameState` gained optional
  `datasetSource` (`'real' | 'fictional'`) and `datasetVersion`.
  Optional fields are the compatibility mechanism: saves written
  before D2 have neither field and keep working.
- `src/game/store.ts`: loads and validates the bundled pack at
  startup (a build-time JSON import, never a fetch). No save ->
  a REAL career by default (first club alphabetically in the
  first league). A legacy fictional save loads exactly as before
  on the seed generator. A real-club save with a failed pack is
  NOT deleted and does NOT crash: the Club screen shows the error
  and offers a fictional career. `startRealCareer(clubId)` refuses
  clubs with no recorded players. New fictional careers are still
  available via `startNewCareer` and record `datasetSource:
  'fictional'`.
- `src/app/leagues.tsx` (new tab): Leagues -> clubs -> players,
  all from the bundled pack, offline. A club's player list has a
  "Select as my club" button that starts a real career and returns
  to the Club tab.
- `src/app/index.tsx` (Club home): real careers show the league
  name and dataset version, "—" for club funds (the pack carries
  no financial data) and "Not rated yet" for Best XI rating.
  The adapter's placeholder numbers are never displayed as ratings.
- `src/app/squad.tsx`: real careers show pack facts — position
  text, age, nationality — with the note "Ratings arrive in D4".
  Fictional careers render exactly as before.
- `src/components/app-tabs.tsx`: added the Leagues tab.

## Honest placeholders (documented in code)

- Engine attributes for real players are uniform 70s (goalkeeping
  70 for goalkeepers, 20 otherwise). These are NOT real ratings
  and are never shown in the UI. D4 replaces them with our own
  tier rating system.
- Club badges use initials + a deterministic colour; funds are 0
  internally and shown as "—".
- Player lists are the pack's recent-era associations, not
  verified current squads (same caveat as D1).

## Test evidence (all run 2 Nov 2026)

- D2 suite `scripts/test-d2-loader.mjs`: **43/43 PASS**. Covers
  pack load + counts (5 leagues, 174 clubs, 6,426 players,
  version v1@2026-11-02); the browse flow Premier League ->
  Arsenal F.C. -> 52 players including Bukayo Saka, all with
  position + date of birth; safe failure (no throw) for null,
  string, empty object, array, dangling player->club and duplicate
  club id; position mapping and age calculation; a 0-player club
  adapting to an empty-but-valid league and the engine playing
  it to 0-0 without crashing; save round-trips preserving
  `datasetVersion`; legacy saves classifying as fictional;
  `generateLeague` still producing 16 clubs / 352 players; and
  the loader source containing no fetch call.
- Existing suites still green: core **10/10**, data-pack **22/22**.
- `npx tsc --noEmit`: clean. `npx eslint` on all touched files:
  clean (one naming collision and one duplicate import found and
  fixed during the run).
- `npx expo export --platform android`: succeeds, bundle
  4.5 MB (was 4 MB in Phase 0). The bundle itself contains
  "Bukayo Saka", proving the real pack ships inside the app.

## Demonstration of the requested flow

Verified end to end in tests and in the shipped bundle:

1. Open the game -> a real career starts by default (or the
   Leagues tab opens the pack browser).
2. Leagues tab -> 5 leagues listed (Premier League, La Liga,
   Serie A, Bundesliga, Ligue 1) with club and player counts.
3. Premier League -> 33 clubs, including Arsenal F.C.
4. Arsenal F.C. -> 52 players, including Bukayo Saka, each with
   position, age and nationality.
5. "Select as my club" -> a career save is written with
   `datasetSource: 'real'` and `datasetVersion: 'v1@2026-11-02'`,
   and the Club tab shows Arsenal with its real squad.

## Still not verified on a real phone

As in Phase 0, the app has never run on the user's phone: the
tap-through above is proven by tests + bundle, not by a device
run. When he tests in Expo Go, the D2 additions to the checklist
are: Leagues tab lists 5 leagues; Premier League -> Arsenal ->
52 players; "Select as my club" makes Arsenal the Club-tab
career; closing and reopening keeps Arsenal and the dataset
version; Squad tab shows real players with position/age, no
ratings.

## D2 requirements checklist

1. Loads the real pack correctly: yes (43/43, incl. real pack).
2. Clubs, leagues, players accessible in the interface: yes
   (Leagues tab + Squad tab).
3. Loader works completely offline: yes (bundled JSON, no fetch;
   bundle contains the data).
4. Dataset versions recorded in saves: yes (`v1@2026-11-02`).
5. Existing SQLite saves remain compatible: yes (optional
   fields; legacy saves load as fictional; no schema change).
6. Invalid/missing data handled safely: yes (failure objects,
   empty-but-valid leagues, 0-0 engine result, error screen).
7. Fictional generator kept for tests, not the default: yes
   (default is real; generator used by test suites + the
   explicit fictional-career button).

D3 is NOT started. It needs the user's approval.
