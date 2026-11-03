# D3 Report — Data Quality and Coverage (2 Nov 2026)

## Result

D3 classifies every one of the 6,426 pack associations against live
Wikidata evidence, corrects two D1 claims that turn out to be wrong,
finds one fictional character in the pack, explains all 14
empty-club gaps, and makes the game show data limitations honestly
instead of hiding them. No player information was invented, and the
v1 pack itself is left untouched (see "v1 frozen" below).

## Coverage: all five leagues, 174 clubs

| League | Clubs | Players | Verified current | Left | Conflicting | Uncertain |
|---|---|---|---|---|---|---|
| Premier League | 33 | 1,616 | 997 | 32 | 542 | 45 |
| La Liga | 32 | 1,165 | 688 | 23 | 412 | 42 |
| Serie A | 39 | 1,382 | 704 | 25 | 650 | 3 |
| Bundesliga | 34 | 1,204 | 751 | 15 | 340 | 98 |
| Ligue 1 | 36 | 1,059 | 788 | 14 | 229 | 28 |
| **Total** | **174** | **6,426** | **3,928 (61%)** | **109 (2%)** | **2,173 (34%)** | **216 (3%)** |

Per-club detail for all 174 clubs is in
`data-packs/v1/quality-summary.json` (per-club verified / left /
conflicting / uncertain counts). Extremes: Arsenal has one of the
cleanest lists in the pack (52 players: 33 current, 1 left, 3
conflicting, 15 uncertain); Elche has the messiest (53 players, 72%
conflicting). Well-maintained big-club items verify far better than
journeyman-heavy smaller-club items.

## What each status means (and what it does not)

- **Current (verified_current):** Wikidata still lists the player at
  this club with a non-deprecated statement and no end date, and no
  other senior club claims the player the same way — or Wikidata's
  own preferred-rank marker points at this club. This is
  "Wikidata-current". It is NOT an independently confirmed matchday
  squad: a stale statement Wikidata never ended still verifies.
  The game says this wherever it shows the label.
- **Left (historical):** the live statement has an end date, is
  deprecated only, is gone from live Wikidata, or Wikidata's
  preferred current club is a different club (108 of the 109).
- **Conflicting:** Wikidata currently lists the player at two or
  more senior clubs with no ranking to choose between them. The
  game does not pick a winner.
- **Uncertain:** the evidence cannot settle it — a women's-section
  association (215), a fictional-character item (1), or no live
  check (0 in this run; every fetch succeeded).

## Corrections to D1's claims (the important part)

**Both named D1 examples of "incorrect associations" were wrong —
the pack was right.**

- **"A Monaco player listed under PSG" (Maghnes Akliouche).** Live
  Wikidata gives Akliouche a preferred-rank PSG statement starting
  6 Aug 2026, after his Monaco statement ended. PSG's own site
  announced "Maghnes Akliouche signs for Paris Saint-Germain" on
  6 Aug 2026, and Reuters reported the ~€50m move from Monaco the
  same day. The D1 spot check used pre-transfer knowledge. The
  overlay marks him verified current under PSG.
- **"A Forest player under Manchester City" (Elliot Anderson).**
  Live Wikidata gives Anderson a preferred-rank City statement
  starting 1 Jan 2026, after his Forest statement ended. Multiple
  outlets reported his £116m Forest-to-City move (agreed July 2026,
  finalised after the World Cup, announced late Oct 2026). The
  overlay marks him verified current under City.

Lesson recorded: a player list that looks wrong against old
knowledge is not evidence. D3 checks dates and ranks before calling
anything incorrect.

## Real problems found

1. **One fictional character in the pack.** The pack's "Kylian
   Mbappé" under PSG is wd:Q123410299, whose Wikidata description
   is "fictional character from the 2023 video game EA Sports
   FC 24" — not the footballer. It carries a single dateless PSG
   statement. The overlay marks it uncertain with the description
   quoted as evidence, and the game shows it as Uncertain rather
   than as a real player. A description check now runs for all
   6,426 players; Mbappé is the only fictional-flagged item.
