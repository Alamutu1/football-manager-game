# D4 Design — Player Ratings and Attributes (REVISED v2, APPROVED and IMPLEMENTED)

Status: approved by the user 2 Nov 2026 and implemented the same
day. Supersedes the v1 draft. Implementation report:
docs/D4-REPORT.md. The 1–99 scale is kept, as instructed.

## What changed vs v1 (each user refinement, answered)

1. Attribute-specific age curves: every attribute now has its own
   peak window and decline rate (table below). Pace goes early,
   tactical awareness late.
2. Current, potential and development rate are three separate
   things. A young player's journey is a season-by-season walk
   toward his potential at his own rate, not an automatic arrival
   at a peak at 24. A slow developer can still be short of his
   potential when decline starts.
3. Distribution reviewed: sharper overall weights and higher
   key-attribute templates open a real top end. Tiers label it:
   Developing <62, Professional 62–74, Established 75–82,
   Exceptional 83+. No performance statistics were invented; the
   only new evidence is team-level 2024–25 results (see below).
4. League modifier reduced: Premier League +1, every other league
   0 (was +2/+1/+1/+1/0). A player's ability now comes primarily
   from his own profile; league context moves an overall by at
   most about 1 point.
5. Estimate labelling strengthened: every rating carries a model
   version and a basis flag, and the UI says "PCM estimate" with
   an explicit "no individual performance data" note wherever
   ratings appear.
6. Development and ageing reach matches: ratings are league-wide
   (every club advances with the career season), the engine's
   defence blend now includes tactical awareness, and pace decline
   directly weakens attack. Best XI and transfer values move with
   age too.
7. Determinism and save compatibility preserved: ratings are pure
   functions of (pack data, player ID, seasons elapsed). No
   GameState field is added or changed.

## Principle (unchanged)

Ratings are a game model, not measured performance. The pack holds
no goals, assists, appearances or minutes for individuals, so no
formula can recover a player's true ability. D4 turns what the
pack does hold — position, date of birth, league, club, D3 quality
status, plus team-level 2024–25 results — into believable,
differentiated ratings, labels them as estimates everywhere, and
leaves a reserved slot for real individual evidence. No EA Sports
FC or Football Manager value, weight, or formula is used.

## Step 1 — role from the pack position string (unchanged from v1)

Ten roles: GK, CB, FB, WB, DM, CM, AM, W, ST, SS. Goalkeeper,
centre-back, full-back, defensive/central/attacking midfielder,
winger and centre-forward map directly. Generic labels take the
central template of their line, stated not hidden: defender → CB
[1,294 players], midfielder → CM [2,071], forward → ST [1,348].
Unrecognised junk labels (6 players) fall back to CM, as D2 did.
SS and WB templates exist for completeness but barely occur in
this pack.

## Step 2 — prime profile (the player's quality at his prime)

prime[attr] = clamp(template[role][attr] + signature[attr]
+ leagueMod + clubMod, 1, 99)

Role templates (peak-age base, 1–99). Key attributes were raised
4 points vs v1 to open the top end; the rest are unchanged:

| Role | PAC | SHO | PAS | DRI | DEF | PHY | GK | TAC |
|---|---|---|---|---|---|---|---|---|
| GK | 45 | 20 | 58 | 38 | 32 | 65 | 84 | 65 |
| CB | 60 | 38 | 60 | 50 | 84 | 78 | 12 | 70 |
| FB | 74 | 45 | 64 | 62 | 70 | 64 | 12 | 64 |
| WB | 78 | 48 | 66 | 66 | 62 | 66 | 12 | 62 |
| DM | 62 | 50 | 70 | 60 | 74 | 72 | 12 | 74 |
| CM | 64 | 57 | 80 | 66 | 60 | 66 | 12 | 72 |
| AM | 68 | 64 | 80 | 78 | 42 | 57 | 12 | 70 |
| W | 84 | 64 | 66 | 82 | 34 | 60 | 12 | 60 |
| ST | 74 | 84 | 60 | 70 | 30 | 72 | 12 | 64 |
| SS | 70 | 74 | 70 | 72 | 37 | 64 | 12 | 68 |

