# D4 Rating Calibration Audit — 3 Nov 2026

Read-only audit. No code changed, no ratings changed, D5 not started, tactics not touched.
Method: computed D4 ratings for all 6,426 pack players with the shipped
`ratingForPackPlayer` (snapshot, seasonsElapsed 0), plus role/age
trajectories from `computeRating`. All numbers below are from that run.

## 1. Andy Firth at 88, and the top 20

Andy Firth, GK, age 30, Liverpool, Premier League (+1), club modifier +4:
PAC 38, SHO 23, PAS 68, DRI 51, DEF 29, PHY 68, GK 99, TAC 79 → overall 88.
Arithmetic: GK weight 0.65 × 99 = 64.35, TAC 0.12 × 79 = 9.48,
PAS 0.10 × 68 = 6.80, PHY 0.08 × 68 = 5.44, PAC 0.05 × 38 = 1.90.
Total ≈ 87.97 → 88. His GK attribute is at the 99 clamp: GK template 84,
plus a high seeded signature draw, plus +1 league and +4 club.
At age 30 he is inside the GK peak window (28–33), so the age factor is 1.00.
No individual performance data went into this; it is template + signature
+ club context + peak age.

The top 20 are ALL goalkeepers. The next 19 after Firth:
Loïc Badiashile 86, Alberto Gallinetta 86, Lennart Grill 85, Iñaki Peña 85,
Paul Charruau 85, Francesco Anacoura 85, Unai Simón 85, Danielle Gibbons 85,
Aaron Ramsdale 85, Thomas Vincensini 85, Arnau Tenas 84, Gonzalo Crettaz 84,
Ivan Lucic 84, Matej Vozár 84, Benjamin Lecomte 84, Jérémy Vachoux 84,
Jakob Rønning-Haugaard 84, Rafael Cabral 84, Andrea Romagnoli 84.
Of the 33 Exceptional (83+) players in the pack, 30 are GK, 2 are CB, 1 is ST.

This is not a Firth-only anomaly. It is a systematic GK bias, see section 5.

## 2. Established world-class players, by position

Pack coverage gaps first: Mohamed Salah is NOT in the pack at all
(only Ibrahim Salah and Anass Salah-Eddine match "Salah"). Vinícius Júnior
is NOT in the pack (Vinicius Souza and Vinícius Moreira de Lima are
different players; Carlos Vinícius is a different striker). Rodrigo
Hernández ("Rodri") is NOT in the pack (the "Rodri" match is a 36-year-old
forward at Valladolid, overall 61). Those three cannot be compared
from this database; their absence is a pack completeness problem,
not a rating formula problem.

Players who ARE present:
- Kylian Mbappé appears TWICE, as two different Wikidata entities:
  PSG, centre-forward, age 27, overall 78 (PAC 71, SHO 91, DRI 73);
  Real Madrid, forward, age 27, overall 74 (PAC 83, SHO 83, DRI 66).
  Same real person, two different ratings, because the signature is
  seeded by player ID and the IDs differ. This is a duplicate-entity
  problem, not a formula problem.
- Erling Haaland, ST, Man City, age 26: overall 80, potential 81
  (PAC 72, SHO 99, PAS 61, DRI 77, PHY 75, TAC 67). Shooting is maxed,
  but pace 72 is unremarkable for him, and 80 sits below 30 goalkeepers.
- Jude Bellingham, CM (pack position is the generic "midfielder"),
  Real Madrid, age 23: overall 75, potential 82 (PAC 70, SHO 63, PAS 85,
  DRI 61, DEF 68, PHY 85, GK 1, TAC 76). Passing and physicality read
  well; the overall is capped by the CM template/weights, not by
  individual evidence.
- Bukayo Saka, W, Arsenal, age 25: overall 76, potential 77
  (PAC 84, SHO 77, PAS 66, DRI 84, TAC 65).
- William Saliba, CB (pack position generic "defender"), Arsenal,
  age 25: overall 81, potential 85 (DEF 93, PHY 88, TAC 78).
- Alisson Becker, GK, Liverpool, age 34: overall 83 (GK 95, TAC 79).
  He is the only one of this group in the Exceptional tier, and he
  is a goalkeeper, which is consistent with the GK bias, not with
  a measured ranking of world-class outfielders.
- For reference, other present stars: Kevin De Bruyne, CM (generic
  "midfielder"), Napoli, age 35: overall 70 (PAS 75). Florian Wirtz,
  CM (generic "midfielder"), Liverpool, age 23: overall 75, potential 79
  (DRI 90). Jamal Musiala, AM, Bayern, age 23: overall 72, potential 77
  (DRI 71, despite an AM template dribbling of 78, because the seeded
  signature drew negative).

