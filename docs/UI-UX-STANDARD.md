# UI/UX Standard — Pocket Club Manager (project-wide requirement)

Set 2 Nov 2026 by the user: the game must feel like a professionally
designed football management game, not an ordinary database app.
This standard applies to every phase from now on, not as a coat of
paint at the end. Each phase's report must include screenshots of
the new interface.

## Identity: "Night Match" (ours, not a copy)

Football Manager and Top Eleven are visual inspiration only. Nothing
is copied from them: no logos, badges, kits, artwork, layout, or
branding. Our identity is: dark-first (identical on every device,
not following the OS setting), deep green-tinted charcoal surfaces,
one pitch green for actions and selection, one gold accent for
ratings and highlights. Club marks remain initials on deterministic
colours; no official logos, photographs, or kits are used anywhere.

Tokens live in `src/theme.ts` and every screen uses them: background
`#0A0E0C`, surface `#131A16`, card `#1B241F`, border `#2A352E`,
text `#F2F5F1`, muted `#93A29A`, primary `#2FA84F`, gold `#F5B81D`,
elite `#FF7A1A`. Type is system font with weight doing the work:
display 28/800, title 22/800, names 16/600, body 14, captions 12–13.
Overall badges are tier-coloured circles (Developing grey,
Professional green, Established gold, Exceptional orange).

## Screen patterns

- **Dashboard (Club home):** a stadium-style header (pitch-green
  panel with pitch-line motif) carrying the club badge, name, and
  season / league / data chips; then a one-row squad-at-a-glance
  strip (Best XI, squad, verified), the real last result (or an
  honest empty state), one primary action, two secondary actions,
  and a short estimate line plus an About-this-data link. No
  fixtures, news, or financial figures are shown until the feature
  that produces them exists; nothing is invented.
- **Player profiles:** tap any player row to expand in place (no
  separate route yet): avatar, overall + POT + tier, all 8
  attributes as bars with the role's three key attributes
  emphasised, potential, development band, estimated value, and
  association status; a Provisional pill marks non-current players.
  Ratings always carry the "est." mark for real players, and the
  full explanation lives in the Info sheet, not on the row.
- **Avatars:** no photographs exist in the data and none are
  invented. Every player gets initials on a ring coloured by
  position line (GK gold, DF green, MF blue, FW orange), via
  `src/game/player-display.ts`. Same player, same avatar, offline.
- **Squad layouts:** list view (position filter chips in a
  horizontal row, sort and Verified-only controls) plus a
  formation board: the best XI on a realistic striped pitch in
  4-4-2 shape, with full markings (boxes, six-yard boxes, penalty
  spots and arcs, corner arcs, centre circle and spot) and
  shirt-style markers (overall on the disc, name below). Tapping a
  shirt selects that player and shows a detail panel with a Profile
  action. The board is presentation of the same best XI the engine
  uses.
- **Info sheet:** all paragraph explanations (data sources,
  estimate method, status meanings, non-affiliation) live in one
  modal sheet (`src/components/info-sheet.tsx`), opened from an
  "About this data" link on Club, Squad, and Leagues screens. It is
  deliberately not a tab, so main navigation stays uncluttered.
- **League tables, fixtures, transfer screens:** arrive with D5/D6
  work and must follow this standard from the start (cards, chips,
  tier colours, dark surfaces), not as plain tables.
- **Match presentation:** D6/D7. A realistic-looking animated pitch
  with the event stream, using the same palette and type. Match
  presentation is a phase deliverable, not an afterthought.
- **Navigation:** bottom tabs (Club / Squad / Leagues) on a dark
  bar with a green active indicator on Android (native tabs) and
  on web (the web bar uses the same tokens and sits above content
  instead of floating over it); one tap expands a player;
  back navigation returns to the previous list state. Press feedback
  on every tappable row; no dead taps.
- **Small phones:** layouts are checked at 360dp width (and 390dp
  as standard): single-column cards, no fixed wide rows, names
  truncated with numberOfLines, no overlapping or clipped content.

## Motion and polish rules

- Keep motion light and purposeful: press feedback, expand/collapse,
  and screen transitions only. No heavy animation libraries and no
  new dependencies without a reason.
- Numbers that matter (overall, POT, Best XI) are large and bold;
  caveats and provenance are small and muted, never hidden.
- Every new screen or major restyle ships with web-build
  screenshots in the phase report, reviewed before the next phase.
  Screenshots are of the same components as Android; on-phone
  tap-through remains a separate checklist item.

## What this standard does not change

Game logic, ratings, saves, and data are untouched by a restyle.
A UI pass never changes a rating, a result, or a save format, and
it never hides an honest limitation (estimate caveats, Provisional
labels, and association statuses stay visible).
