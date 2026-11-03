# UI/UX Review and Visual Improvement Plan — Pocket Club Manager

Status: APPROVED by the user 2 Nov 2026, then IMPLEMENTED as UI
Phase 1 the same day. D5 has NOT started and remains gated on the
user's review of the improved interface. Screens marked CONCEPT in
the original proposal were proposals, not screenshots; the
implementation note and screenshots are appended at the end of this
document once the screenshot pass completes.

## Screenshots reviewed (current interface, 2 Nov 2026)

- `docs/screenshots/shot-ui-club.png` — Club dashboard (dark theme).
- `docs/screenshots/shot-ui-squad.png` — Squad list.
- `docs/screenshots/shot-ui-formation.png` — Formation board.
- `docs/screenshots/shot-ui-player.png` — Expanded player row.
- D4 set (`shot-club-d4.png`, `shot-arsenal-players-d4.png`,
  `shot-arsenal-expanded-d4.png`, `shot-squad-d4.png`) — same
  screens before the dark theme.

All screenshots are the web build of the same components as
Android. One important correction to the review: the white pill bar
at the top of every screenshot is the WEB preview's tab bar, not the
Android tab bar. Android uses native tabs, which the last pass
already themed dark with a green active indicator. The web bar still
needs the same dark theme so previews stop misleading the review.
That fix is in the Now list below.

## Findings — what a player actually feels

1. **Dashboard reads like a stats page, not a club home.** Stat
   cards are clean but flat: no club identity beyond a badge, no
   stadium or matchday feeling, no fixtures, results, form, or news.
   A manager opening the game should immediately feel which club
   this is, who they play next, and what needs attention.
2. **Navigation looks disconnected in every screenshot.** The white
   web bar floats above a dark app with no shared colours, icons, or
   active state. Even on Android, the tabs are only labels plus two
   generic icons; there is no visual system tying navigation to the
   rest of the game.
