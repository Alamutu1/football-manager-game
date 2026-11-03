# Formation investigation — 2 Nov 2026

User report: Formation screen is reachable in the phone browser only in
desktop mode, and the formation cannot be changed. This note records
what the code actually does, so no later phase pretends otherwise.

## What exists today (verified in code)

- Formation is NOT a route or tab. Routes are only `/` (Club),
  `/squad`, `/leagues` (`src/app/`). Formation is a toggle inside
  Squad (`src/app/squad.tsx`, `SquadView = 'list' | 'formation'`).
- `src/components/formation-board.tsx` is view-only. Its own comment:
  tapping a marker selects that player for the detail panel and
  "it never changes the XI". The board title is hard-coded
  "Best XI · 4-4-2", with fixed spot layouts: GK 1, DF 4, MF 4, FW 2.
- Best XI is computed, not chosen: `bestXI()` in `src/game/seed.ts`
  takes the top players by overall per coarse bucket (1 GK, 4 DF,
  4 MF, 2 FW). Squad screen calls it on every render; the selection
  state (`formationSelectedId`) is local `useState` and is lost when
  the screen is left.
- Roles are data-derived, not assigned: `Player.role` comes from
  `roleOf()` in `src/game/ratings.ts` (Wikidata position text) or, for
  fictional players, a central default per bucket (CB / CM / ST).
  Role affects rating weights and key attributes, but the engine uses
  the coarse `Position` bucket, not the detailed role.
- Engine ignores any UI selection: `simulateMatch()` in
  `src/game/engine.ts` calls `bestXI()` itself for both clubs. Its
  header states formations and tactics are NOT yet implemented.
  Attack uses FW+MF shooting+pace; defence uses DF+GK defending /
  goalkeeping blended 85/15 with tactical awareness.
- Saving: `GameState` in `src/game/types.ts` has only seed,
  userClubId, season, results, datasetSource, datasetVersion. There
  is no formation, XI, bench, or role-override field, and the store
  (`src/game/store.ts`) has no save-tactics action — only ensureGame,
  startNewCareer, startRealCareer, playTestMatch.
- Substitutes / bench: no concept anywhere in code, UI, or engine.

## Requested features: existing vs planned

1. Formation selector (4-3-3, 4-4-2, 4-2-3-1, 3-5-2): NOT built.
   Only 4-4-2 exists, hard-coded. Roadmap Phase 2 also lists 5-3-2.
2. Assigning players to positions: NOT built. Tap only selects for
   viewing; there is no slot model and no position picker.
3. Changing the starting XI: NOT built. XI is computed by overall.
4. Selecting substitutes: NOT built. No bench exists.
5. Assigning player roles: NOT built for the user. Roles are derived
   from data. Roadmap Phase 2 plans roles in the XI affecting
   effective attributes; that is not present.
6. Saving tactical changes to the career: NOT built. No GameState
   field, no store action.
7. Engine uses the selected formation and lineup: NOT built. The
   engine recomputes bestXI and would ignore any UI-only XI.

## Why Formation is hard to reach on a phone browser

This is the phone-browser preview, not yet proven for the native
Android app (no real-phone Expo Go run has been confirmed):

- Formation is buried: it is the last of five toggles in the Squad
  header (By overall, By position, Verified only, List, Formation),
  not a tab or screen. On a narrow screen the toggles wrap to
  multiple rows, so Formation is easy to miss.
- Web tab bar (`src/components/app-tabs.web.tsx`) is a single row
  with no wrap: brand "Pocket Club Manager" plus Club / Squad /
  Leagues, gap 20, padding 20 each side. On a true ~360px width that
  totals roughly 390px, so links squeeze or clip. Desktop mode
  widens the viewport, so the tabs fit — consistent with the user's
  report. This is a code-consistent explanation, not a measurement
  taken on the user's phone.
- The earlier ~384px small-screen capture used browser zoom, not a
  true 360px layout width, so it does NOT disprove the tab overflow.
- Once reached, the pitch is 480px tall with percentage-based
  markers, so it scales in width; the main blocker is reaching the
  toggle, not tapping shirts once the pitch is visible.

## What can be done safely in the current phase

Presentation and access only, with no fake functionality:

- Make Formation reachable on mobile: promote the Formation control
  out of the bottom of a wrapped toggle row (for example a clear
  Formation button at the top of Squad, or a dashboard link), fix
  the web tab bar to wrap or scroll on narrow widths, and make the
  pitch responsive. Add an honest "view-only" label until tactics
  are real, so the board never looks editable when it is not.
- Do NOT add a formation picker that only changes the picture while
  the engine still uses bestXI 4-4-2. That would look functional
  while doing nothing, and must not be shipped.

## What belongs in a later phase (needs approval, not started)

- A tactics data model: formation shapes with 11 slots each, slot
  roles (for example full-back vs centre-back, not just DF), XI +
  bench selection with validity rules (11 players, 1 GK, no
  duplicates, position eligibility), and role assignment that
  actually changes effective attributes.
- Saving tactics in GameState with legacy-save compatibility, in the
  same style as the D2 dataset fields.
- Engine change: `simulateMatch` must accept a supplied XI and
  formation instead of recomputing bestXI, with tested formation
  modifiers. Until that lands, any picker is only a picture.
- In-match substitutions, stamina, and mentality/instructions come
  after that; substitutions also need the D6 event stream.

D5 has NOT started. Tactics is not yet assigned a D-deliverable in
the revised plan (original Roadmap Phase 2, UI plan L3 says D5
tactics work); the user should approve where it slots before code.
