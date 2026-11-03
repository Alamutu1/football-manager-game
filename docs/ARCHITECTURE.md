# Pocket Club Manager — Technical Architecture

Working title: **Pocket Club Manager**. A Football Manager / Top Eleven style
club management game for Android, built with React Native and Expo.

Status: **Phase 0 foundation** (see ROADMAP.md). This document describes the
target architecture and what Phase 0 actually implements. Anything marked
"planned" is not built yet.

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| App framework | Expo SDK 58, React Native 0.88, React 19 | One codebase, real Android APK via EAS, no native code to maintain |
| Language | TypeScript, strict mode | Catches data-model mistakes before they reach a phone |
| Navigation | Expo Router (file routes in `src/app/`) | Standard Expo routing; every file in `src/app/` is a screen |
| State | zustand | Tiny, no boilerplate, works outside React for the engine |
| Persistence | expo-sqlite (Expo SDK module, included in Expo Go) | Structured saves on-device, survives restarts, no custom native code, no server needed for offline play |
| Match engine | Pure TypeScript, zero UI imports | Testable in plain Node, deterministic, portable |
| Build / release | EAS Build (`preview` profile → APK, `production` → Play Store bundle) | No local Android Studio needed; see ROADMAP Phase 7 |

Deliberately NOT used in Phase 0: AsyncStorage (unstructured, and it is a
community module that needs a dev build instead of running in Expo Go),
a backend server (offline single-player first), real-money or ads SDKs.

## 2. Module map

```
src/
  app/                 # Screens only (Expo Router). No game logic here.
    _layout.tsx        # Tab shell
    index.tsx          # Club home: funds, squad size, best XI, test match
    squad.tsx          # Squad list, sorted by position then rating
  components/          # Template UI pieces + tab bar (app-tabs.tsx)
  constants/           # Theme tokens (template)
  game/                # THE GAME. No react-native / expo imports except storage.ts.
    types.ts           # Player, Club, League, MatchResult, GameState
    rng.ts             # Seeded RNG (mulberry32) + helpers
    names.ts           # Fictional club + player name pools (no real people)
    ratings.ts         # Overall rating from attributes, weighted by position
    seed.ts            # generateLeague(seed): 16 clubs x 22 players, deterministic
    engine.ts          # simulateMatch() — v0 rating-based Poisson goals
    format.ts          # Money formatting
    storage.ts         # SQLite save/load/list — the ONLY file touching the DB
    store.ts           # zustand store: career lifecycle + test-match action
docs/
  ARCHITECTURE.md      # This file
  ROADMAP.md           # Phased plan with exit criteria
```

Rules that keep this clean:

1. **Pure core, impure edge.** `types/rng/names/ratings/seed/engine/format`
   import nothing from React Native or Expo. They run in Node tests.
2. **One persistence seam.** Screens and the store talk to `storage.ts`
   only, never to SQL. Swapping in a cloud backend later means replacing
   one file, not the game.
3. **One engine signature.** `simulateMatch(league, homeId, awayId, seed)`
   stays stable while the inside grows (minute-by-minute play, tactics,
   stamina). Screens never learn how a match is simulated.
4. **Saves store seeds, not worlds.** A save is `{ seed, userClubId,
   season, results }`. The league regenerates deterministically from the
   seed, so saves stay tiny and two devices with the same seed agree on
   the world. This is also the foundation for future multiplayer: players
   can verify each other's results instead of trusting a server.

## 3. Data model (Phase 0)

- **Club**: id, name, shortName, primaryColor, funds. 16 fictional clubs.
- **Player**: id, first/last name, age (17-38), position (GK/DF/MF/FW),
  7 attributes (1-99), overall (position-weighted), potential (ceiling),
  clubId. 22 per club: 2 GK, 7 DF, 8 MF, 5 FW.
- **MatchResult**: home/away club ids, goals, chronological goal events
  (minute, scorer, club).
- **GameState**: seed, userClubId, season, results history.

Planned extensions (later phases, same pattern): contracts (wage, length,
clauses), formations (shape + roles + mentality), fixtures table (one row
per scheduled match), finances ledger (income/expense events), training
schedules, injuries (player, type, days out), youth intake, scouting
reports, season history (standings archive, promotion/relegation).

## 4. Match engine: v0 → v1

**v0 (built, tested in Node):** best XI in a 4-4-2, attack vs defence
turned into expected goals, Poisson-sampled goals, scorers weighted by
shooting, deterministic per seed. Good enough to prove the loop
(club → squad → match → saved result) end to end.

**v1 (Phase 3, planned):** minute-by-minute event stream (chance
creation → shot → save/goal), formation shapes and mentality affecting
chance rates, player stamina and substitutions, in-match injuries,
live text commentary from the event stream. The event stream is the
contract: the UI renders events, the engine produces them, and a saved
event stream replays identically.

## 5. Offline-first and saves

- Everything runs on-device. No network call exists in the game code.
- SQLite table `saves(id, name, state, updated_at)`. Phase 0 keeps one
  career slot (`career-1`); multiple slots are a small storage-layer change.
- Every match result is persisted immediately after simulation, so a
  crash or closed app never loses a result.
- Migrations: when the GameState shape changes, `storage.ts` gains a
  versioned migration before any new field is read. Never silently drop
  an old save.

## 6. Multiplayer-ready seams (not built, designed in)

- **Deterministic engine + seeds:** two clients can simulate the same
  fixture and compare results without a trusted server.
- **Event-sourced matches:** a match is a list of events, which is
  exactly what a network protocol would sync.
- **Repository interface:** `storage.ts` is the single persistence
  boundary; a remote repository (REST/WebSocket) implements the same
  save/load/list shape when online leagues arrive.
- **No real-money code paths** in the core: finances are an in-game
  ledger, so a future online mode does not inherit payment plumbing.

## 7. Testing strategy

- **Node tests for the pure core** (no emulator needed): seed
  determinism, squad shape, rating bounds, engine determinism, event
  consistency (events count = goals, minutes unique and in range).
- **Typecheck + lint** before any phase is declared done
  (`npx tsc --noEmit`, `npx expo lint`).
- **Bundle check** per phase (`npx expo export --platform android`)
  proves the app actually compiles for Android.
- **Phone test** per phase via Expo Go (user's phone): the one step
  this environment cannot do itself. Each phase report states clearly
  what was tested here and what still needs a phone run.
- **APK test** (Phase 7): an EAS preview build installed on a real
  Android device. That is the only honest "it works as an app" check.

## 8. Decisions log

- **Expo over bare React Native:** faster to a real APK, no native
  maintenance, EAS handles signing. Trade-off: anything needing custom
  native code later needs a dev build, not Expo Go.
- **SQLite over AsyncStorage:** structured queries for fixtures,
  standings and history later; included in Expo Go.
- **zustand over Redux:** the state is a single career object; Redux
  ceremony buys nothing here.
- **Fictional data first:** avoids licensing problems with real clubs
  and players, and keeps the game shippable.
- **Portrait-first mobile UI:** management games are one-thumb games;
  landscape comes only if match presentation demands it.