Cross-position comparison: the best outfield overall is 83
(Timothy Weah, ST; Noah Schmitt, CB; Sam Stubbs, CB), while the
best goalkeeper is 88 and 20 goalkeepers sit at 84+. A believable
world would not rank 20 goalkeepers above Mbappé (78), Haaland (80)
and Bellingham (75) on overall alone.

## 3. Generic position labels: 4,713 of 6,426 players

Counts: midfielder 2,071 → CM, forward 1,348 → ST, defender 1,294 → CB.
Total generic = 4,713 (73.3%). Specific = 1,713 (26.7%).
Generic mean overall 70.1, Exceptional 3 of 4,713. Specific mean 70.7,
Exceptional 30 of 1,713, but 30 of those 30 are goalkeepers (whose
label "goalkeeper" is specific, not generic), so the generic/specific
gap in outfield tiers is actually worse than the headline suggests.

Effect on accuracy: a generic label forces a central template.
A real wide midfielder, defensive midfielder or second striker who
is recorded only as "midfielder" gets the CM template and CM weights;
a real full-back recorded only as "defender" gets the CB template
(DEF weight 0.35, pace weight 0.10) instead of the FB template;
a real winger recorded only as "forward" gets the ST template
(shooting weight 0.35). Bellingham (CM instead of a more attacking
role) and Saliba (CB, which happens to suit him) are both examples;
whether the forced template helps or hurts a given player is luck.

Can better classification be done from existing data? No.
A pack player record contains only: id, name, clubId, sourceId,
position, dateOfBirth, nationality. There is no second position
field, no stats, no minutes, no club role, no formation data.
Specific labels already in the pack are already mapped sensibly
(wing half → W, stopper → CB, inside forward → W, wide midfielder → W,
playmaker → CM). Guessing a specific role from a name, a club or a
nationality would be invented evidence and must not be done.
Improvement requires a pack upgrade: a second, more specific
position source (for example refined Wikidata position data) in
a future pack version, not a D4 code change.

## 4. Age curves: believable direction, goalkeeper exception

Same-id trajectories, modifiers 0, snapshot age → +5 seasons:
- GK, age 20: 70 → 77 (GK 74 → 81, TAC 66 → 74). Still rising at 25,
  correct for a keeper whose peak is 28–33.
- GK, age 30: 72 → 70 (GK 78 → 77, TAC 60 → 59). Gentle decline.
- CB, age 20: 64 → 71; CB, age 30: 67 → 63 (pace 54 → 46).
- CM, age 20: 60 → 67; CM, age 30: 69 → 65.
- W, age 20: 69 → 73; W, age 30: 73 → 68 (pace 82 → 74).
- ST, age 20: 70 → 74; ST, age 30: 74 → 69 (pace 79 → 71).
Direction is believable in every line: young players grow,
30-year-old outfielders decline, pace falls faster than tactical.
Two problems of degree: (a) goalkeeper decline is too gentle to
offset the GK overall advantage at 33+ (see section 5); (b) young
goalkeepers start too high, because the GK template weighted mean
is already high before any growth (see below).

## 5. Distribution realism by position and age

Mean overall by role (n, mean, range, Exceptional):
GK 551, 75.2, 62–88, 30. CB 1568, 71.4, 60–83, 2. ST 1407, 71.6, 59–83, 1.
W 428, 69.1, 59–81, 0. DM 35, 68.8, 62–74, 0. AM 26, 68.7, 63–77, 0.
CM 2113, 68.4, 54–78, 0. FB 298, 64.8, 53–75, 0.
No full-back in the pack exceeds 75; no central/attacking/defensive
midfielder exceeds 78. That is a role artefact, not a football fact.

Why: prime weighted means differ by role before any signature.
GK prime ≈ 75.7 (0.65 × 84 GK + 0.12 × 65 TAC + 0.10 × 58 PAS +
0.08 × 65 PHY + 0.05 × 45 PAC). CB prime ≈ 72.8, ST prime ≈ 73.4,
CM prime ≈ 69.4, FB prime ≈ 66.7. The GK weight is concentrated
on its highest template attribute; FB and CM weights are spread
across lower template attributes. Signature and age then move
players around those different baselines.

