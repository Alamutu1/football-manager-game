# D4 Calibration v3 Report — 3 Nov 2026

Status: APPROVED by the user 3 Nov 2026, after all five Android phone tests passed on the temporary D4 v3 preview (https://animated-piroshki-89dbc0.netlify.app/squad). D4 v3 is now the approved rating system. D5 not started, tactics not touched.
Original D4 v2 is preserved untouched in `docs/D4-REPORT.md`,
`docs/D4-DESIGN.md`, the audit `docs/D4-CALIBRATION-AUDIT-2026-11-03.md`,
and the full backup `~/workspace/pcm-d4v2-backup-2026-11-03.zip` (12 MB,
verified to contain `src/game/ratings.ts` and the v2 reports).
Save structure unchanged: same profile shape, same pack, same club-strength
table, same evidence slot. Only the model version stamp changed, d4-v2 → d4-v3.

## Phase A — what changed, and why (no player-specific exceptions)

1. Goalkeeper overall weights: goalkeeping 0.65 → 0.50, tactical 0.12 → 0.15,
   passing 0.10 → 0.13, physical 0.08 → 0.12, pace 0.05 unchanged,
   plus defending 0.03 and dribbling 0.02. Still a keeper-first profile,
   but one attribute no longer decides the overall.
2. Role prime weighted means aligned by template and weight changes:
   GK prime 75.7 → 71.1. FB template +2 on pace/defending/passing/dribbling/
   tactical/physical and weights defending 0.25 → 0.30, pace 0.20 → 0.24,
   prime 66.7 → 69.5. CM template +2 on pace/dribbling/defending/physical/
   tactical and shooting 57 → 59, prime 69.4 → 70.8. DM template +2,
   prime 69.9 → 71.9. AM template +2, prime 70.3 → 71.9. SS template +2,
   prime 68.9 → 70.9. WB template +2 (role currently unused by roleOf).
   CB and ST templates/weights unchanged (primes 72.8 and 73.4).
   New prime range across used roles: 69.5–73.4 (was 66.7–75.7).
   Position differences are preserved: GK still leads on goalkeeping,
   CB on defending, ST on shooting, CM on passing; only the overall
   baselines were brought together.
3. Signature randomness reduced, same draw order, same determinism:
   every attribute ±9 → ±6; strength +7..+13 → +5..+9; weakness
   −7..−13 → −5..−9. Maximum swing on a heavily weighted attribute
   falls from +22 to +15, so a 0.35-weighted attribute moves overall
   by at most ~5 points from signature instead of ~8.
4. Goalkeeper ageing after 33 steepened: goalkeeping decline factor
   0.007 → 0.013 per year past peak end, decline points 0.6 → 1.2
   per season. Peak window unchanged (28–33); tactical still declines
   slowly (0.35/season), so reading stays while shot-stopping fades.

## Phase B — recalculation of all 6,426 players (v3 vs v2)

| Measure | v2 | v3 |
|---|---|---|
| Mean overall | 70.3 | 70.5 |
| Range | 53–88 | 57–83 |
| Developing (<62) | 140 | 35 |
| Professional (62–74) | 5,135 | 5,601 |
| Established (75–82) | 1,118 | 789 |
| Exceptional (83+) | 33 | 1 |
| Top player | Andy Firth GK 88 | Timothy Weah ST 83 |

Mean overall by role, v2 → v3:
GK 75.2 → 70.4. CB 71.4 → 71.4. FB 64.8 → 67.5. DM 68.8 → 70.5.
CM 68.4 → 69.8. AM 68.7 → 70.2. W 69.1 → 69.2. ST 71.6 → 71.6.
Role-mean range: 10.4 points (64.8–75.2) → 4.1 points (67.5–71.6).
Full-backs remain the lowest role mean, by about 2 points, not 10.

Top 20 (v3, by overall then potential): Weah ST 83, Porsan-Clemente ST 82,
Bošnjak CB 81, Schmitt CB 81, Boniface ST 81, Firth GK 81, Saliba CB 80,
Tzolis ST 80, Isak ST 80, Woodburn ST 80, Gyamfi CB 80, Bastoni CB 80,
Haaland ST 80, Morer CB 80, Stubbs CB 80, Naz ST 80, Masterson CB 80,
Top 20 contains exactly 1 goalkeeper (Firth, 6th in the potential-ordered
audit run), not 20.
Top 50 contains ST 27, CB 17, GK 5, W 1. Top goalkeeper is Firth 81;
next keepers are Gibbons, Badiashile and Ramsdale at 79.
Top by role: FB Tyrell Robinson 77, CM Jordan Rossiter / Brooks Lennon /
Abdallah Basit 78, DM Gianna Rackow 76, AM Eberechi Eze 78, W Robbie Burton 80.

Note on ordering: two audit runs sorted ties differently (overall-then-
potential vs overall only), so the exact order within the 80-point group
varies; the membership and the goalkeeper count do not.

Named players, v2 → v3:
Andy Firth GK 88 → 81 (GK 99 → 98, but weight 0.65 → 0.50).
Alisson Becker GK 83 → 77. Saliba CB 81 → 80, potential 85 → 84.
Saka W 76 → 76, potential 77 → 77 (unchanged). Haaland ST 80 → 80.
Mbappé PSG ST 78 → 78; Mbappé Real ST 74 → 75. Bellingham CM 75 → 75,
potential 82 → 82. De Bruyne CM 70 → 71. Wirtz CM 75 → 75.
Musiala AM 72 → 74, potential 77 → 79. Eichhorn CM 62 → 65, potential 76 → 79.
No famous player was manually inflated; every change above comes from
the formula changes in Phase A applied to every player alike.

Teenage and older players:
Teenage goalkeepers: Longoni (18) 76 → 70, potential 88 → 83;
Porter (18) 75 → 70, potential 87 → 82. No player aged ≤19 is above 75
in v3 (v2 had two at 75–76). Goalkeepers aged 35+: Lecomte 84 → 76,
Cabral 84 → 77, Mastrolía 83 → 76; GK 35+ mean 69.1, max 77 (v2 max 84).
No player aged ≥35 is above 80 in v3.
Same-id GK trajectory, age 30 → +5 seasons: v2 72 → 70; v3 69 → 66,
with the steeper post-33 step visible (age 34: 67, age 35: 66).
GK age 20 → +5: v2 70 → 77; v3 66 → 73. Young outfield trajectories
are essentially unchanged (CB 30: 67 → 63 in v2, 69 → 64 in v3;
ST 30: 74 → 69 in both, within 1 point at each step).

Potential vs current: potential ≥ current for all 6,426 players;
1,502 players have potential strictly above current. Determinism:
recomputing the same player twice gives byte-identical profiles;
the full-pack recalculation is reproducible from pack + club-strength
+ model version alone.

## Tests (Phase B, item 8)

Typecheck clean. Lint: 0 errors, 1 pre-existing warning in the test
file (unused variable at line 183, not introduced by v3).
Core 10/10, data-pack 22/22, D2 loader 43/43, D3 quality 45/45,
D4 ratings 43/43 (with v3 anchors: metadata d4-v3, Saliba 80/84,
Alisson 77/77, Eichhorn 65/79; the v2 anchors are preserved in the
backup), UI display 26/26, Stage 1 profile 19/19.
Android export was not re-run for v3 in this report; the web export
path is unchanged and the bundle shape is unchanged, but a fresh
preview build is still needed before any phone test of v3.

## Remaining limits, stated honestly

- Full-backs are still the lowest role mean (67.5), about 2 points
  below the pack mean, and no full-back exceeds 77. The disadvantage
  is much smaller, not gone.
- Only 1 Exceptional player remains (Weah 83). The top end is now
  compressed: 789 Established vs 1,118 in v2. Whether 83 should be
  the ceiling for a model with no individual evidence is a judgement
  call for the reviewer, not a bug.
- Unknown or squad players still top the list (Weah, Porsan-Clemente,
  Bošnjak, Schmitt, Stubbs). Signature reduction narrowed the lottery
  but did not remove it, because there is still no individual evidence
  to separate a star from a squad player with a good draw.
- Mbappé still appears twice (78 and 75); Salah, Vinícius Júnior and
  Rodri are still absent; 73.3% of players still carry generic positions.
  Those are Phase C database issues, not rating-formula issues, and
  are not fixed by v3. See the separate proposal.
- The pack age skew is unchanged: only 141 players are 16–20,
  4,095 are 29+. Distribution realism is therefore limited by the
  source data as well as by the formula.