Signature (deterministic, seeded by player ID with FNV-1a +
mulberry32): every attribute ±9; one attribute a further +7..+13
(strength) and a different attribute a further −7..−13
(weakness). Goalkeeping for outfielders is noise in the 3–20
range and carries zero weight outside GK.

League modifier (reduced): Premier League +1, all others 0.

Club modifier (new, evidence-based, team-level): computed from
the pack's own 2024–25 openfootball results, not invented. Per
league, clubs are ranked by points then goal difference, and
modifier = round(8 × (0.5 − (rank−1)/(n−1))), giving +4 for the
champion down to −4 for last place. 95 of 174 clubs have 2024–25
results (Arsenal 74 pts → +4, Liverpool 84 pts → +4, PSG 84 pts
→ +4); the other 79 clubs (relegated, historical, duplicate
entities) get 0, neutral, recorded as such. The table ships as a
small derived file, `data-packs/v1/club-strength.json`, built from
the raw openfootball files with the D3 normaliser — it does not
edit the frozen v1 pack. LIMIT, stated: this is team strength,
not individual ability. A great player at a weak club is dragged
down slightly and a weak player at a strong club lifted slightly;
the modifier is capped at ±4 so it never dominates the profile.

Reserved individual-evidence slot (currently zero): the compute
function accepts an optional evidence object (appearances, goals,
assists, minutes, clean sheets). With no such data in the pack,
the term is 0 today. When a future pack carries stats, the
evidence term adjusts the prime profile without changing the
formula's shape.

## Step 3 — attribute-specific age curves (new in v2)

Each attribute has its own peak window. The snapshot current
value is prime × ageFactor(attr, age), where ageFactor rises
linearly from 0.86 at 16 to 1.00 at the attribute's peak start,
holds 1.00 through its peak window, then falls by its decline
fraction per year past peak end (floored at 0.75):

| Attribute | Peak window | Decline/yr past peak | Decline pts/season (step fn) |
|---|---|---|---|
| Pace | 21–26 | 0.020 | 1.6 |
| Physicality | 24–29 | 0.012 | 1.1 |
| Dribbling | 24–29 | 0.009 | 0.8 |
| Shooting | 25–30 | 0.008 | 0.7 |
| Passing | 25–31 | 0.008 | 0.7 |
| Defending | 26–30 | 0.010 | 0.9 |
| Goalkeeping | 28–33 | 0.007 | 0.6 |
| Tactical awareness | 28–33 | 0.004 | 0.35 |

So a winger's pace peaks at 21–26 and is already fading at 30
(factor 0.92), while his tactical awareness is still rising
toward 28 and barely fades (factor 0.988 at 36). A goalkeeper's
best attribute peaks at 28–33, years after a winger's pace. This
is the single biggest believability change vs v1, where every
attribute shared one curve.

## Step 4 — current, potential, development rate (new in v2)

Three separate quantities, all per player:

- Current attributes: the snapshot values from Step 3, then
  advanced season by season (below).
- Potential attributes (per attribute): if the player's age is
  below that attribute's peak start, potential = prime + a
  seeded ceiling bonus of 0..+8; otherwise potential = current.
  So a 25-year-old winger can still grow tactically (peak start
  28) but can no longer grow pace (peak window ended at 26) —
  his potential pace IS his current, declining pace. Potential is
  a ceiling per attribute, not one number.
- Development rate: a seeded scalar per player, 0.70–1.30,
  displayed in bands: Slow <0.85, Steady 0.85–1.15, Rapid >1.15.
  It controls only how fast a player closes the gap to his
  potential. It does not change the potential itself.

Season step (age A → A+1, per attribute, applied league-wide):
- Growth (new age ≤ peak start): current += (potential −
  current) × stepFraction, where stepFraction =
  clamp(0.20 × rate × (new age ≤ 19 ? 1.25 : 1.0), 0.10, 0.40).
  A rapid developer closes roughly a third of his gap per
  season; a slow developer roughly a seventh.
