# D4 Database Proposal — Phase C (separate, NOT implemented)

No player, position or statistic has been invented, added or changed
in this proposal. It is a decision document only. Nothing below is
approved until the user approves a specific option.

## 1. Duplicate player resolution

Fact: 14 names appear more than once in the pack. Checking name AND
date of birth shows only ONE true duplicate: Kylian Mbappé,
born 1998-12-20, listed as centre-forward at Paris Saint-Germain
and as forward at Real Madrid, with two different Wikidata IDs
and two different ratings (v3: 78 and 75). The other 13 repeated
names have different birth dates and are different people
(for example two Marquinhos, born 2003 and 1994; three Allans,
born 2004, 1997 and 1991). They must NOT be merged.

Proposed options for the one true duplicate:
A. Merge on name + date of birth, keeping a single record. The
   club and position to keep must be verified against an external
   source at merge time (the pack alone cannot say which club is
   current in 2026); the other record is retained as a historical
   association, not deleted silently.
B. Keep both records but link them as one entity, so both clubs
   show the same rating (same seeded ID). This fixes the rating
   inconsistency without deciding which club is current, but it
   leaves two squad entries for one person.
C. Leave as is and document it as a known pack limit.
Recommendation: investigate A first, read-only, and report the
verified current club with its source before any merge. Do not
merge on name alone under any option.

Effect if A is done: player count 6,426 → 6,425; Mbappé has one
rating everywhere; no other player is affected.

## 2. Missing players (Salah, Vinícius Júnior, Rodri)

Fact: Mohamed Salah, Vinícius Júnior and Rodrigo Hernández are
absent from the pack. This is not a rating error. The pack's club
lists are Wikidata associations, not current 2024–25 squads:
Liverpool's pack list, for example, includes many former, youth
and women's players alongside current ones, and still omits Salah.
So a hand insertion of three names would be invented data with no
association evidence, and is explicitly NOT proposed.

Proposed options:
A. Pack v2 completeness pass: rebuild the pack from a squad-based
   source (for example 2024–25 squad lists, licence-checked first)
   and re-run the D3 association check, so missing current players
   arrive with the same evidence standard as existing ones.
B. Wikidata current-club pass: add only players whose Wikidata
   record shows a current association with a pack club, with the
   association date recorded, and re-run D3 quality on the additions.
C. Leave as is and document the three absences as known limits.
Recommendation: A or B, as a separate pack build with its own
quality report, never as hand-added rows. Any new pack version
must be frozen, versioned and re-audited (top 50, role means,
duplicate check) before it replaces v1.

## 3. Better position classification for generic positions

Fact: 4,713 players (73.3%) carry generic positions: midfielder
2,071 → CM, forward 1,348 → ST, defender 1,294 → CB. A pack record
contains only id, name, clubId, sourceId, position, dateOfBirth
and nationality. There is nothing else in the existing data from
which a specific role could be derived. Guessing from a name, a
club or a nationality would be invented evidence and is NOT proposed.

Proposed options:
A. Pack v2 position refinement: check whether Wikidata holds a
   more specific position statement for these players (licence and
   availability to be verified first, read-only), and use it only
   where it exists, with the source recorded per player. Players
   with no refined position keep the generic mapping and are
   labelled as such.
B. Keep the generic mapping and show "position as recorded" in
   the UI, so a forced CM/CB/ST template is never mistaken for a
   verified specific role.
C. Both A and B: refine where a source exists, label the rest.
Recommendation: C, starting with a read-only investigation of
whether the refined position data exists and what licence it
carries. No classification change is made on the basis of this
proposal alone.

## What approval is being asked for

Not a single blanket approval. Each item needs its own decision:
duplicate option A, B or C; missing-player option A, B or C;
position option A, B or C. Until then, v3 ratings stand on the
unchanged v1 pack, with the audit limits (duplicate Mbappé,
three missing stars, 73.3% generic) recorded as known limits.