3. **Squad rows are database rows.** Every player looks identical:
   a green circle with a position code, a name, a line of facts, a
   number. There is no face, no shirt, no visual difference between
   a star and a squad player, and five filter pills in two rows push
   the list down. Long sublines wrap awkwardly ("Age 35 · Germany ·
   Conflicting · Provisional" over two lines).
4. **The pitch is flat.** One solid green, thin lines, dark
   rectangles for players. No mowing stripes, no penalty arcs, no
   corner arcs, no centre spot, no shirt-style markers. Positioning
   is correct (4-4-2) but it does not look like a football pitch.
5. **Player detail has no hierarchy.** The expanded row is a plain
   label/value list. Attributes should read at a glance (bars, key
   attributes emphasised), with one hero number, not eight equal
   rows. The caveat paragraphs repeat on every screen and bury the
   actual content.
6. **No icons, one type voice.** Everything is system text at
   similar weights. Section headers, actions, and data all compete.
   Numbers that should shout (overall, score, next match) do not.
7. **Mobile fit is mostly good, with watch items.** No overlapping
   content was found in the app itself; the apparent overlaps in
   screenshots are viewport cuts (content below the fold) and the
   web badge clipping at the top (web chrome overlap, not an
   Android layout bug). Still, long names (Spencer-Adams, Widemann),
   narrow 320–360dp widths, and two-row pill bars need a real audit
   before any claim of "no clipping" is made.

## Design direction (refines Night Match, does not replace it)

Keep the dark-first identity, palette, and tokens from
`docs/UI-UX-STANDARD.md`. Add, in this order:

- **Stadium header:** a gradient banner (deep green to black, with
  a subtle pitch-line motif drawn in code, no photographs) behind
  the club badge, name, and league. Identity first, numbers second.
- **Avatars without photos:** no player photographs exist in the
  data and none may be invented or scraped (licensing). Every
  player gets a deterministic avatar: initials on a position-coloured
  ring, with the overall badge. Same player, same avatar, every
  load, fully offline, zero cost. This is the honest premium-feeling
  solution inside the constraints.
- **Jersey markers:** formation chips become shirts — a coloured
  disc with the overall number, name below, role above. Tap a
  marker to open that player's profile sheet.
- **Real pitch:** mowing stripes (alternating greens), full
  markings (boxes, penalty arcs, corner arcs, centre spot and
  circle), realistic proportions. All drawn with views and borders,
  no images, no new dependencies.
- **Icons:** one free, Expo-bundled, offline icon set
  (@expo/vector-icons, already a transitive Expo dependency) for
  navigation and section headers only. If the user prefers zero new
  direct dependencies, the fallback is labels plus shapes, with no
  other change to the plan.
- **Type scale:** display 28/800 for club names, 22/800 for section
  titles, 16/600 for names, 13 muted for facts, 12 for caveats.
  Overall numbers stay large and tier-coloured.
- **Info section:** all paragraph explanations (data sources,
  estimate method, D3 status meanings, offline note, version) move
  into one Info screen reachable from every screen. Primary screens
  keep only the short markers that carry the distinction: "est."
  next to real overalls, Provisional badges, and status labels.
  Nothing about honesty is removed; paragraphs move, markers stay.
- **Motion:** press feedback, expand/collapse, and screen
  transitions only. No heavy animation libraries.

## Proposed screens (CONCEPT — see the mockup widget)

1. **Dashboard:** stadium-gradient header with badge, name, league
   chip; Next Fixture hero card (opponent badge, date, competition);
   Recent Results strip (last results as W/D/L chips plus scores);
   Form guide dots; Management Alerts card (squad issues needing
   attention); stat strip (Best XI, squad, verified); News card.
   Data note: next fixture, results, form, and news content arrive
   with the D5 season skeleton; the header, stat strip, and last
   test match exist today.
2. **Squad:** one filter row (position chips All/GK/DEF/MID/FWD)
   plus a sort control, replacing five pills in two rows. Player
   cards: avatar (initials + position ring), name, role chip,
   nationality, age, tier-coloured overall badge, POT. Tap opens
   the profile sheet. Search is a later addition (needs no new
   data, but adds interaction scope).
3. **Player profile:** full sheet, not an expanded row: big avatar,
   name, role, club, nationality, age; hero overall + tier label;
   8 attribute bars with values (key attributes for the role
   emphasised); potential, development band, estimated value;
   association line with Provisional where applicable; a single
   "About these ratings" link to the Info section.
4. **Tactics / formation:** striped realistic pitch with full
   markings; jersey markers (overall on the shirt, name below);
   tap a marker for the profile sheet; formation selector (4-4-2
   now; other shapes with D5 tactics); team rating header; bench
   list below the pitch. The board still shows the same best XI
   the engine uses.
5. **Fixtures:** matchweek/date-grouped list; each row: date chip,
   home badge vs away badge, competition, venue, score or kick-off
   time; the next match highlighted. All fixture/result data comes
   from D5; the screen itself is presentation and must not invent
   fixtures before D5 generates them (empty state until then).
6. **Matchday:** score bug (teams, score, minute), pitch view,
   event feed (goal, chance, save, with minute), momentum bar, and
   a stats strip (possession, shots). Needs the D6 event stream
   and D7 2D view; the mockup is the target, not a working screen.

## What can be implemented safely NOW (no feature dependency)

These change presentation only. No rating, result, save, or data
change; no new data is invented; offline working is untouched.

- N1. Dark web tab bar matching Android, plus polished bottom
  navigation (dark bar, icons, labels, green active indicator) on
  both surfaces.
- N2. Avatar component (initials + position ring) on squad rows,
  formation markers, and profile sheets. Deterministic, offline.
- N3. Realistic pitch: stripes, full markings, jersey markers with
  tap-to-profile, formation header with team rating.
- N4. Dashboard header upgrade (stadium-gradient banner, hierarchy,
  stat strip) and last-test-match as the Recent Result until D5
  supplies league results. No fake fixtures: the Next Fixture card
  shows an honest empty state until D5.
- N5. Info section screen + trimming primary-screen paragraphs to
  markers plus an info link. Estimate distinction stays visible.
- N6. Typography, spacing, and icon pass across existing screens,
  plus the small-screen audit (320/360/390/430dp, long names, tap
  targets, portrait layout). Fresh before/after screenshots after
  implementation.

## What must wait for its phase (data does not exist yet)

- L1. Fixtures list, results, form guide, league table (D5 season
  skeleton generates fixtures and results).
- L2. News feed content (D5/D6 season events generate items).
- L3. Tactics: formation selector beyond 4-4-2, roles, instructions
  (D5 tactics work).
- L4. Matchday live presentation and animated pitch (D6 event
  stream, D7 2D match view).
- L5. Transfers screen (needs the transfer feature, post-D5).
- L6. Full player-profile route with history and season stats
  (needs season data; the sheet in N2/N3 is the interim profile).

## What will not change

Existing features, real clubs and players, saves, offline working,
and the React Native/Expo architecture are untouched by the Now
items. No expensive external service and no paid dependency is
introduced; the only candidate new dependency is the free
Expo-bundled icon set, with a labels-only fallback. No player
photographs, official logos, kits, or badges are used at any point.

## Approval asked

Approve this plan and the Now list (N1–N6) for implementation, or
ask for changes to any screen. On approval: implement N1–N6, take
fresh before/after screenshots, and report before any D5 work. D5
remains gated on both the D4 review and this plan's review.

## UI Phase 1 implementation note — 2 Nov 2026, after screenshots

Implemented as presentation only: player avatars (initials on
position-coloured rings), attribute bars with key-attribute emphasis,
dashboard stadium header and stat strip, striped formation pitch with
full markings and shirt markers, Info modal via "About this data",
dark web tab bar matching Android dark/green tabs. No logic, data,
ratings, or save changes; no new dependency; no invented fixtures,
results, news, or financial information.

After screenshots, captured 2 Nov 2026 from a temporary Netlify Drop
preview of a static export of the same build (preview URL
https://frolicking-yeot-51e768.netlify.app/, site name
frolicking-yeot-51e768, to be deleted after user review; preview
only, not the production app). The browser tool could only save page
renders as PDF, not PNG screenshots, so the after captures are PDFs:
- docs/screenshots/shot-ui-phase1-dashboard.pdf — Club home,
  1. FC Heidenheim 1846, Season 1, Bundesliga, Data v1@2026-11-02,
  69 est. Best XI, 26 Squad, 18/26 Verified, "No match played yet".
- docs/screenshots/shot-ui-phase1-squad.pdf — Squad list, 26 players,
  average 67, 18 current / 8 conflicting, position chips, avatars,
  overall badges.
- docs/screenshots/shot-ui-phase1-player.pdf — Expanded Kevin Müller,
  GK 81, Pace 36, Shooting 23, Passing 52, Dribbling 36, Defending 13,
  Physical 53, Goalkeeping 96, Tactical 60, Potential 81, Conflicting.
- docs/screenshots/shot-ui-phase1-formation.pdf — Formation 4-4-2,
  Best XI rating 69, "Tap a shirt on the pitch", Kevin Müller card.
- docs/screenshots/shot-ui-phase1-dashboard-smallscreen.pdf —
  Dashboard at about 384px effective width (500% zoom, browser could
  not be resized to exactly 360px), header/tabs/stat strip fully
  visible with no overlap or clipping observed in the capture.

Verification: captures show the new dark tabs (no old white pill
bar), avatars, and pitch, matching the latest build strings in the
static export. One transient web reload stuck on "Loading your
club..." with a storage-access error and cleared on retry; no other
screen failed. Small-screen evidence is approximate (about 384px, not
exact 360px); the user should also open the preview on his own phone.

Android export, fresh 2 Nov 2026: npx expo export --platform android
--output-dir dist-android succeeded, 6.2 MB total, 5 MB Android
bundle, 35 assets, metadata.json. No code changes since UI Phase 1.

D5 NOT started. It remains gated on the user's review of D4 and of
these after captures.