- Plateau (peak start < new age ≤ peak end): no change
  (potential = current here by definition).
- Decline (new age > peak end): current −= declinePts(attr)
  from the table above.

Attributes are carried as floats through the simulation and
rounded only for display and overall computation; this matters
because tactical decline (0.35/season) would otherwise round to
zero every season and never show. A fractional carry is not
randomness: the same inputs still produce the same trajectory.

Seasons elapsed = career season − 1 (the career starts at
season 1 on the snapshot). Ratings at any season are computed by
simulating that many steps from the snapshot — pure, deterministic,
and requiring no stored attributes, which is why saves keep
working unchanged.

## Step 5 — overall, potential overall, tiers, value

overall = round(weighted mean of current attributes, role
weights). Potential overall = the same weighted mean over
potential attributes. Weights were sharpened vs v1 so overall
tracks what each role is actually for:

| Role | Key weights |
|---|---|
| GK | GK .65, TAC .12, PAS .10, PHY .08, PAC .05 |
| CB | DEF .35, PHY .20, TAC .18, PAC .10, PAS .11, SHO .03, DRI .03 |
| FB | DEF .28, PAC .20, PAS .14, DRI .12, TAC .11, PHY .11, SHO .04 |
| WB | PAC .24, DEF .18, DRI .16, PAS .14, PHY .11, TAC .09, SHO .08 |
| DM | DEF .28, TAC .20, PAS .20, PHY .14, PAC .07, DRI .07, SHO .04 |
| CM | PAS .28, TAC .18, DRI .15, DEF .11, PHY .11, SHO .09, PAC .08 |
| AM | PAS .23, DRI .21, SHO .19, TAC .14, PAC .11, PHY .07, DEF .05 |
| W | DRI .24, PAC .24, SHO .16, PAS .14, TAC .09, PHY .09, DEF .04 |
| ST | SHO .35, PAC .18, DRI .15, PHY .12, TAC .10, PAS .07, DEF .03 |
| SS | SHO .25, DRI .19, PAS .18, TAC .13, PAC .11, PHY .11, DEF .03 |

Tiers (from current overall): Developing <62, Professional
62–74, Established 75–82, Exceptional 83+. A developing talent
is identified by youth + potential gap + Rapid rate, not by tier
alone: a 62-overall 17-year-old with potential 76 and a Rapid
rate is a prospect; a 62-overall 33-year-old is not.

Estimated transfer value (derived, supports future transfers;
labelled estimate, never a real valuation):
value = €50,000 × 1.16^(overall − 40) × ageMultiplier, where
ageMultiplier is 1.15 under 21, 1.00 at 21–27, 0.90 at 28–30,
0.75 at 31–32, 0.55 at 33–34, 0.40 at 35+. Value moves with
overall and age, so development raises it and decline lowers it.

Best XI overall (replaces "Not rated yet" on Club home): best GK
+ best 4 DF-group (CB/FB/WB) + best 4 MF-group (DM/CM/AM) + best 2
FW-group (W/ST/SS) by overall — the same 1-4-4-2 shape the
existing bestXI uses, redefined over role groups — mean overall
rounded.

## Step 6 — uncertainty stays separate, not hidden or nerfed

Ratings are computed identically for every D3 status. What
changes is presentation: non-verified players carry a
"Provisional" badge, their status label stays visible, and
player lists gain a "Verified current only" filter. Nobody is
hidden; verified and uncertain players are never mixed without a
label.

## Step 7 — estimate labelling (strengthened in v2)

- Every computed rating carries `modelVersion: "d4-v2"` and
  `basis: "model-estimate"`, plus an `evidence` list naming what
  went in: ["position", "age", "club-results-2024-25"] for real
  players. No individual performance data exists today, so no
  rating claims it.
- UI strings say "PCM est." next to overalls, and the expanded
  player view states: "PCM estimate — model only, no individual
  performance data." Footers state the model version and the same
  caveat. Fictional players get the same labelling (their data is
  generated, not real).
