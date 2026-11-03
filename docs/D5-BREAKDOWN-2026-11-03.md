# D5 Breakdown — Season Skeleton (for review, NOT started)

Status: proposal only, 3 Nov 2026. No code changed, no D5 work begun.
D4 v3 is the approved rating system. Tactics and background music
are roadmap items, NOT D5 scope, unless the user explicitly adds them.

## What D5 is, in one line
Turn the current single test match and season number into a playable
season: a fixture calendar for the user's league, a league table that
updates as rounds are played, a Continue loop that advances the season
round by round, and save/resume that survives closing and reopening
the app mid-season.

## Current state D5 starts from
- GameState already has a season number, a results list, a club and a
  league, and D4 ratings advance with seasons elapsed (season − 1).
- The engine can already simulate one match deterministically, but
  there is no fixture list, no table, no round progression, and no
  season-end step. The "Play test match" button is a test, not a season.
- The pack has 5 leagues and 174 clubs, but club membership mixes
  current and historical clubs, and 14 clubs had no recent-era players
  in D1 (3 duplicate entities + 11 historical/defunct). Fixture
  generation cannot simply use every pack club in a league.

## Objectives
1. A complete, fair fixture calendar for the user's league.
2. A correct league table after every round.
3. A Continue loop the user can play through to the end of a season.
4. Mid-season save/resume that never loses a round or double-counts one.
5. A clean season rollover into the next season, with D4 ratings
   advancing by one season, and no save corruption for older saves.

## Expected changes (if approved)
- Game core (pure, tested in Node first):
  - Fixture generator: round-robin, home and away, one match per club
    per round, every pair meeting twice, in a seeded order so the
    same career always generates the same calendar.
  - League table calculator: played, won, drawn, lost, goals for,
    goals against, goal difference, points (3/1/0), sorted by points,
    then goal difference, then goals for, then name as a final
    deterministic tiebreak.
  - Season state: current round, fixtures played/remaining, table
    snapshot, season status (in progress / finished).
  - Continue step: simulate or play the next round's fixtures
    (user's match uses the existing engine; other matches use the
    same engine), update the table, save immediately.
  - Season rollover: declare the champion, reset fixtures and table
    for the next season, advance the season number so D4 ratings age
    by one season, keep the club and its history.
- Save: fixtures, table and season progress must be stored. This is
  the one place D5 touches save shape. Legacy saves (season number
  only, no fixtures) must migrate safely: either generate a fresh
  season for the stored club and season, or start a new season, with
  the migration rule stated and tested before any save is written.
  No existing save may be deleted or corrupted by the migration.
- UI (Night Match standard, screenshots per phase):
  - Fixtures screen: rounds, dates in game-season order, results,
    next round highlighted, user's match highlighted.
  - Table screen: full league table, user's club highlighted,
    form/position movement if cheap to add, otherwise deferred.
  - Club home: season progress (round X of Y), next opponent,
    Continue button, current position.
  - Season-end screen: champion, final table, rollover button.
- Labelling: fixtures and results in D5 are game-generated season
  fixtures, NOT the real 2024–25 schedule and NOT real results.
  The UI must say so wherever fixtures appear, so a game season is
  never mistaken for a real fixture list.

## What D5 does NOT include
- Tactics: no formation selector, no XI/bench selection, no roles,
  no saved tactics, no engine use of user tactics. The Best XI stays
  automatic in D5, exactly as in Stage 1. Tactical freedom is a
  separate, essential future phase, to be scoped and approved on
  its own.
- Transfers, contracts, training, development choices, injuries,
  finances, stadium, academy, scouting, cups.
- Match view: no 2D or 3D animated match, no match centre event
  stream presentation. Those are D6 (event stream) and D7 (2D view).
- Background music: no audio, no Settings music toggle in D5.
  Music with an ON/OFF option in Settings stays on the roadmap
  as its own item.
- Phase C database fixes: no duplicate merging, no added players,
  no position reclassification, unless separately approved.
- No new data pack, no licence change, no real logos or photos.

