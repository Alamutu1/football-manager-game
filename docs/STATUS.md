# Pocket Club Manager — Status log

## Phase 0 — Foundation (2 Nov 2026)

Delivered: Expo SDK 58 + TypeScript scaffold, pure game core (seeded
league generator, ratings, v0 match engine), SQLite career save, Club
home + Squad screens, test-match action, ARCHITECTURE.md, ROADMAP.md.

Tested here (this environment, 2 Nov 2026):

- `npx tsc --noEmit` — clean, 0 errors.
- `npx eslint src/game src/app src/components` — clean, 0 errors,
  0 warnings (after fixing 4 template/core warnings).
- Node core tests (`scripts/test-core.mjs`) — 10/10 pass: seed
  determinism, squad shape (16 clubs x 22 players, 2 GK / 7 DF / 8 MF /
  5 FW), rating/age/potential bounds, best XI shape, engine
  determinism, goal-event consistency, 50-match goal sanity, money
  formatting.
- `npx expo export --platform android` — succeeds, produces a 4 MB
  Hermes Android bundle in `dist/`.

NOT yet tested (needs a real phone run via Expo Go):

- The app actually opening on a device, both tabs rendering.
- The SQLite save cycle: career created, app closed and reopened,
  same club and results still there.
- The Play test match button producing and displaying a result in the UI
  (the engine itself is Node-tested; the UI wiring is not).
- Dark mode rendering on device.

## D5 — Implemented, NOT approved (3 Nov 2026)

Domestic Season Engine implemented strictly to the final reviewed
plan and addenda. Preview: https://beautiful-panda-5f869c.netlify.app/
Full report: docs/D5-REPORT.md. Backup:
~/workspace/pcm-d5-preimplementation-backup-2026-11-03.zip.
Awaiting the user's Android phone test; D5 is not approved until
he says so after that test.

## D4 v3 — Approved (3 Nov 2026)

Calibration v3 (model d4-v3) approved by the user after all five
Android phone tests passed on the temporary preview
https://animated-piroshki-89dbc0.netlify.app/squad.
See docs/D4-V3-APPROVAL-2026-11-03.md and
docs/D4-CALIBRATION-V3-REPORT-2026-11-03.md.
Save structure unchanged; v2 preserved in
~/workspace/pcm-d4v2-backup-2026-11-03.zip.
D5 not started; tactics and Phase C database work remain separate.

Phone-run checklist (when the user tests in Expo Go):

1. App opens on the Club tab showing a club name, funds, squad size,
   best XI rating.
2. Squad tab lists 22 players with position, age, rating, potential.
3. "Play test match" shows a scoreline under "Last test match".
4. Close Expo Go fully, reopen: same club and last result are still there.
5. "Start new career" replaces the club with a fresh league.

Known template issues fixed along the way (not game bugs):

- Template web files failed typecheck out of the box (missing CSS
  declarations, a React 19 / RN Web ref mismatch in the web tab bar).
  Fixed with `src/css-declarations.d.ts` and a simplified web tab bar
  using plain router links. Native Android code was unaffected.
- `npx expo lint` misreports its own ESLint version requirement after
  auto-configuring ESLint 9; `npx eslint` directly is the working lint
  command until that is resolved upstream.
