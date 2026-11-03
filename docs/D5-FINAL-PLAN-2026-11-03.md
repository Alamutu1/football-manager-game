# D5 Final Plan — Season Skeleton (for approval, NOT implemented)

Status: **PLAN ONLY — no code changed for D5.** Implementation starts only
after the user's explicit approval of this plan.
Date: 3 Nov 2026. Approved base: D4 v3 (ratings), Stage 1 (Squad / Formation /
Profile navigation). Process: BUILD → TEST → VERIFY → APPROVE → ADVANCE.

## 1. The user's six decisions, as accepted

1. **League membership:** clubs with recorded players, **but** with the
   membership list and club count presented first, and no unrelated or
   historical clubs mixed into one league (see §2 — this is why the literal
   rule alone is not the recommended membership).
2. **Season length:** full home-and-away. A 20-club league = 38 rounds.
3. **Other matches:** simulated automatically on Continue. The user never
   has to play other fixtures one by one.
4. **Season end:** same clubs next season. No promotion / relegation until
   proper lower divisions exist in a future pack.
5. **Ratings:** frozen during a season, advanced at rollover using the
   approved D4 v3 system (already wired: `adaptPackToLeague` takes
   `seasonsElapsed = season − 1`).
6. **Legacy saves:** safe migration, backup before migration, tested on
   copies of legacy saves, never overwrite an existing career without a
   successful migration.

**Explicitly NOT in D5:** tactics, formation editing, transfers, training,
injuries, finances, stadium, academy, scouting, cups, 2D/3D match view
(D6/D7), background music, Phase C database changes, a new data pack, real
logos/photos, or any rating change (D4 v3 stays untouched).

**Match-play honesty for D5:** D5 has no interactive match view. Pressing
Continue simulates the whole current round, including the user's club,
with the existing `simulateMatch` engine. The user's club is highlighted
in the fixtures and table, but its match is simulated like every other.
This must be labelled in the UI so nobody mistakes a simulated round for
a played match.

## 2. Proposed league membership and club count

### 2.1 The literal rule, counted (why it is not enough on its own)

"Clubs with at least one recorded player" gives **160 of 174 pack clubs**:

| League | Pack clubs | With players | Zero-player (excluded) |
| --- | --- | --- | --- |
| Premier League | 33 | 33 | 0 |
| Bundesliga | 34 | 32 | FC Augsburg (duplicate entity), Hamburger SV (duplicate entity) |
| La Liga | 32 | 31 | AD Almería |
| Ligue 1 | 36 | 32 | SC Fives, Olympique Lillois, Toulouse FC (duplicate entity), ÉF Reims-Champagne |
| Serie A | 39 | 32 | Società Ginnastica di Torino, U.S. Fiumana, Internazionale F.C. Torino, FC Torinese, Alba Roma 1907, Fortitudo-Pro Roma S.G.S., U.S. Internazionale Napoli |
| **Total** | **174** | **160** | **14** |

Problems with using this list directly as leagues:

- **League sizes are wrong for a season.** Premier League would have 33
  clubs (odd), which needs 66 rounds with a bye every round, not 38.
  The other leagues would have 31–32 clubs (62–64 rounds).
- **Historical clubs are still mixed in.** Examples: AC ChievoVerona
  (defunct), Brescia, Pescara, Hércules CF, Deportivo de A Coruña,
  Xerez C.D. (only 3 recorded players — cannot field an XI), Benevento
  Calcio (9 players — cannot field an XI). 19 eligible clubs have fewer
  than 22 players.
- **The user's own test fails:** a 20-club league with 38 rounds does not
  exist in this list.

### 2.2 Recommended membership: 2024–25 top-flight clubs, 96 clubs

The pack already contains a clean, evidence-based membership: the
2024–25 openfootball results (380 matches per 20-team league, 306 per
18-team league). Membership = the clubs that played in 2024–25, resolved
to the player-carrying Wikidata entity where a duplicate exists (see §2.3).
Every one of these 96 clubs has at least 18 recorded players, so every
club can field an XI.