2. **215 women's-section associations.** Female players listed
   under men's club entities (for example Katarzyna Kiedrzynek
   under PSG, who also holds the PSG Féminine statement). These
   are marked uncertain, not current men's squad members. In the
   Arsenal list this is visible directly: Amelia Hazard, Anna
   Filbey and Ava Kuyken show as Uncertain.
3. **108 stale pack associations (preferred-away).** The player's
   preferred current club per Wikidata is a different club, so the
   pack club is the stale one. These are the only large-scale
   "left" corrections; they are marked Left with the preferred
   club named.
4. **2,173 conflicting associations (the honest residual).**
   Dominant cause, verified by sampling: former-club statements
   that were never given end dates — journeymen with eight or
   more open club statements, and loan returnees whose loan-club
   statement was never ended (for example Victor Kristiansen:
   Leicester plus an un-ended Bologna loan). A latest-start-date
   analysis was tried and rejected as a rule: of the 2,173, the
   pack club has the latest start in only 449 cases, another club
   is later in 385, and 1,339 are tied or dateless. Guessing would
   have invented answers, so these stay Conflicting and visible.
   Only a second source (licensed squad lists) can resolve them;
   D3 does not guess.
5. **All 14 empty-club gaps explained.** Three are duplicate club
   entities, not missing data: Toulouse FC (wd:Q2422417, empty)
   duplicates wd:Q19518 (40 players); FC Augsburg (wd:Q97905916)
   duplicates wd:Q15755 (33 players); Hamburger SV (wd:Q97905930)
   duplicates wd:Q51974 (55 players). The other eleven are
   historical/defunct clubs with no recent-era players (Società
   Ginnastica di Torino, U.S. Fiumana, SC Fives, Internazionale
   F.C. Torino, Olympique Lillois, FC Torinese, Alba Roma 1907,
   Fortitudo-Pro Roma, U.S. Internazionale Napoli,
   ÉF Reims-Champagne, AD Almería). The game still shows the
   duplicates as separate rows with "No players recorded"; the
   builder fix below removes them on the next snapshot.
6. **Cross-check fixed: 96/96.** The D1 raw-string match was
   83/96. The D3 normaliser (diacritics, suffix tokens, dotted
   initials like "F.C.", trailing founding years, and three
   evidence-based aliases: Inter Milan, Montpellier HSC, Racing
   Club de Lens, Rayo Vallecano de Madrid) now matches every
   2024-25 openfootball team in all five leagues.
7. **Coverage gaps that remain, stated plainly.**
   - The D1 query required birth dates from 1990 onward, so the
     pack has **zero players over 36 by construction** — every
     veteran is excluded, not just missing.
   - 175 players lack a nationality (Premier League accounts for
     100 of them).
   - Players with several recorded positions keep only the first
     query row's position (order-dependent; for example Aron
     Dønnum's four Toulouse positions collapse to one).
   - Live Wikidata holds far more open associations than the pack
     (Barcelona: 785 open statements vs 62 filtered pack players),
     which is why the D1 filters exist — but it also means the
     pack is a filtered view, not a census.

## What changed in the game

- `src/game/data-quality.ts` (new, pure): the classifier, safe
  overlay loading, club summaries, status labels, and the club-name
  normaliser.
- `data-packs/v1/quality.json` (new, bundled): one classified entry
  per pack association (6,426), with reasons and evidence. Loaded
  only when its pack version matches the pack; otherwise the game
  shows "Unverified" instead of statuses.
- Store, Leagues, Squad and Club screens: player rows show
  Current / Left / Conflicting / Uncertain (or Unverified when no
  overlay); club headers show the counts; the Club home shows
  "Verified current: X of Y players"; footnotes state that Current
  means Wikidata-current, not a confirmed matchday squad. Nothing
  is hidden: Left, Conflicting and Uncertain players stay listed.
