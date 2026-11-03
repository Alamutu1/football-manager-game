# D4 Report — Player Rating and Attribute System (implemented)

Status: implemented and tested, 2 Nov 2026. Approved design v2
(`docs/D4-DESIGN.md`), plus the six additional safeguards the user
added with approval. D5 has NOT started.

## What was built

- `src/game/ratings.ts` — extended (it already held the Phase 0
  `overallFor`): 10 roles, role templates, role overall weights,
  8 attribute-specific age curves, seeded per-player signature
  (strength / weakness / ceiling bonus), development rate, per-season
  step simulation (floats internally, rounded at the end), tiers,
  estimated transfer values, model metadata, club-strength loading.
- `scripts/build-club-strength.mjs` → `data-packs/v1/club-strength.json`
  (derived file; the frozen v1 pack is untouched): 95 of 174 clubs
  ranked from their own 2024–25 openfootball results, modifier +4
  (champion) to −4 (last). The other 79 clubs are absent and read as
  modifier 0. Spot-checked: Arsenal +4 (74 pts, GD +35, rank 2/20),
  Liverpool +4 (84 pts, GD +45, rank 1/20), PSG +4 (84 pts, GD +57,
  rank 1/18).
- `src/game/types.ts` — `Attributes` gains `tactical`; `Player`
  gains `role` (required) and `developmentRate` (optional, real
  players only). No `GameState` field was added, renamed, or
  removed: seasons elapsed come from the stored season number.
- `src/game/data-pack-loader.ts` — the D2 uniform-70s placeholders
  are gone. `adaptPackToLeague` now computes D4 ratings per player
  (snapshot league/club modifiers, seasons elapsed as a parameter),
  and `ratingForPackPlayer` computes ratings on the fly for browsing.
- `src/game/store.ts` — bundles the club-strength table (same
  version-match-or-null rule as the D3 overlay), passes it and
  `season − 1` into the adapter for saved real careers.
- `src/game/seed.ts` — fictional generation kept (test path), plus
  the `tactical` attribute and the central default role per bucket.
  Fictional `developmentRate` stays unset; the UI shows no band.
- `src/game/engine.ts` — defence is now 85% defending/goalkeeping +
  15% tactical, so tactical development matters in matches and pace
  decline directly weakens attack. Attack, Poisson scoring, scorer
  weights, and best-XI shape are unchanged.
- UI — `src/components/attribute-grid.tsx` (new); Squad and Leagues
  player rows show overall (marked "est." for real players), role,
  tier, and POT, expand on tap to all 8 attributes, potential,
  development band, estimated value, Provisional note where the D3
  status is not verified current, and the PCM-estimate caveat. Squad
  gains By-overall / By-position sorting and a Verified-only filter
  (Leagues players view gains the filter too). Club home shows Best
  XI rating (est.) instead of "Not rated yet", plus the estimate
  footer. Association status and rating basis are shown separately:
  a verified association does NOT make the rating verified.

## The six approval safeguards, with evidence

1. **Club modifier cannot make an ordinary player exceptional.**
   The modifier is ±4 on attributes, so it moves an overall by at
   most 4 points (tested over all 6,426 players, max delta 4 after
   isolating the club term). Tested explicitly: zero players with a
   no-modifier overall ≤74 reach Exceptional (≥83) with the club
   modifier applied.
2. **Profiles stay believable and positionally appropriate.**
   Role templates plus a per-player signature (every attribute ±9,
   one strength +7..+13, one different weakness −7..−13) give zero
   identical 8-attribute profiles across 6,426 players, and role
   contrasts hold (shooting ST vs CB, goalkeeping GK vs ST, pace W
   vs CB differ by 20–65 points on average).
3. **Development is consistent across transfers and loans.**
   `computeRating` takes no current-club input at all: it takes a
   snapshot-anchored club modifier. The loader passes the pack
   (snapshot) club's modifier. A future transfer changes clubId but
   must keep passing the snapshot modifier, so the player's prime,
   potential, rate, and trajectory are untouched. Tested: the
   0–5-season trajectory is identical when recomputed with the
   anchor preserved.
4. **Estimates are distinguished from verified data.** Every profile
   carries modelVersion "d4-v2", basis "model-estimate", and the
   evidence list ["position", "age", "club-results-2024-25"]. The UI
   shows "est." next to real overalls and states "model only, no
   individual performance data" in expanded rows and footers. The
   D3 association status is a separate line and is never used to
   imply a verified rating.
5. **Deterministic and reproducible.** All rating functions are
   pure; same inputs give byte-identical profiles and trajectories
   (tested). Seasons are simulated from the snapshot each time, so
   there is no stored-attribute drift between loads.
6. **Tested: young, veteran, exceptional, transfers, multi-season.**
   See the test list below: T3 slow-developer stall, veteran pace
   vs tactical decline, exceptional tier membership, the transfer
   anchor contract, and 0/1/3/5-season trajectories for six named
   players, plus the full distribution and match-effect checks.

## Actual player profiles (shipped code, snapshot season)

- Bukayo Saka, W, 25, Arsenal: PAC 84, SHO 77, PAS 66, DRI 84,
  DEF 36, PHY 75, GK 10, TAC 65 → overall 76, potential 77,
  Established, Steady, est. value €10.5m.
- William Saliba, CB, 25, Arsenal: DEF 93, PHY 88, TAC 78 →
  overall 81, potential 85, Established.