| League | Clubs | Rounds (home-and-away) | Matches per season |
| --- | --- | --- | --- |
| Premier League | 20 | 38 | 380 |
| La Liga | 20 | 38 | 380 |
| Serie A | 20 | 38 | 380 |
| Bundesliga | 18 | 34 | 306 |
| Ligue 1 | 18 | 34 | 306 |
| **Total** | **96** | — | — |

- **Premier League (20):** AFC Bournemouth, Arsenal, Aston Villa,
  Brentford, Brighton & Hove Albion, Chelsea, Crystal Palace, Everton,
  Fulham, Ipswich Town, Leicester City, Liverpool, Manchester City,
  Manchester United, Newcastle United, Nottingham Forest, Southampton,
  Tottenham Hotspur, West Ham United, Wolverhampton Wanderers.
- **La Liga (20):** Athletic Club, Atlético Madrid, CA Osasuna, CD Leganés,
  Deportivo Alavés, FC Barcelona, Getafe, Girona, RC Celta de Vigo,
  RCD Espanyol, RCD Mallorca, Rayo Vallecano, Real Betis, Real Madrid,
  Real Sociedad, Real Valladolid, Sevilla, UD Las Palmas, Valencia,
  Villarreal.
- **Serie A (20):** AC Milan, AC Monza, ACF Fiorentina, AS Roma, Atalanta,
  Bologna, Cagliari, Como 1907, Empoli, Genoa, Hellas Verona, Inter Milan,
  Juventus, Parma, SS Lazio, SSC Napoli, Torino, Udinese, US Lecce,
  Venezia.
- **Bundesliga (18):** 1. FC Heidenheim 1846, 1. FC Union Berlin,
  1. FSV Mainz 05, Bayer 04 Leverkusen, Borussia Dortmund,
  Borussia Mönchengladbach, Eintracht Frankfurt, FC Augsburg, FC Bayern
  Munich, FC St. Pauli, Holstein Kiel, RB Leipzig, SC Freiburg,
  SV Werder Bremen, TSG 1899 Hoffenheim, VfB Stuttgart, VfL Bochum,
  VfL Wolfsburg.
- **Ligue 1 (18):** AJ Auxerre, AS Monaco, AS Saint-Étienne, Angers SCO,
  FC Nantes, Le Havre AC, Lille OSC, Montpellier HSC, OGC Nice,
  Olympique Lyonnais, Olympique de Marseille, Paris Saint-Germain,
  RC Strasbourg Alsace, Racing Club de Lens, Stade Brestois 29,
  Stade Rennais, Stade de Reims, Toulouse FC.

**Labelling (mandatory):** the UI must call this "2024–25 top-flight
membership" and must say fixtures are game-generated season fixtures, NOT
the real 2024–25 schedule or results. The 2024–25 clubs include clubs
relegated after that season (e.g. Leicester City, Ipswich Town,
Southampton); per decision 4 they stay in the league for subsequent
seasons until lower divisions arrive. This is a frozen starting
membership, not a claim about the current real-world season.

**Decision needed from the user:** membership option B (96 clubs, above)
or option A (160 clubs, §2.1). The assistant's recommendation is B, for
the reasons in §2.1. If the user picks A, the plan must be revised before
implementation (odd league sizes, byes, sub-XI clubs, and historical
mixing all need separate rules).

### 2.3 Two pre-existing data defects found while counting (NOT fixed in D5)

These were found during this membership count, not assumed. Neither is
fixed by D5, and neither may be fixed silently, because one of them
touches D4 ratings:

1. **Atlético Madrid missing from the club-strength table, Real Madrid
   overstated.** The D3 cross-check maps both openfootball names
   "Real Madrid CF" and "Club Atlético de Madrid" to the same Wikidata
   club (Real Madrid), because the builder takes the first entry of a
   two-entry match list. Result: Real Madrid shows **154 points** in
   club-strength — impossible in 38 games (maximum 114) — because it
   combines Real's and Atlético's matches, and Atlético has no entry
   (modifier 0 instead of about +3). Real's own modifier is already
   capped at +4, so fixing this would change Atlético's players (up to
   +3 overall) but not Real's. **This is a D4 rating defect, reported
   here first as required. It needs its own user decision before any
   fix; D5 membership does not depend on it, because membership is
   taken from the openfootball team lists, not from club-strength.**
