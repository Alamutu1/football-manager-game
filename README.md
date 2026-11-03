# Pocket Club Manager

A Football Manager / Top Eleven style club management game for Android,
built with React Native and Expo. Fictional clubs and players, offline
single-player first, modular architecture ready for future multiplayer.

## Current status: Phase 0 foundation

- Fictional 16-club league, 22 players per club, generated from a seed.
- Position-weighted player ratings, v0 deterministic match engine.
- SQLite career save (one slot), results persisted after every match.
- Screens: Club home, Squad list, test-match simulation.

Read `docs/ARCHITECTURE.md` for the technical design and
`docs/ROADMAP.md` for the phased plan to a polished APK.

## Run it

```bash
npm install
npx expo start        # scan the QR code with Expo Go on your phone
```

## Check it (before any phase is called done)

```bash
npx tsc --noEmit      # typecheck
npx expo lint         # lint
npx expo export --platform android   # Android bundle check
```

Pure game-core tests live in `scripts/test-core.mjs` (run with
`node scripts/test-core.mjs` after compiling the pure core files with
`npx tsc src/game/types.ts src/game/rng.ts src/game/names.ts src/game/ratings.ts src/game/seed.ts src/game/engine.ts src/game/format.ts --outDir /tmp/fm-core --module commonjs --target es2020 --skipLibCheck --ignoreConfig`).
Storage (`storage.ts`) and the store (`store.ts`) touch Expo/zustand and
are covered by typecheck and the Android bundle check instead.
They cover seed determinism, squad shape, rating bounds, and engine
determinism and event consistency.
