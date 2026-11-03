# Stage 1 — Formation access and mobile interface (2 Nov 2026)

Scope only: improve access to the existing view-only Formation board and
fix the mobile interface. D5 NOT started. No tactics system, no formation
selector, no engine change, no XI/bench/role/saving change.

## Files changed (3 only)

- `src/app/squad.tsx` — prominent Squad list / Formation switch at the
  top of Squad (two full-width buttons, 44px minimum touch height, tab
  accessibility state). The old List/Formation toggles at the end of the
  wrapped toggle row were removed; sort and Verified-only toggles are
  unchanged. Formation hint now says view-only Best XI.
- `src/components/formation-board.tsx` — honest view-only note under
  the header: the game automatically selects the highest-rated players,
  players cannot be moved and the formation cannot be changed yet.
  Pitch height scales down on narrow phones (480px desktop, 459px at
  360px, 403px at 320px), markers shrink to 64px/40px shirt below 380px
  width, centre circle scales. Spots, order, selection logic unchanged.
- `src/components/app-tabs.web.tsx` — web tab bar is now a horizontal
  ScrollView, so brand + Club/Squad/Leagues scroll instead of squeezing
  or clipping on narrow screens. Links keep a 32px minimum touch height
  and do not shrink. Native Android tabs (`app-tabs.tsx`) unchanged.

## What was NOT changed

Engine (`engine.ts`), best XI (`seed.ts`), roles (`ratings.ts`),
GameState/store, saves, navigation routes. No bench, substitutes, role
assignment, tactical saving, or cosmetic formation selector was added.

## Tests actually run

- `npx tsc --noEmit` — clean.
- `npx eslint` on the 3 touched files — clean.
- Core 10/10, UI display 26/26, data-pack 22/22, D2 43/43, D3 45/45,
  D4 43/43.
- Android export — succeeds, 6.2 MB total in the export output.
- Layout maths (not a device screenshot): at 320/360/390/768/1440px all
  markers stay inside the pitch; web tab content is about 419px, so it
  scrolls at 360/390px and fits at desktop width.

## Remaining issues / honest limits

- No real-phone or live-browser visual check at 360px/390px was done in
  this run; the layout maths above and the compile/export checks are
  what was verified. The user should confirm on their phone that the
  Formation button, tab scrolling, and pitch read as expected.
- Formation remains view-only, exactly as labelled. Full tactical
  management is still paused until the user explicitly approves it.
