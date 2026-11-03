# Assessment: real-world data + animated matches (2 Nov 2026)

This document reports the inspection the user asked for before any
architectural change, and how the new requirements affect the
architecture. **Nothing was deleted or rewritten to produce it.** The
dataset/licensing and engine research behind it is summarised here; the
full sourced research page is linked from the chat report.

## 1. Inspection: what already exists (all intact)

Project: `~/workspace/football-manager-game/`, app name "Pocket Club
Manager", Expo SDK 58, React Native 0.88, TypeScript strict, Expo Router,
zustand, expo-sqlite. Android bundle present in `dist/` (4 MB Hermes
bundle, re-exported after final edits).

Implemented (Phase 0, tested 2 Nov 2026):

- `src/game/types.ts` — Player, Club, League, MatchResult, GameState.
- `src/game/rng.ts` — seeded RNG (mulberry32) + helpers.
- `src/game/names.ts` — fictional club/player name pools.
- `src/game/ratings.ts` — position-weighted overall ratings.
- `src/game/seed.ts` — `generateLeague(seed)`: 16 fictional clubs x 22
  players (2 GK / 7 DF / 8 MF / 5 FW), fully deterministic.
- `src/game/engine.ts` — v0 match engine: best XI, attack vs defence
  expected goals, Poisson-sampled goals, weighted scorers, deterministic
  per seed.
- `src/game/storage.ts` — SQLite saves (one career slot), the only file
  touching the database.
