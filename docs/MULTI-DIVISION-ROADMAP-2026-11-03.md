# Long-term roadmap: multi-division league system (NOT implemented)

Status: **VISION / INVESTIGATION ONLY.** Added 3 Nov 2026 at the user's
request. No code changed. D5 scope is unchanged: D5 is a single-division
season with the same clubs each season, no promotion or relegation.

## The vision (user's words, 3 Nov 2026)

A proper multi-division system, not just five top flights:

- England: Premier League, Championship, League One, League Two.
- Spain: La Liga, Segunda División.
- Italy: Serie A, Serie B.
- Germany: Bundesliga, 2. Bundesliga.
- France: Ligue 1, Ligue 2.

The eventual system must support:

- Automatic promotion and relegation.
- Promotion playoffs where applicable.
- Movement of clubs between divisions.
- Updated league membership each season.
- Managing a lower-division club and working up to the top division.

## Investigation result: the existing database does NOT support this yet

This was checked against the actual v1 pack (`data-packs/v1/data-pack.json`,
snapshot 2 Nov 2026), not from memory.

### What the pack actually contains

- **Exactly 5 leagues, all top flights:** Premier League, Bundesliga,
  La Liga, Ligue 1, Serie A. There is no Championship, League One,
  League Two, Segunda División, Serie B, 2. Bundesliga, or Ligue 2
  entity in the pack.
- **No division field anywhere.** A club record has only id, name,
  leagueId, country, sourceId. A player record has only id, name,
  clubId, sourceId, position, dateOfBirth, nationality. Nothing in the
  pack says which division a club plays in, in any season.
- **No lower-division fixtures.** The openfootball files in the pack
  are the 2024–25 top flights only (en.1, es.1, it.1, de.1, fr.1:
  380 matches for 20-team leagues, 306 for 18-team leagues).
- **Club-to-league assignment is by Wikidata association, not by
  current division.** The D4 audit already established that pack club
  lists are associations, not current squads: they mix current,
  former, youth, and women's associations. So a club sitting under
  "Premier League" in the pack is not proof it plays in the Premier
  League, and a club sitting under another league's group is not proof
  of its division either.

### The candidate pool: 64 clubs, and why it is not enough

If the 96-club 2024–25 top-flight membership (see
`docs/D5-FINAL-PLAN-2026-11-03.md`) is taken out of the 160 clubs with
recorded players, **64 clubs remain**. These are the only clubs in the
existing database that could even be considered for lower divisions —
and their divisions are **not recorded**, so each one would need
independent verification before use. Player counts are from the pack
itself:

- **England group — 13 candidates** (all with 27+ players): Leeds United
  58, Middlesbrough 49, Coventry City 49, Luton Town 45, Sunderland 45,
  Cardiff City 43, Watford 43, Stoke City 39, Hull City 38,
  Huddersfield Town 31, West Bromwich Albion 30, Burnley 30,
  Sheffield United 27.
- **Spain group — 11 candidates:** Deportivo de A Coruña 54, Elche 53,
  Málaga 38, Real Oviedo 36, Almería 35, Sporting de Gijón 30,
  Racing de Santander 29, Levante 23, Huesca 21, Hércules 11,
  Xerez 3 (cannot field an XI).
- **Italy group — 12 candidates:** ChievoVerona 69, Brescia 63, Pescara
  54, Sampdoria 46, Spezia 41, Pisa 29, Frosinone 27, SPAL (Ars et Labor
  Ferrara) 24, Salernitana 21, Cremonese 18, Sassuolo 17, Benevento 9
  (cannot field an XI).
- **Germany group — 14 candidates:** 1. FC Nürnberg 71, Hamburger SV 55,
  1. FC Köln 49, Hannover 96 45, Fortuna Düsseldorf 38, Greuther Fürth
  38, Schalke 04 36, Arminia Bielefeld 34, Hansa Rostock 28, Hertha BSC
  21, Alemannia Aachen 17, SC Paderborn 17, SV Elversberg 16,
  SV Darmstadt 98 14.
- **France group — 14 candidates:** FC Metz 57, Paris FC 36, Clermont
  34, Troyes 33, Nîmes 33, Bordeaux 31, Ajaccio 31, Guingamp 31,
  Valenciennes 30, Caen 25, Lorient 18, Bastia 16, Amiens 15,
  Le Mans 12.

**The gap, in round numbers:**

