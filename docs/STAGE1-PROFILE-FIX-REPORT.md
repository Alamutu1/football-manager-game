# Stage 1 Profile fix — Formation -> Profile — 2 Nov 2026

## Reported problem
On an Android phone, tapping a player's shirt on the Formation pitch
shows that player below the pitch, but tapping Profile then appears
to do nothing. Opening a profile only worked from Squad List.

## Root cause (traced in code)
The Formation Profile handler in `src/app/squad.tsx` did only two
things: set `expandedId` to the selected player, and switch `view`
from `formation` to `list`. It did not:
1. Scroll the Squad list to that player. The list has 26 players, so
   the expanded row was usually off-screen, and the screen still
   showed the top of the list. That looks exactly like "nothing
   happened".
2. Tell the FlatList that its rows depend on `expandedId`. The list
   had no `extraData` and no ref, so an expanded-row change was not
   guaranteed to re-render or become visible, especially on native.

Selected-player state itself was correct: `formationSelectedId`
selected the right player, and `expandedId` was set to that player's
id. Event handling on the Profile button fired; the missing piece
was visibility, not selection. The row toggle in Squad List is
unchanged, so a player already expanded from Formation will still
collapse if its row is tapped again, exactly as in Squad List.

A separate live reproduction in this environment could not reach the
Profile step: the Stage 1 preview stayed on "Loading squad..." in
the browser, with an OPFS/database-handle error noted but not
verified. That failure is browser-environment specific and is not
the phone bug, which is fully explained by the code trace above.
Phone testing on the new preview is still the confirmation step.

## Fix (no tactics, bench, substitutes, XI selection, or D5)
- `src/app/squad.tsx` only, for the Profile path:
  - Profile tap now computes the player's index in the currently
    displayed sorted list with `indexOfPlayer(sorted, selected.id)`
    and stores it in `pendingScrollIndexRef`.
  - A `view`-watching effect scrolls the FlatList to that index
    (`scrollToIndex`, top-ish position) one tick after the list
    view renders, then clears the pending index.
  - The FlatList now has `ref={listRef}`, `extraData={expandedId}`,
    and an `onScrollToIndexFailed` fallback that scrolls near the
    target so its row renders with its profile already expanded.
  - Expanded-row rendering now uses `isProfileExpanded(expandedId, item.id)`.
- `src/game/profile-navigation.ts` (new, pure): `indexOfPlayer` and
  `isProfileExpanded`. No game state, XI, formation, bench, role,
  or engine change.
- `src/components/app-tabs.web.tsx` (type-only, no runtime change):
  `LINKS` is now `as const`. This was needed because generated
  Expo typed routes (created during the 2 Nov Expo Go attempt) made
  the previously passing `tsc` fail on the tab bar's string href.
  No label, order, or navigation behaviour changed.

## Regression tests
- `scripts/test-stage1-profile.mjs` (new, 19 checks): helper
  index/expanded logic, plus wiring guards that the FlatList has
  `extraData`, a ref, a Profile scroll index, `scrollToIndex`,
  a scroll-failure fallback, and that no bench, substitute, or
  formation-selector code was added to the Squad screen.

## Tests run
- `npx tsc --noEmit`: clean.
- `npx eslint` on squad, profile-navigation, test script, and
  app-tabs.web: clean.
- Core 10/10, UI display 26/26, data-pack 22/22, D2 43/43,
  D3 45/45, D4 43/43, Stage 1 profile 19/19.
- Android export: succeeded (bundle, not an APK, as before).
- Web export: verified the exported Squad bundle contains the
  Stage 1 "Squad list" UI text.

## Preview
Fresh temporary Netlify preview, deployed 2 Nov 2026 21:08 WAT,
new site melodious-kulfi-0040bc, Public, old sites untouched:
https://melodious-kulfi-0040bc.netlify.app/squad
It is for phone testing only and is not the production website.

## Still open
Stage 1 remains open until the user personally confirms on their
phone that: tapping a shirt, then Profile, brings the expanded
player profile into view in Squad List, as reliably as selecting
a player directly in Squad List.