- `scripts/build-data-pack.mjs`: a club-dedup step
  (`scripts/club-dedupe.mjs`) drops zero-player duplicate club
  entities on the next rebuild. It never drops a club that owns
  players (that would orphan them).
- `metro.config.js` (new): Metro did not resolve expo-sqlite's
  `.wasm` import, which broke the web export. Adding `wasm` to
  assetExts fixed it; the Android export was re-run after the
  change and still succeeds.

## v1 frozen (a deliberate decision)

The v1 pack is NOT edited to remove the three duplicate clubs or
to add any corrected rows. v1 is the audited D1 snapshot; editing
it in place would break its version string and its rebuild
determinism. Corrections live in the quality overlay, and the
builder fix takes effect on the next snapshot rebuild (v2), which
is the honest place for structural changes.

## Test evidence (all run 2 Nov 2026)

- D3 suite `scripts/test-d3-quality.mjs`: **45/45 pass** — 16
  classification fixtures (current, ended, absent, deprecated,
  conflicting, national/youth/regional ignored, women's-section,
  fictional item, no live data, return-after-leaving, preferred
  points at/away from the pack club, two preferred clubs), 10
  normaliser pairs, overlay loading safety, club summaries, club
  dedup (drop / split-keeps-both / distinct), real-overlay
  integrity (every entry is a real association, every association
  has exactly one entry, counts sum to 6,426, Akliouche +
  Anderson verified, Kiedrzynek uncertain, fictional Mbappé
  uncertain), and cross-check never below D1 counts.
- Older suites still green: D2 loader **43/43**, core **10/10**,
  data-pack **22/22**. Typecheck clean, lint clean.
- `npx expo export --platform android`: succeeds, 6.2 MB bundle,
  bundle contains "Bukayo Saka" and the quality overlay.
- Live re-check provenance: 174 per-club statement fetches, 33
  per-player statement batches, and 129 description batches from
  Wikidata, all cached under `data-packs/v1/raw/quality/` (336
  files, zero failures after one retried timeout). Two bugs found
  and fixed during the run: a double-Q ID bug in the description
  fetcher, and a missing club-label fetch that first inflated
  conflicts to 3,537 by counting national/youth teams as senior
  clubs.

## Screenshots (actual game interface)

Captured from the web build of the same React components (the
Android app is the same code; the Leagues screen was reached by
URL on web because the native tab bar does not render there, while
on Android it is the Leagues tab built in D2). Files in
`docs/screenshots/`: Club home (fresh install: 1. FC Heidenheim
1846, "Verified current: 18 of 26 players"), Leagues list (5
leagues with counts), Premier League clubs (33 clubs), Arsenal
players (52 players: 33 current, 1 left, 3 conflicting, 15
uncertain — Bukayo Saka shown Current), Squad (Heidenheim squad
with per-player statuses). One web-view artifact: the Club badge
circle is clipped at the top of the web page; this is a web
rendering quirk, not a claim about the Android layout.

## Still not verified on a real phone

As in Phase 0 and D2, the tap-through is proven by tests, the
built bundle, and the web build — not by a run on the user's
phone. The D3 additions to the phone checklist: Arsenal's player
list shows the 33/1/3/15 split, and the Club home shows the
"Verified current" row.

## D3 requirements checklist

1. Honest coverage report for 5 leagues / 174 clubs: yes (table
   above + per-club file).
2. Clubs with missing, outdated, incorrect or questionable
   associations identified: yes (14 gaps decomposed, 108 stale,
   215 women's-section, 1 fictional, 2,173 conflicting).
3. Known incorrect associations investigated: yes — both D1
   examples turned out to be correct, with dated statements and
   press corroboration.
4. Verified current squads distinguished from historical or
   uncertain associations: yes (four statuses + counts in the UI).
5. Data quality improved without inventing information: yes
   (overlay from live evidence; no guesses; latest-start
   explicitly rejected).
6. Game communicates limitations honestly: yes (status labels,
   counts, and footnotes in three screens).

D4 is NOT started. It needs the user's approval.
