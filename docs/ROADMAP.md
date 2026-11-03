# Pocket Club Manager — Development Roadmap

Goal: a polished, downloadable Android APK. Rule for every phase: **nothing
is claimed as working until it has been tested** (Node tests + typecheck +
lint + Android bundle check here, phone run on the user's device where
noted). Each phase ends with a short report stating what was tested and
what is still untested.

## Phase 0 — Foundation ✅ (this delivery)

- Expo SDK 58 + TypeScript scaffold, Expo Router tabs.
- Pure game core: seeded RNG, fictional 16-club league generator
  (22 players per club), position-weighted ratings, v0 match engine.
- SQLite persistence: one career slot, results saved after every match.
- Screens: Club home (funds, squad size, best XI rating, test match),
  Squad list (position, age, rating, potential).
- Tests: Node core tests, `tsc --noEmit`, `expo lint`, Android export.
- NOT built yet: everything in Phases 1-7. The Club screen says so
  honestly instead of pretending otherwise.

Exit criteria: app bundles for Android; core tests pass; a career
survives an app restart (SQLite); user can run it in Expo Go on their
phone. Phone run still to be confirmed by the user.

## Phase 1 — Club creation + season skeleton

- New-career flow: pick your club from the 16 (or create a custom club:
  name, colours, starting funds tier), manager name, difficulty.
- Fixture generation: full round-robin league calendar for the season.
- League table screen: points, played, won, drawn, lost, goals, live
  from results.
- "Continue" loop: play your next fixture, other fixtures auto-simulated.
- Tests: table maths (3 points/win, tiebreak order), calendar
  completeness (every pair meets twice), save/resume mid-season.

## Phase 2 — Tactics + team selection

- Formation picker (4-4-2, 4-3-3, 3-5-2, 5-3-2, 4-2-3-1) with a pitch
  view; drag or tap to pick the XI and bench.
- Mentality (defensive / balanced / attacking) and basic team
  instructions feeding engine modifiers.
- Player roles in the XI affecting their effective attributes.
- Tests: XI validity (11 players, 1 GK, no duplicates), formation
  modifiers applied in engine outputs, invalid selections blocked.

## Phase 3 — Match engine v1 + match centre

- Minute-by-minute simulation producing an event stream; live
  commentary feed and score bug during "watch" mode, fast result for
  "instant result" mode.
- Stamina, substitutions (3-5 slots), in-match injuries, red cards.
- Match report screen: scorers, ratings, key events, possession/shots
  derived from the event stream.
- Tests: event-stream determinism per seed, substitution rules,
  stats consistency (shots ≥ goals, events chronological).

## Phase 4 — Transfers, contracts, negotiations

- Transfer market: listed players, asking prices from value/age/
  potential formula, bids, counter-offers, deadlines.
- Contracts: wages, length, release clauses, squad-role promises.
- Board expectations: wage budget cap enforced from club funds.
- Tests: funds never go negative through a legal transfer, contract
  expiry handling, negotiation state machine (offer → counter →
  accept/reject/expiry).

## Phase 5 — Training, development, injuries

- Weekly training schedules by attribute group; development curve by
  age and potential (young players grow, veterans decline).
- Injury system: probability per match/training load, types, recovery
  timelines, physio effect.
- Player happiness and form (short-term rating modifiers).
- Tests: growth bounded by potential, veterans decline, injured players
  unavailable for selection, recovery dates respected.

## Phase 6 — Finances, stadium, academy, scouting

- Finance ledger: ticket sales, sponsorship deals (negotiated, tiered),
  wages, prize money, balance sheet screen.
- Stadium upgrades: capacity tiers, cost, construction time, matchday
  income effect.
- Youth academy: seasonal intake of generated 16-18 year olds, youth
  squad, promotion to first team.
- Scouting: assign scouts to regions, reports with accuracy by scout
  quality, shortlist.
- Tests: ledger balances (income − expenses = funds delta), upgrade
  timers, intake ages and potentials in range.

## Phase 7 — Seasons, cups, polish, APK

- Multi-season loop: end-of-season awards, promotion/relegation
  between two divisions, ageing and retirements, new intake.
- Cup competition: knockout draw, two-legged or single ties, cup
  history.
- Polish: app icon, splash screen, onboarding, settings (sound off by
  default — no audio assets yet), accessibility pass, performance pass
  (list virtualization, memoised selectors).
- **EAS preview APK**: `eas build --platform android --profile preview`
  (needs a free Expo account — user's step), installed and played on a
  real Android phone. This is the first "downloadable APK" milestone.
- Play Store submission is a separate, later step (store listing,
  signing, review) and is not promised in this roadmap's APK milestone.

## Phase 8 — Multiplayer (future, after the APK is solid)

- Online leagues built on the architecture seams: deterministic engine
  + event streams + repository interface (see ARCHITECTURE.md §6).
- Accounts, league invites, turn deadlines, anti-cheat by result
  verification. Scoped only after single-player is stable and shipped.

## How phone testing works (user is phone-only)

1. Install **Expo Go** (free) on the Android phone.
2. This environment runs `npx expo start` and shows a QR code; scanning
   it loads the current build on the phone over the network.
3. Each phase report lists exactly what to tap and what should happen,
   so a phone run takes minutes.
4. APK testing (Phase 7) needs no Expo Go: the APK installs directly.

## Cost note

Everything in Phases 0-6 uses free tooling. EAS Build has a free tier
that covers preview APK builds; if the free allowance is ever hit, the
fallback is a local build, which needs Android Studio and is not
phone-feasible — so the plan stays inside the free tier.