- `src/game/store.ts` — zustand career lifecycle + test-match action.
- `src/app/index.tsx` (Club home), `src/app/squad.tsx` (squad list),
  tab shell in `src/components/app-tabs.tsx`.
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/STATUS.md`,
  `scripts/test-core.mjs`.

Test status: `tsc --noEmit` clean, `eslint` clean, 10/10 Node core
tests pass, Android export succeeds. Not yet tested on a real phone:
app rendering, SQLite save/restart cycle, test-match button wiring
(phone-run checklist in `docs/STATUS.md`).

## 2. Requirement 1: real-world clubs, leagues, players

Headline finding: **do not ship real clubs, players, badges or kits as
built-in content without a licence for that specific right.** A dataset
licence is not a trademark licence, and neither is a player image-rights
licence. Most "free" football data fails at least one of the three for
a commercial, redistributed, offline APK.

What the research found (general information, not legal advice):

- football-data.org: API key for one application, attribution required,
  logos/photos need owner consent, no clear redistribution licence —
  baking a snapshot into an offline APK is high-risk/ambiguous.
- API-Football/API-Sports: may build apps/games but may not resell data
  directly; redistribution and white-label are marked No; offline
  bundling needs written permission.
- StatsBomb Open Data: the primary agreement forbids distribution and
  commercial exploitation even of derived analysis, despite secondary
  sources labelling it CC licences. Research-only, event data only.
- Wikidata structured data is CC0, but CC0 grants no trademark or image
  rights. openfootball/football.json is CC0 for fixtures/results —
  clean for historical structure, but stale, with no squads or ratings.
- Club names alone can draw a claim even without the official logo
  (Manchester United v Sega over Football Manager). EA's rights come
  from layered FIFPro + club + league + individual deals; unlicensed
  clubs in FM/EA FC ship with generic names and placeholder crests.
- Play Store ladder for IP infringement runs rejection, removal of all
  versions, suspension/strike, account termination. Community
  "name-fix" packs originated on PC outside the store; distributing one
  inside a Play APK is materially riskier.
- EA FC / Football Manager ratings are proprietary data work and do not
  become clean by re-upload (e.g. via Kaggle). Ratings must be generated
  from facts with our own formula.

Architectural impact:

- **Survives:** `types.ts` (Player/Club shape, plus a league field and
  a dataset-version field), `ratings.ts`, `storage.ts`, `store.ts`,
  both screens, the save model.
- **Changes:** `seed.ts` stops generating the world and becomes a
  dataset loader; `names.ts` is replaced by a versioned, bundled data
  pack (clubs, leagues, players as JSON/SQLite asset with a licence
  manifest). Saves store the dataset version + entity IDs instead of
  relying on a generation seed alone.
- **New work:** a ratings generator (our own formula from public facts),
  original badge/kit art (no real crests without licence), and a
  licence gate in the build: a data pack ships only when its rights
  are documented.
- **Recommended day-one model:** keep the fictional core shippable, add
  real-world league *structures* in our own words, and add a neutral
  generic custom-league import (no bundled real pack, no hosting,
  linking or marketing of infringing packs). Licence real data later
  once revenue exists. No indie licence price could be verified
  publicly; that itself is a reason not to budget around one yet.

## 3. Requirement 2 + 3: animated matches, RN/Expo vs Unity/Godot

Headline finding: **ship 2D animated matches first; treat 3D as a
flagged v2 prototype.** A Skia top-down animated match driven by the
simulation event stream is shippable inside React Native/Expo with no
second engine, at roughly an order of magnitude less effort than 3D
(no modelling, rigging, or second engine). 3D inside Expo
(expo-gl + three.js) is possible but weakest on low-end Android
devices, with driver variance and frame drops reported; the asset
pipeline (rigged low-poly models, animation set, kit textures, stadium)
is the real cost for a small team.

If 3D later becomes a must, Godot beats Unity for this budget: MIT
licence, $0, no royalties, and it is officially designed as an Android
library (AAR, fragment/activity embedding, bidirectional
communication). Unity as a Library also allows one APK, but is heavier
(80-180 MB retained when unloaded, full-screen only, single instance),
needs a community React Native bridge, and carries per-seat Pro pricing
above its free revenue threshold. Neither has a ready-made React Native
binding for half-screen embedding; both need Expo prebuild/dev builds
(not Expo Go) and a custom native bridge.

Architectural impact:

- **Survives:** the whole manager shell (React Native/Expo), the
  zustand store, SQLite saves, and the simulation core. The v0 engine's
  successor (v1 event stream, roadmap Phase 3) becomes the contract
  that BOTH the 2D view and any later 3D view render from.
- **New layer:** a match presentation module. v1 = 2D Skia view in the
  same app, same APK, no bridge. v2 (only if prototyped successfully)
  = Godot module behind a bridge, with React Native owning the
  canonical save: a JSON fixture snapshot goes in, a JSON result comes
  back, and the result is written to SQLite before returning to the
  shell.
- **What React Native/Expo cannot do alone:** high-quality 3D on
  low-end phones. That is the one gap that justifies a second engine,
  and only for match presentation, never for the manager shell.
- **Do not promise:** 3D at launch, real clubs at launch, or a
  real-names import workaround. All three are explicitly out of the
  launch scope in this assessment.

## 4. Requirement 4: still one offline Android APK with saves

Unchanged and non-negotiable. Every option above was judged against it:

- 2D first: one APK, fully offline, SQLite saves untouched.
- Godot/Unity v2: only acceptable via library embedding into one APK,
  with the React Native shell owning saves. A two-app design (manager
  app + separate match app) would violate this requirement and is
  rejected.
- No server, no live data feed, no streaming: the game must work with
  the phone offline, so no dataset or engine choice may introduce a
  network dependency.

## 5. Roadmap impact (no code changed)

- Insert a data-licensing gate before Phase 1's club/league content:
  Phase 1 builds the season skeleton on the fictional dataset, with
  the dataset-loader seam in place so a licensed pack can replace it.
- Phase 3 (match engine v1) now delivers the event stream + 2D Skia
  match view, not just text results.
- Add a Phase 3b spike (time-boxed, prototype only): Godot library
  embedding proof-of-concept on a real low-end Android phone, judged on
  frame rate and APK size before any commitment to 3D.
- Phase 7 APK milestone is unchanged: EAS preview build, one offline APK.

## 6. What was NOT changed

No file was deleted, no feature was removed, no rewrite was performed.
The fictional league, the v0 engine, the screens, the saves, and all
Phase 0 tests remain exactly as delivered. This assessment only adds
one document and the research page linked from chat.