2. **Duplicate entities for Toulouse and Augsburg.** The club-strength
   table uses the zero-player duplicates (Toulouse wd:Q2422417,
   Augsburg wd:Q97905916); the player-carrying entities are Toulouse
   wd:Q19518 (40 players) and Augsburg wd:Q15755 (33 players). D5
   membership resolves by club name to the player-carrying entity.
   This is a membership resolution rule, not a pack edit and not a
   Phase C merge — the pack itself is untouched.

## 3. Final D5 implementation plan

### 3.1 Pure core first (no UI until the core passes its tests)

1. **`src/game/season-membership.ts` (new):** the 96-club membership as a
   static constant (leagueId → clubIds), plus a resolver that maps a
   pack club to its membership entry and returns null for non-members.
   No pack file is edited; no new pack version.
2. **`src/game/season.ts` (new, pure, no React/Expo imports):**
   - `generateFixtures(clubIds, seed, season)`: seeded circle method.
     Even club count n → n−1 rounds per leg, second leg with home/away
     swapped, total 2(n−1) rounds. Every pair meets twice, once home
     once away, one match per club per round. Deterministic from
     (seed, leagueId, season number), so the same career always
     regenerates the same fixtures.
   - `tableFor(fixtures)`: from played fixtures only. Columns P, W, D,
     L, GF, GA, GD, Pts (3/1/0). Sort: Pts desc → GD desc → GF desc →
     club name asc (deterministic; documented in UI as the D5 tiebreak,
     not a claim about real tiebreak rules).
   - `nextRound(fixtures)`, `roundFixtures(fixtures, round)`,
     `isSeasonComplete(fixtures)`, `championOf(table)`.