- When individual evidence arrives, the evidence list grows and
  the basis flag changes for the affected players; the labelling
  system is what makes that upgrade visible instead of silent.

## Step 8 — what D4 wires into the existing game

- `adaptPackToLeague` replaces the uniform-70s placeholders with
  computed attributes, overall, potential, rate and tier. The
  match engine's xG baselines do not change (typical attack and
  defence still sit near 70), but two engine updates land in D4:
  (a) attack/defence filters move from coarse positions to role
  groups (attackers = W/ST/SS/AM/CM; defenders = CB/FB/WB/DM/GK);
  (b) a defender's contribution becomes 0.85 × defending +
  0.15 × tactical (goalkeepers 0.85 × goalkeeping + 0.15 ×
  tactical), so tactical development now matters in matches and
  pace decline directly weakens attack. Passing, dribbling and
  physical are stored, displayed, and used for selection now, and
  become engine inputs in the D6 event-stream work.
- Development is league-wide: because ratings derive from
  seasons elapsed, every club's squad ages and develops as the
  career advances, not just the user's. A declining star drops out
  of Best XI; a prospect's value rises as he develops.
- Fictional players use the same module (role, age, ID, neutral
  league/club modifiers 0) instead of a second rating path.
  Phase 0 fictional tests that assert old rating values will be
  updated as part of the D4 test run.
- No GameState change: ratings derive from pack + DOB + position
  + ID + seasons elapsed, so existing saves keep working and pick
  up D4 ratings on next load. Match behaviour for existing real
  saves changes (that is the point of D4); save files do not
  change shape.
- UI: player rows gain an overall badge, role and tier; tapping
  a row expands all 8 attributes + current overall + potential
  overall + development band + estimated value + provisional note
  where applicable; Club home shows Best XI overall; Squad can
  sort by overall; footers state model version and estimate
  caveat.

## Draft-model outputs v2 (computed from the real pack, 2 Nov 2026)

Bukayo Saka, winger → W, 25, Arsenal (club mod +4), verified
current, rate 0.86 Steady:
now PAC 84, SHO 77, PAS 66, DRI 84, DEF 36, PHY 75, GK 10, TAC 65
→ overall 76, potential 77 [Established].
After 5 seasons (age 30): pace 78, tactical 67 → overall 74.
Pace fades, tactical grows, overall eases down.

William Saliba, defender → CB, 25, Arsenal (+4), verified
current, rate 0.91 Steady:
now DEF 93, PHY 88, TAC 78 → overall 81, potential 85
[Established]. After 5 seasons (age 30): pace 66 (was 72),
defending 94, tactical 82 → overall 82. He never quite reaches
85 before pace decline offsets his growth — the journey the user
asked for, visible in the numbers.

Alisson Becker, goalkeeper → GK, 34, Liverpool (+4), verified
current, rate 0.79 Slow:
now GK 95, TAC 79 → overall 83, potential 83 [Exceptional].
After 5 seasons (age 39): GK 92, tactical 77 → overall 80.
Keepers hold up late; the decline is gentle, not a cliff.

Honest Ahanor, defender → CB, 18, Crystal Palace (−1), verified
current, rate 0.88 Steady:
now overall 66, potential 78 [Professional]. After 5 seasons
(age 23): overall 74 — on his way, not there yet.

Kennet Eichhorn, midfielder → CM, 17, Leverkusen, rate 1.19
Rapid: now overall 62, potential 76 (gap 14). After 3 seasons
(age 20): overall 71 — a Rapid developer closing fast. This is
what a developing talent looks like in the system: young, big
gap, Rapid band.

Mario Götze, winger → W, 34 → 39 over 5 seasons: pace 71 → 63,
tactical 73 → 71, overall 69 → 64. Attribute-specific ageing in
one line: speed goes, game-reading stays.

Divergence, same role and age (both strikers, 20):
Endrick, rate 0.70 Slow: now 67, potential 76 → age 25: 71
(closed 4 of a 9-point gap, still 5 short as decline approaches).
Yanis Issoufou, rate 1.28 Rapid: now 65, potential 73 → age 25:
71 (closed 6 of an 8-point gap, nearly there). Same age, same
role, different journeys — that is the development rate working.