## Decisions the user needs to make before D5 starts
1. League membership for fixtures: which clubs count as in a league
   for a season? Options: (a) only clubs with at least one recorded
   player, (b) all pack clubs in the league, (c) a curated current
   membership list. Historical and duplicate clubs make (b) wrong;
   (a) is the simplest safe default, but it changes league sizes
   per league and must be shown in the UI.
2. Season length: full home-and-away round-robin (for a 20-club
   league, 38 rounds) or a shortened first season? Full is the
   honest football shape; shortened is faster to test and play.
3. Other matches: simulated automatically when the user continues,
   or played one by one? Automatic simulation of the round is the
   standard management-game shape and the simplest first step.
4. Season end: what happens at rollover — same clubs next season,
   or promotion/relegation? Promotion/relegation cannot be real
   without second divisions, which are not in the pack, so the
   honest D5 default is same clubs next season, with
   promotion/relegation deferred and labelled as such.
5. Ratings within a season: frozen at the season-start snapshot, or
   advancing round by round? Frozen is simpler and preserves
   determinism; advancing mid-season is more realistic but changes
   every table and result calculation. Recommendation: frozen
   within a season, advancing only at rollover (this matches how
   D4 is already wired).
6. Save migration rule for legacy saves (see Expected changes).

## Risks
- Fixture maths: a broken generator (a club playing twice in a
  round, a pair meeting once instead of twice, a missing round)
  corrupts the whole season. This is the highest technical risk
  and the reason fixture tests come first.
- Table maths: wrong points, goal difference or tiebreak order
  makes the table untrustworthy. Every table test must use
  hand-computed examples, not just the code's own output.
- Save/resume: a crash or close between simulating a round and
  saving it can lose or duplicate that round. The Continue step
  must be atomic: simulate, update, save, then show — in that order.
- Save migration: older saves have no fixtures. A careless
  migration could overwrite a real career or invent a season.
  Migration must be tested on legacy fixtures before release.
- League membership: including historical or duplicate clubs
  produces nonsense fixtures (defunct clubs playing a season).
  Excluding them silently produces a league that does not match
  the club browser. Membership must be explicit and visible.
- Performance on a phone: a 20-club, 38-round season means 380
  matches per season. Simulating a whole round at once must stay
  fast on a low-end Android phone; if it is slow, simulate lazily
  per round, not per season.
- Real-vs-game confusion: a fixture list that looks like a real
  schedule could be mistaken for real fixtures. Labelling (above)
  is a requirement, not polish.
- Scope creep: tactics, transfers and match view are all tempting
  to add "while we are here". Each is a separate phase with its
  own approval. D5 must stay a skeleton, or it never finishes.

## Testing requirements (before D5 is called done)
- Unit tests, all in Node before any UI:
  - Fixture completeness: every pair home and away exactly once;
    no club twice in a round; every round complete; total rounds
    and matches match the league size.
  - Table maths: hand-computed points, goal difference and
    tiebreak cases, including a three-way points tie.
  - Continue loop: one round advances exactly one round, updates
    the table by exactly that round's results, and cannot be
    applied twice to the same round.
  - Save/resume: save mid-season, reload, continue — table and
    round identical; reload an older legacy save — migrates
    without data loss and without inventing results.
  - Season rollover: final table frozen, champion recorded,
    new season fixtures generated, season number +1, D4 ratings
    advance one season.
  - Determinism: same seed and same Continue sequence gives the
    same fixtures, results and table every time.
- Regression: core 10/10, data-pack 22/22, D2 43/43, D3 45/45,
  D4 v3 43/43, UI 26/26, Stage 1 profile 19/19, tsc clean, lint clean.
- Phone preview tests (temporary preview, same as D4 v3):
  1. Fixtures screen loads and shows a complete round list.
  2. Table screen loads and matches a hand-checked round.
  3. Continue advances one round and the table updates.
  4. Close and reopen mid-season: same round, same table, no
     duplicated round.
  5. Season-end screen and rollover work, and the next season starts.
- Screenshots of Fixtures, Table, Club home progress and
  Season-end, per the UI standard, before approval is requested.
- Approval gate, same as every phase: Build → Test → Verify →
  Approve → Advance. D5 is not done when the code is written;
  it is done when the tests above pass and the user approves it
  on a phone preview.