- Alisson Becker, GK, 34, Liverpool: GK 95, TAC 79 → overall 83,
  potential 83, Exceptional.
- Honest Ahanor, CB, 18, Crystal Palace: overall 66, potential 78.
- Kennet Eichhorn, CM, 17, Leverkusen, Rapid: overall 62,
  potential 76.
- Carolin Simon, CB, 33, Wolfsburg (uncertain association):
  overall 68, potential 68, Professional, shown with Provisional.

## Development over multiple seasons (overall · pace · tactical)

- Saka: 76 (84/65) → +1s 76 (84/66) → +3s 75 (81/67) → +5s 74 (78/67).
- Saliba: 81 (72/78) → 82 (72/80) → 82 (69/82) → 82 (66/82).
  He never reaches 85: pace decline offsets his growth.
- Alisson: 83 (40/79) → 82 → 81 → 80 (32/77). Keepers fade gently.
- Ahanor: 66 (62/64) → 69 → 72 → 74 (65/72).
- Eichhorn: 62 (68/58) → 66 → 71 → 73 (77/67).
- Götze: 69 (71/73) → 68 → 66 → 64 (63/71). Pace falls 8 points,
  tactical falls 2. Speed goes, reading stays.

Note: season advance in the app UI is D5 work. D4 proves the
progression engine deterministically: the store already feeds
`season − 1` into ratings, so a season-5 save will show developed
and aged ratings without any save migration.

## Effect on match outcomes (1,000-seed deterministic batches)

- Same pace-heavy XI young vs aged 5 seasons: 1.35 goals per match
  → 1.29, win rate 39.1% → 38.2%. Ageing moves results, modestly.
- Same XI with defenders' tactical −10 vs +10: goals conceded
  1.30 → 1.27 per match. The 85/15 tactical blend moves results,
  modestly. Both effects are small by design (the blend is 15%,
  five seasons of ageing is not a career), and both point the right
  way over 1,000 seeds.

## Test results

- New D4 suite `scripts/test-d4-ratings.mjs`: **43/43** (curves,
  role mapping, bands, tiers, values, determinism, metadata,
  potential discipline, slow-developer stall, all named examples,
  club-mod cap, league-mod cap, distribution, transfer anchor,
  loader wiring, club-strength evidence, loader safety, match
  blend effects).
- Regression: core **10/10**, data-pack **22/22**, D2 **43/43**,
  D3 **45/45**; `npx tsc --noEmit` clean; Android export succeeds
  (6.2 MB, bundle contains "Bukayo Saka" and "d4-v2").
- Lint: all D4-touched files clean. A full `npx eslint src/` run
  reports one error in the untouched Expo template hook
  `src/hooks/use-color-scheme.web.ts` (setState-in-effect hydration
  pattern), which predates D4 and is outside this phase's scope;
  it is recorded here rather than silently fixed in template code.
- Distribution (6,426 players): mean 70.3, range 53–88, tiers
  Developing 140, Professional 5,135, Established 1,118,
  Exceptional 33 (0.5%).

## Two implementation notes (deviations from the v2 draft, stated)

1. **Fictional players do not use the D4 model.** The draft said
   one system for both paths. The shipped code keeps Phase 0
   bell-curve generation for fictional clubs (the test path, not
   the default experience) and adds only the tactical attribute and
   default roles. Reason: unifying would change every existing
   fictional save's players and flatten club-strength variation the
   fictional generator deliberately has. Real clubs — the shipped
   default — all use D4.
2. **Float-boundary correction in overall computation.** A true
   weighted mean of exactly 68.5 was stored as 68.49999999999999 and
   rounded down, so a uniform +1 shift could appear as +2 overall.
   Both overall functions now add 1e-9 before rounding. True sums
   are multiples of 0.01, so this corrects representation error only
   and never flips a genuine value. Found by the D4 league-modifier
   test (Lucas Boyé case); the fix is covered by that test.

## Honest limits (unchanged from the design)

- Exceptional membership is modelled, not measured: the top-rated
  player under this model is a backup goalkeeper, not a famous
  starter. The tier system distinguishes exceptional players; it
  cannot certify which real individuals deserve the tier without
  individual statistics.
- Club context is team-level (±4 cap); 79 clubs sit at modifier 0
  by construction, not evidence; generic pack labels get central
  templates; only ~1,500 players have specific roles; the +1 league
  term is a judgement parameter; tactical awareness and the ceiling
  bonus are modelled until individual evidence exists.
- Ratings advance with the career season number, but there is no
  season-advance control yet — that is D5.

## Screenshots (web build of the same components)

- `docs/screenshots/shot-club-d4.png` — Heidenheim Club home:
  Best XI 69 (est.), verified current 18 of 26, estimate footer.
- `docs/screenshots/shot-arsenal-players-d4.png` — Arsenal list
  with overall badges, tiers, statuses.
- `docs/screenshots/shot-arsenal-expanded-d4.png` — Saka expanded:
  all 8 attributes, potential 77, Steady, €10.5m, PCM caveat.
- `docs/screenshots/shot-squad-d4.png` — Heidenheim squad sorted
  by overall with role badges, tiers, Provisional labels, toggles.

Caveat (as in D3): screenshots are the web build of the same
components; on Android the Leagues tab is the D2 tab bar. The Club
badge circle is clipped at top in the web view, a web rendering
quirk, not an Android claim. On-phone tap-through remains
unverified.