Mean overall by age band:
16–20 (n=141): 66.1. 21–24 (506): 70.2. 25–28 (1684): 71.9.
29–32 (2414): 70.8. 33+ (1681): 68.3.
By age band and group, goalkeepers stay at 73.5 (16–20, n=6 only),
71.9, 75.3, 75.8, 75.1, while midfielders fall from 67.9 at 21–24
to 66.6 at 33+, and forwards from 73.7 at 25–28 to 68.0 at 33+.
A believable world has goalkeepers peaking later, but not a
flat 75+ at every age while outfielders peak and fall.
Also note the pack itself is old: only 141 players are 16–20,
while 4,095 are 29+. That age skew is in the source data, not D4.

## 6. Players whose ratings look inconsistent

- Andy Firth 88, Liverpool backup goalkeeper, above every outfielder.
  See section 1. Root cause is GK weighting, not Firth's signature alone.
- 18-year-old goalkeepers at Established tier: Alessandro Longoni,
  PSG, age 18, overall 76, potential 88; Jack Porter, Arsenal, age 18,
  overall 75, potential 87. Teenage keepers should not start at 75+.
- 35–36-year-old goalkeepers at 80–84, including Benjamin Lecomte 84
  (35), Rafael Cabral 84 (36), Ezequiel Mastrolía 83 (35, Barcelona).
  Old keepers holding 83+ while old outfielders fall to the 60s is
  the same GK bias at the other end of the age curve.
- Unknown or squad players outranking stars: Timothy Weah ST 83,
  Noah Schmitt CB 83, Sam Stubbs CB 83 (Middlesbrough), Jérémie
  Porsan-Clemente ST 82, Ben Woodburn ST 82. These are signature
  lottery winners: a +9 base draw plus a +7..+13 strength draw on a
  heavily weighted attribute (shooting 0.35 for ST, defending 0.35
  for CB) can add 4–8 overall points with no individual evidence.
- Mbappé duplicate: two entries, 78 and 74, same person.
  14 names appear more than once in the pack.
- Full-backs capped at 75 and central midfielders at 78, while
  goalkeepers reach 88: a role ceiling artefact, see section 5.
- Players at 28–32 with overall 58–59 and tier Developing
  (for example Jan Gyamerah FB 58, Alberto Grassi CM 59, Karl Madianga
  CM 59) are not necessarily wrong — squad players exist — but the
  "Developing" label at age 31–32 is misleading; the tier is
  overall-only and ignores age.

## 7. Recommendations (NOT implemented, for user approval)

1. Rebalance goalkeepers first, before any other tuning. Options:
   reduce the GK overall weight (0.65 → ~0.50) and redistribute to
   passing, tactical and physical; or cap the GK prime weighted mean
   to the outfield range. Re-run this audit after the change and
   require: top-20 contains outfielders, Exceptional is not
   goalkeeper-dominated, GK mean is within ~2 points of CB/ST means.
2. Align prime weighted means across roles (FB ≈ 66.7 and CM ≈ 69.4
   versus GK ≈ 75.7 today). Raise FB/CM templates or weights, or
   lower GK, until every role's prime sits in the same band.
   This is the single change that fixes sections 2, 5 and 6 together.
3. Do NOT hand-edit individual stars. That would break determinism
   and invent evidence. If star accuracy matters, add individual
   evidence to a future pack (the D4 evidence slot already exists
   and is currently 0) and let the formula use it.
4. Deduplicate the pack (14 duplicate names, Mbappé as the visible
   case) and run a completeness check against 2024–25 squads
   (Salah, Vinícius Júnior, Rodrigo Hernández absent). Both are
   pack/data fixes, not rating-code fixes, and both should land
   before D4 is called believable.
5. For generic positions, do not guess. Plan a pack v2 position
   refinement from a second source; until then, record the 73.3%
   generic share as a known accuracy limit, and consider showing
   "position as recorded" in the UI so a forced CM/CB/ST template
   is not mistaken for a verified role.
6. Steepen goalkeeper decline after 33 and/or lower young-keeper
   starting points, so 18-year-olds do not start at 75+ and
   36-year-olds do not hold 84.
7. Narrow or re-weight the signature lottery on heavily weighted
   attributes, or cap the combined signature + strength contribution
   to a key attribute, so an unknown squad player cannot outrank
   a star by draw alone. Trade-off: less differentiation across
   the pack; test any change against the zero-identical-profiles
   result.
8. Make tier labels age-aware in presentation only (for example,
   do not call a 32-year-old at 59 "Developing" without an age
   qualifier), or accept the current overall-only tiers as a
   known labelling limit. No rating change is needed for this one.

Bottom line for approval: D4's direction, age curves, determinism
and estimate labelling are sound, but its cross-role calibration
is not yet believable. The goalkeeper weighting and the resulting
role ceilings are the blocking issue. Fixing those, plus pack
dedup and completeness, should come before D4 is approved as the
foundation for D5.