3. **`src/game/types.ts` (extend only, no field removed or renamed):**
   - `SeasonFixture { round, homeClubId, awayClubId, result?: MatchResult }`
     (result stored on the fixture; the existing global `results`
     array keeps appending for the Club screen's "last match" display).
   - `GameState.seasonData?: { leagueId, clubIds, fixtures, currentRound,
     championClubId?: string, pastChampions?: { season, clubId }[] }`.
     All new fields optional, so old saves parse unchanged.
4. **`src/game/store.ts`:** `continueSeason()` — takes the current
   round's fixtures, simulates each with the existing `simulateMatch`
   (including the user's club), writes results onto the fixtures,
   advances `currentRound`, and saves **once** (one
   `saveGameState` call, so a crash mid-round cannot leave a half-applied
   round). If it is the final round, records the champion and shows the
   season-end state; rollover (`startNextSeason()`) creates the next
   season's fixtures with the new season number, which is what advances
   D4 v3 ratings via the existing `seasonsElapsed` wiring. No rating
   code changes.
5. **`src/game/data-pack-loader.ts` (one filter):** `adaptPackToLeague`
   accepts an optional membership club list and filters clubs (and
   therefore players) to it. Default behaviour without the argument is
   unchanged, so existing callers and tests are unaffected.

### 3.2 UI (Night Match standard, screenshots as in earlier phases)

- **Club screen (`src/app/index.tsx`):** season progress
  ("Season 1 · Round 3 of 38"), a **Continue** button (one press =
  one whole round), the user's next fixture, and the season-end panel
  (champion, final table link) when a season completes. The Continue
  button is disabled with an honest message when there is no season
  (see §4.3).
- **Fixtures screen (`src/app/fixtures.tsx`, new route):** current round
  first, all rounds browsable, user's club highlighted, played results
  shown, unplayed fixtures shown as "vs" with no invented score.
- **Table screen (`src/app/table.tsx`, new route):** full table from
  `tableFor`, user's club highlighted, "game-generated season" label.
- **Tabs:** add Fixtures and Table to `src/components/app-tabs.tsx`
  (native) and `src/components/app-tabs.web.tsx` (web preview), keeping
  the existing Club / Squad / Leagues tabs and the dark/green style.
- **New careers:** `startRealCareer` for a membership club starts that
  club's league season at Round 1. `startRealCareer` for a non-membership
  club is unchanged in behaviour except that it does not start a season
  (see §4.3).

### 3.3 Order of work

Core (membership + fixtures + table) → migration (§4) → store Continue /
rollover → UI screens → full regression → fresh preview → user phone
tests (see §5.4). No step starts before the previous step's tests pass.

## 4. Save migration design

### 4.1 What exists today (verified in code)

- Saves live in one SQLite table `saves (id, name, state, updated_at)`,
  state = JSON `GameState`. `storage.ts` is the only module that touches
  the database.
- Three save kinds exist: (a) **pre-D2 fictional** — no `datasetSource`
  field, seed-regenerated league; (b) **post-D2 fictional** —
  `datasetSource: 'fictional'`; (c) **real** — `datasetSource: 'real'`,
  `datasetVersion: 'v1@2026-11-02'`, `userClubId` in the pack, league =
  all clubs of that club's competition.
- Ratings already advance with `season` (D4 v3): season 1 = snapshot
  ratings, later seasons = developed/aged ratings. D5 does not change
  this wiring.

### 4.2 Migration, step by step (all-or-nothing, original never touched first)

1. **Read, don't write.** Load the raw save JSON and validate it
   (parseable, `userClubId` present, `season` a number). If validation
   fails, stop: the save is left exactly as it was and an error is
   shown. No migration is attempted on a save that fails validation.
2. **Back up first, into a separate table.** `storage.ts` gains a new
   table `save_backups (id, original_id, state, created_at)` — the
   existing `saves` table and its rows are untouched. The backup row
   stores the byte-identical pre-migration state. Backups are **not**
   listed as playable careers, so they can never be picked up by
   `ensureGame`'s "latest save" logic by accident.
3. **Verify the backup.** Read the backup row back and compare it
   byte-for-byte with the pre-migration state. If it does not match,
   stop: the original is untouched.
4. **Build the migrated state in memory only.** Copy all existing
   fields unchanged (seed, userClubId, season, results,
   datasetSource, datasetVersion). Add `seasonData` only for saves
   that qualify (§4.3). Existing `results` (old test matches) are
   **not** converted into season results — they were test matches,
   not season fixtures, and counting them toward a table would invent
   a season history. The season table is computed only from fixtures
   played after migration.
5. **Write once, then verify.** Write the migrated state to the
   original save id with one `saveGameState` call, then load it back
   and check: same id, same userClubId, same season, same old results
   count, and (for qualifying saves) a complete fixture list. If any
   check fails, the backup row is the recovery path and the failure is
   reported — the app does not silently fall back to a fresh career.
6. **Rollback path (documented, not automatic deletion):** if a migrated
   save ever fails to load, the store reports the error and offers the
   backup restore (copy backup state back to the original id, again
   verified by re-reading). Backups are never deleted by migration code.

### 4.3 Which saves get a season

- **Real save, club in the 96-club membership:** migrates to a season
  starting at Round 1 of its current season number. Ratings stay frozen
  for that season (season number unchanged by migration), so migration
  itself does not change any rating.
- **Real save, club NOT in the membership** (e.g. a second-division or
  historical club picked from the Leagues tab): **does not get a season
  and is not moved to another club.** Its career keeps working exactly
  as today (Squad, Formation view, test matches). The Club screen shows
  an honest note: "Season play is not available for this club's league
  in D5." The user can start a new season career with a membership
  club without losing this save.
- **Fictional saves (pre-D2 and post-D2):** unchanged, no season. The
  fictional generator has no real league membership, so inventing one
  would be invented data. They keep working exactly as today.

### 4.4 Migration testing (on copies, never on the user's live save)

Test script `scripts/test-d5-migration.mjs` runs against **copies** of
five legacy save shapes: pre-D2 fictional, post-D2 fictional, real
Heidenheim (membership club, season 1), real non-membership club
(e.g. Leeds United), and real save with existing test-match results.
For each: original JSON byte-identical after the run; backup row
byte-identical to the original; migrated save loads; old fields
unchanged; membership save has a complete fixture list; non-membership
and fictional saves have no `seasonData` and still load; a corrupted
save (bad JSON, missing userClubId) is left untouched with an error.
The migration test must pass before any preview is built.

## 5. Fixture and table calculation test plan

New script `scripts/test-d5-season.mjs` (pure Node, no UI). Every
assertion below is a test case, not a claim:

**Fixtures — for each league size (20 and 18), plus small sizes
(4, 6) as edge cases:**

- Round count: 2(n−1) (38 for 20 clubs, 34 for 18).
- Total fixtures: n(n−1) (380 for 20, 306 for 18).
- Every unordered pair appears exactly twice, once with each club at
  home.
- Every club appears exactly once per round (no club plays twice in a
  round, no club sits out — all sizes here are even, so no byes).
- No club plays itself; no fixture is duplicated.
- Second leg mirrors the first leg with home/away swapped.
- Determinism: same (seed, leagueId, season) → byte-identical
  fixtures; different season number → different fixture order
  (so consecutive seasons are not identical).
- User's club fixture is findable in every round.

**Table — hand-computed cases, not just "it runs":**

- A 4-club, 6-fixture worked example computed by hand in the test
  file (including a draw, an away win, and a high-scoring game):
  P/W/D/L/GF/GA/GD/Pts for every club must match the hand computation
  exactly.
- Three-way tie on points: the documented sort (Pts → GD → GF →
  name) must produce the exact expected order.
- Empty season (no fixtures played): all clubs on 0, table still lists
  every club.
- Mid-season table uses only played fixtures; unplayed fixtures
  contribute nothing.
- Table recomputed from fixtures after a Continue round equals the
  table computed from the same fixtures independently (no hidden
  state, no double-counting if Continue is re-run on the same data).

**Continue / rollover:**

- Continue applies exactly one round: `currentRound` +1, exactly
  n/2 new results, no fixture played twice, table changes only by
  that round's results.
- Continue on the final round records the champion (table leader)
  and does not advance past the season.
- Rollover: season number +1, fresh fixtures for the new season,
  previous champion recorded, new table starts at zero, old season's
  played fixtures are not carried into the new table.
- Ratings freeze check: adapting the league at the same season number
  before and after a Continue round gives identical player ratings;
  adapting at season+1 gives the D4 v3 advanced ratings (existing D4
  v3 test anchors still pass).

**Regression (must all still pass):** core 10/10, data-pack 22/22,
D2 43/43, D3 45/45, D4 v3 43/43, UI display 26/26, Stage 1 profile 19/19,
plus `tsc --noEmit` clean and eslint with no new errors. Any failure
stops the phase.

## 6. Performance strategy for a complete season

Measured scale, not estimates: a 20-club season is 380 fixtures and 380
simulated matches; an 18-club season is 306. Per round, at most 10
matches are simulated.

- **Simulate per round, never per season.** Continue simulates only
  the current round (≤10 matches). There is no "simulate whole season"
  button, so the phone never does 380 simulations in one press.
- **Match simulation cost is tiny.** Each `simulateMatch` picks a
  Best XI by sorting one club's ~18–71 players and computing two team
  scores. Ten such simulations per Continue press is far below any
  perceptible threshold; the existing single test match already does
  two of them.
- **Fixtures are generated once and stored.** Generation is a
  O(n²) circle-method pass (380 entries) at season start only, never
  on render. Screens read the stored fixtures.
- **Table is O(played fixtures).** At most 380 entries, recomputed
  from fixtures on render and memoised by played-fixture count, so
  scrolling the table does not recompute anything.
- **Save size stays small.** One season of fixtures is roughly
  380 × ~80 bytes ≈ 30 KB of JSON, plus results. SQLite handles this
  trivially; past champions are stored as (season, clubId) pairs, not
  as full past fixture lists, so saves do not grow by 30 KB per season.
- **League adaptation is unchanged in scale.** A career still adapts
  one league's clubs (~20) and their players (~800–1,000), exactly as
  D2–D4 already do. Membership filtering reduces, not increases, this
  work versus today's all-clubs-of-a-competition adaptation.
- **Bundle size:** the membership list is ~96 club ids (a few KB of
  code). No new data pack, no new download, no network fetch.
- **Phone verification:** the preview test set (§5.4 in the breakdown,
  carried over) includes pressing Continue through several rounds on
  the user's phone and confirming no lag, no duplicated round after
  closing and reopening mid-season, and no lost round.

## 7. Files expected to change

**New files:**

- `src/game/season.ts` — fixture generation + table calculation (pure).
- `src/game/season-membership.ts` — 96-club membership constant + resolver.
- `src/app/fixtures.tsx` — Fixtures screen.
- `src/app/table.tsx` — Table screen.
- `scripts/test-d5-season.mjs` — fixture/table/Continue/rollover tests.
- `scripts/test-d5-migration.mjs` — migration tests on save copies.
- `docs/D5-REPORT.md` — written at the end of implementation (not now).

**Modified files:**

- `src/game/types.ts` — add `SeasonFixture` and optional
  `GameState.seasonData`; nothing removed or renamed.
- `src/game/storage.ts` — add `save_backups` table + backup/restore
  helpers; the `saves` table schema is unchanged.
- `src/game/store.ts` — migration on load, `continueSeason()`,
  `startNextSeason()`, season start for new membership careers,
  membership filtering for real careers.
- `src/game/data-pack-loader.ts` — optional membership filter in
  `adaptPackToLeague` (default behaviour unchanged).
- `src/app/index.tsx` — season progress, Continue button, season-end
  panel, honest "no season for this club" note.
- `src/components/app-tabs.tsx` — add Fixtures / Table tabs (native).
- `src/components/app-tabs.web.tsx` — add Fixtures / Table tabs (web).
- `docs/STATUS.md` and `~/workspace/goals/pocket-club-manager-android-game/GOAL.md`
  — record D5 approval (when given) and completion (when verified).

**Files that will NOT change in D5:**

- `src/game/ratings.ts` (D4 v3 untouched), `src/game/engine.ts`
  (`simulateMatch` untouched), `src/game/seed.ts` (Best XI untouched),
  `src/app/squad.tsx` and `src/components/formation-board.tsx`
  (Stage 1 untouched), `app.json`, any file under
  `data-packs/v1/` (pack, quality overlay, club-strength — the
  Atlético defect in §2.3 is a separate decision, not a D5 edit),
  the save `saves` table schema, and every file related to tactics,
  music, or Phase C.

## 8. Decisions still needed from the user before implementation

1. Membership: option B (96 clubs, §2.2) or option A (160 clubs, §2.1)?
2. The Atlético / Real Madrid club-strength defect (§2.3): fix it as a
   separate D4 item (changes Atlético players by up to +3), or leave it
   and let D5 proceed on the openfootball team lists?
3. Confirm the "no season" handling for non-membership and fictional
   careers (§4.3) — career preserved, honest note shown, no forced move.
4. Final approval to implement exactly this plan, with no additions.

**Nothing in this document is implemented. Implementation, preview
build, and phone tests all wait for the user's explicit approval.**

## 9. Multi-division note (added 3 Nov 2026, not part of D5)

The user's long-term multi-division vision (England 4 divisions, Spain
2, Italy 2, Germany 2, France 2, with promotion, relegation, playoffs,
and club movement) is recorded separately in
`docs/MULTI-DIVISION-ROADMAP-2026-11-03.md`. D5 does not implement any
of it. The investigation in that document found the v1 pack cannot
support it: only 5 top-flight leagues, no division field, no
lower-division fixtures, and only 64 non-top-flight candidate clubs
against about 102 needed for one second division per country and about
150 for the full vision. Multi-division needs pack-v2 data work,
planned with Phase C, after D5.