- One second division per country alone needs about 102 clubs
  (Championship 24, Segunda 22, Serie B 20, 2. Bundesliga 18,
  Ligue 2 18). The pool has 64 — about two-thirds of that, unevenly
  spread (England 13 of 24, Spain 11 of 22, Italy 12 of 20,
  Germany 14 of 18, France 14 of 18), before any candidate is excluded
  for being historical, defunct, third-tier, or sub-XI.
- The full vision needs about 150 lower-division clubs (England's
  three lower divisions alone are 72 clubs). The pool covers less
  than half, and League One and League Two have essentially no
  representation in the pack at all.
- 16 of the 64 candidates have fewer than 22 players, and 2 (Xerez 3,
  Benevento 9) cannot field an XI. Player data for lower-division
  clubs is also the least verified part of the pack: the D3 quality
  overlay was built for top-flight associations, and lower-division
  squads would need their own quality pass.

**Conclusion: do not build promotion/relegation on the v1 pack.**
It would mean assigning divisions by guesswork, which the project
rules forbid (no invented evidence), and it would produce divisions
that are short of clubs and short of players.

## Estimated work required (relative, not a date promise)

Work is ordered by dependency. Data work dominates; it is larger than
the D5 core work.

1. **Pack v2 data work (largest piece, investigation first):**
   division assignment for every club from a licensed source with a
   CC0-compatible licence (the same family as the current pack is a
   candidate to investigate, not yet verified); acquisition of
   lower-division clubs and their players (roughly 90+ new clubs for
   the full vision, plus players for each); duplicate resolution for
   the new clubs (the Toulouse/Augsburg pattern will recur); a quality
   overlay pass for the new squads; and the same licence/takedown
   treatment as D1. This overlaps Phase C (duplicates, missing
   players, generic positions) and should be planned with it, not
   separately.
2. **Multi-division season core:** season state per division per
   country (not one league per career); fixtures and tables per
   division; a promotion/relegation engine with **per-country rules**
   (they differ: England uses playoffs in the Championship, League
   One and League Two; Spain uses Segunda playoffs; Italy uses Serie B
   playoffs; Germany uses a two-leg relegation playoff between
   Bundesliga 16th and 2. Bundesliga 3rd; France uses a Ligue 1 /
   Ligue 2 playoff). Each country's rule set needs its own test cases.
3. **Membership update and user-club movement:** at rollover, move
   clubs between divisions, rebuild each division's fixtures, and
   follow the user's club into its new division (including the case
   where the user's club is promoted or relegated). Save migration
   from single-division D5 saves, with the same backup-first rule as D5.
4. **UI:** division selection, promotion/relegation zones and playoff
   places marked in tables, playoff brackets/results, and a season-end
   movement summary (who went up, who went down). Night Match standard,
   screenshots, phone tests, as in earlier phases.
5. **Testing:** per-country promotion/relegation cases, playoff
   brackets (including ties and the user's club in a playoff),
   boundary cases (a club finishing exactly on a promotion, playoff,
   or relegation line), odd division sizes, and full regression of
   D5 fixtures/tables/migration.

**Rough scale:** at least as large as D5 again, and probably larger,
with the data acquisition (step 1) as the long pole. It cannot be
estimated in days until the division source is identified and the
club/player counts for that source are known.

## Roadmap position

- **Dependency order:** after D5 (the season loop must work for one
  division before it can work for ten), and after the pack-v2 data
  investigation. It does not belong inside D5, D6 (event stream), or
  D7 (2D view), and it does not change D5's frozen-membership rule.
- **Phase number:** to be confirmed when D5 is approved and completed,
  so existing phase numbers are not renumbered prematurely. Until
  then it is recorded here as the multi-division phase, sitting after
  D5 in dependency order.
- **What can start early without expanding D5:** read-only
  investigation of a division data source and its licence only. No
  pack edits, no core changes, no UI changes, until the user approves
  that investigation's findings and the phase itself.

## Decisions needed later (not now)

1. Which licensed source supplies division membership and
   lower-division squads, and is its licence compatible?
2. Full vision at once (all ten divisions) or one second division per
   country first?
3. Playoff formats: implement each country's real format, or a single
   simplified playoff format for the first version (with honest UI
   labelling either way)?
4. What happens to a career whose club's real division cannot be
   verified — excluded from season play like D5 non-membership clubs,
   or held for a later pack?