Carolin Simon, defender → CB, 33, Wolfsburg (−1), uncertain,
rate 0.79 Slow: now overall 68, potential 68 [Professional],
shown with a Provisional badge. Same formula, flagged status.

Whole-pack distribution (6,426 players): mean overall 70.3,
range 53–88; tiers: Developing 140, Professional 5,135,
Established 1,118, Exceptional 33 (0.5%). Zero players share an
identical 8-attribute profile. Role contrasts hold: mean
shooting ST vs CB, mean goalkeeping GK vs ST, and mean pace W vs
CB all differ by 20–65 points as in v1.

## Honest limits of this design (stated before building)

1. Exceptional membership is modelled, not measured. The
   highest-rated player in the pack under this model is a backup
   goalkeeper (Andy Firth, Liverpool, 88) — not a famous starter.
   That is the proof that, without individual statistics, the top
   of the table reflects the seeded signature plus club context,
   not observed greatness. The tier system makes exceptional
   players distinguishable; it cannot certify which real
   individuals deserve the tier. Only individual evidence can.
2. Club context is team-level. A great player at a weak club is
   dragged down slightly and a weak player at a strong club
   lifted slightly; ±4 caps the distortion but does not remove it.
3. 79 clubs have no 2024–25 results and sit at club modifier 0 —
   neutral by construction, not by evidence.
4. Generic pack labels (2,071 "midfielder", 1,294 "defender",
   1,348 "forward") get central templates; only ~1,500 players
   with specific labels get specific roles.
5. The league modifier (+1 for one league) is a judgement
   parameter, kept minimal on purpose.
6. Tactical awareness and the ceiling bonus are modelled, not
   measured, until individual evidence exists.

## Test scenarios for D4 (before it is called done)

T1. Attribute curves differ: a veteran winger's pace factor at
30 (0.92) is below a goalkeeper's goalkeeping factor at 30
(1.00); over 5 simulated seasons a veteran's pace falls ~8
points while his tactical falls ~2 (Götze case above).
T2. Rate divergence: the Endrick/Issoufou pair — same role and
age, Slow vs Rapid — closes different fractions of its
potential gap after 5 seasons (4/9 vs 6/8 in the draft run).
T3. Slow developer stalls: a synthetic 18-year-old with rate
0.70 and a 12-point gap is still below potential at 30 after
simulation, i.e. decline starts before arrival.
T4. Potential discipline: potential ≥ current for every
attribute of every player; for past-prime attributes potential
= current exactly.
T5. Distribution: mean 65–75, max ≥ 83, Exceptional tier below
2% of players, zero identical 8-attribute profiles in the pack.
T6. League influence reduced: the same profile computed under
Premier League vs Ligue 1 differs by ≤1 overall point from the
league term alone.
T7. Club evidence: the club-strength table reproduces points
and goal difference for 3 named clubs recomputed from the raw
openfootball files; clubs without results get modifier 0.
T8. Estimate labelling: every computed rating carries
modelVersion "d4-v2" and basis "model-estimate"; UI strings for
ratings contain "est." and the expanded view states the
no-individual-data caveat.
T9. Match consequences (deterministic batch): a team with +10
mean tactical concedes fewer goals on average than the same team
with −10 tactical across a fixed seed set; a pace-heavy XI aged
5 seasons has lower attack than its young version.
T10. Determinism and saves: identical inputs (player, seasons
elapsed) give identical ratings across calls; legacy save
fixtures (pre-D2 fictional shape, D2 real shape) load and
produce ratings; no GameState field is added or renamed.
T11. Full regression: core, data-pack, D2 and D3 suites green;
typecheck clean; lint clean; Android export succeeds with the
pack, overlay and club-strength table bundled; web-build
screenshots of the Squad list sorted by overall, an expanded
player row (current/potential/rate/tier/provisional), and Club
home Best XI. D5 does not start until D4 is demonstrated and
tested.
