# Revised implementation plan: real-world direction (2 Nov 2026)

Status: **plan only — no code changed.** This plan answers the user's
revised brief and replaces the "fictional as default" direction from the
earlier assessment. All Phase 0 work is preserved; the fictional league
generator stays only as a test/dev fixture, never as the shipped default.

General information only, not legal advice. Every risk marked
UNRESOLVED below is genuinely unresolved — it is not assumed away.

## 1. Direction in one paragraph

The shipped game features real-world clubs, leagues and players by
name, with generic badges and kits, no official logos, no photographs,
no proprietary databases, and an original player-rating system built
from public facts. Matches are presented first as high-quality 2D
animation inside the React Native/Expo app, driven by the simulation
event stream, with a future 3D upgrade path preserved through that same
event stream. The final product remains one downloadable offline Android
APK with persistent saves.

## 2. The three licensing tracks, separated

### Track 1 — Club and player names

- Club names are registered trademarks for games (Manchester United's
  EU word mark covers computer software and games). Player names fall
  under a patchwork of publicity/personality law: US state law (only
  about half of states have statutes), EU national personality rights,
  and in the UK passing off only (goodwill + misrepresentation +
  damage). Dropping logos lowers risk but does NOT clear word-mark or
  personality claims.
- Manchester United v Sega ([2020] EWHC 1439) decided only an amendment
  application; the name claim was SETTLED, not tried, with Manchester
  United renamed in later editions on a no-admissions basis. It does
  NOT establish that names-only use is lawful. (Correction to the
  earlier assessment, which implied the case settled the risk: it did
  not. The names-only question remains undecided in court.)
- Precedents that shape the plan: Football Manager uses FIFPro for real
  player names but fake club names where unlicensed (for example
  Lombardia FC, Milano FC, Bergamo Calcio in EA FC 27 while FIFPro
  players stay real); Real Football 2007 shipped FIFPro players with
  fake teams; Soccer Manager holds FIFPro plus separate Bundesliga,
  SPFL and club licences; Soccerverse holds FIFPro for tens of
  thousands of players.
- FIFPro covers collective player names, image and likeness through
  member unions. It does NOT license club names, badges, kits, league
  names or stadiums. Gaps exist: the Premier League does not assign to
  FIFPro, and Spain's AFE was reported leaving FIFPRO in February 2026.
  No public indie FIFPro price or route was found — cost UNRESOLVED.
  Contact route identified: FIFPRO Commercial Enterprises B.V.
- Nominative use (identify only, only as much as necessary, no
  endorsement suggestion) is a weak-to-moderate mitigation for a
  commercial game whose core content is the names themselves, not a
  shield, and it is argued after a claim, not before one.
- Mitigations adopted in V1: text names only; genuinely generic badges
  and kits; no "official" wording anywhere; a persistent
  non-affiliation disclaimer; no star-player marketing; no logo/kit
  pack import, linking or promotion; a documented takedown process
  with a per-entity rename/remove switch so any challenged name can be
  pulled without a rebuild of the whole game.

### Track 2 — Official logos, badges, kits, photographs

Highest-risk category, avoided entirely in V1 by design:

- Logos/badges: trademark + copyright in the artwork.
- Kits: copyright/design/trade dress, plus sponsor marks on the shirt.
- Photographs: photographer copyright + player personality rights.
- Lawful use later requires the rights holder for each item (club for
  its crest and kit, league for league marks, photographer/agency for
  photos). No prices found; deferred until a licence is actually
  negotiated. Nothing in V1 may contain, link to, or import these.

### Track 3 — Datasets and proprietary player ratings

- Copying EA Sports FC or Football Manager ratings is out. EA's
  attribute system and FM's ability data are proprietary data work;
  re-uploads (including Kaggle tables derived from them) do not become
  clean by re-uploading. The game's ratings are its own opinion and
  formula computed from public facts, never extracted from or
  calibrated to EA/FM values.
- Match facts themselves (scores, fixtures) are the weakest claims
  under the CJEU Fixtures Marketing cases: database rights cover
  investment in obtaining/verifying/presenting a database, not in
  creating the fixtures. But provider terms of service, selection and
  arrangement copyright, and trademark/publicity rights in names still
  apply. Rule adopted: source only from CC0 material, transform it
  into our own schema, never copy a provider dump, layout or editorial
  values.

## 3. Proposed data sources (commercial offline distribution test)

Only sources that clearly permit redistribution inside an offline APK
are in V1. Everything else is excluded until written permission exists.

| Source | Licence | V1 use | Limits |
|---|---|---|---|
| Wikidata structured data | CC0 | Club names, league memberships, player names, dates of birth, positions, nationalities, height, club spells with dates, some match/goal aggregates | Volunteer-edited, often stale/coarse; no per-season player stats; no photos |
| openfootball / football.json | CC0 | Fixtures and results, major leagues from 2010/11 onward, current season updated daily | No player rosters, no player stats |
| OpenLigaDB | ODbL 1.0 (conditional) | German fixtures only, with attribution and possible share-alike for an adapted database | Germany only; V1 may exclude it to keep one licence regime |
| DBpedia / Wikipedia | CC BY-SA | Fallback text facts only, with share-alike consequences | Prefer Wikidata; database rights not waived |

Excluded from V1 (do not bundle, do not scrape, do not depend on):

- API-Football/API-Sports: commercial use yes, redistribution no,
  white-label no.
- FBref: terms bar automated access without written permission.
- Transfermarkt: no open licence.
- StatsBomb Open Data: expressly no distribution or commercial
  exploitation of data or derived analysis.
- Kaggle datasets: per-upload, uploader-declared licences, often
  re-posts of unknown provenance — treat unknown as unusable.
- football-data.org: conflicting summaries on redistribution; do not
  bundle without written permission.
- TheSportsDB: a paid subscription is required for any store app, and
  it still does not grant third-party artwork, trademark or publicity
  rights — not a clean APK permission.

## 4. Our own player-rating system (V1 design)

Inputs (all from the clean CC0 spine, nothing proprietary):

- Club and league strength: Elo-style ratings computed from
  openfootball results (our own computation, our own formula).
- Position and age curve: peak-age bands by position, applied as a
  modifier, not as copied data.
- Player aggregates where Wikidata carries them (appearances, goals by
  club spell), used coarsely, never as precise per-season scouting.
- Editorial tiers: our own judgment bands (for example five tiers from
  squad player to world class), documented as opinion, applied
  transparently in code.

Outputs: a coarse overall rating per player plus role-relevant
strengths/weaknesses in broad bands. V1 honestly does NOT support
precise per-attribute scouting data (no per-season goals, assists,
minutes or expected-goals in the clean spine). That limitation is
stated in the game, not hidden: ratings improve as permitted sources
improve or licences are added.

What is forbidden in the rating code: any import, extraction,
calibration target, or "close to" check against EA or FM values; any
scraped Transfermarkt/FBref value; any undocumented editorial number
with no formula or tier rule behind it.

Related rule for transfers and contracts: real player wages are
private/proprietary and are NOT in the CC0 spine. All in-game wages,
fees and budgets are simulated economics, clearly not real figures.

## 5. Architecture: what changes, what stays

Stays: React Native/Expo manager shell, zustand store, SQLite saves
(RN owns versioned saves), both screens, the pure-TypeScript core
pattern, the test discipline (typecheck, lint, Node core tests,
Android bundle check, phone run).

Changes:

- `seed.ts` (fictional generator) becomes a test fixture only. The
  shipped path gains a dataset loader: a versioned, dated snapshot
  (Wikidata + openfootball) bundled as a JSON/SQLite asset with a
  licence manifest stating source, licence, snapshot date and
  coverage. Saves record the dataset version + entity IDs.
- `names.ts` (fictional pools) is retired from the shipped path and
  kept only for tests.
- Ratings move from generated attributes to the tier system in §4.
  The `Player` shape keeps overall/potential fields; their meaning
  becomes "our tier-derived rating" and the formula lives in code.
- Match engine v1 emits a deterministic minute-by-minute event
  stream (the existing v0 Poisson result becomes the fallback when
  the event stream is unavailable). The event stream is the contract
  for presentation.
- New match presentation layer: a `MatchRenderer` interface. V1
  implementation is a 2D Skia top-down animated view inside the same
  app and APK (22 players + ball, driven by events, with a commentary
  ticker). A future Godot renderer implements the same interface and
  swaps in via the same stream; Godot embedding needs dev builds and
  config plugins, so it is deferred, not built now. Existence of a
  React Native + Godot path is evidenced by community bindings and
  Expo demos, but no half-screen embedding component is verified —
  the 3D spike must prove it on a real low-end phone first.
- New safety module: the takedown switch (per-entity rename/remove)
  and the non-affiliation disclaimer, both shipped in V1, not bolted
  on after a complaint.

## 6. Revised phases (after Phase 0)

- Phase 1 (revised): data pack v1 + club creation + season skeleton.
  Snapshot builder script (offline, reproducible, dated, versioned);
  dataset loader + licence manifest; club/league browser on real
  structures; fixture calendar generated by round-robin from real
  league membership (career fixtures are generated and simulated, not
  replays of real historical results); league table; save/resume
  mid-season. Fictional generator retained for tests only.
- Phase 2: tactics + team selection (unchanged, on the real squads).
- Phase 3: engine v1 event stream + 2D Skia match view + match centre
  (scorers, ratings, key events, possession/shots derived from the
  stream).
- Phase 3b (spike, time-boxed, prototype only): Godot library
  embedding proof-of-concept on a real low-end Android phone, judged
  on frame rate and APK size before any 3D commitment.
- Phase 4: transfers + contracts (simulated economics only, §4).
- Phase 5: training + development + injuries (development bounded by
  our tier system, not by proprietary potentials).
- Phase 6: finances, stadium, academy, scouting (academy intake is
  generated youth, not real minors — real youth data is out of scope).
- Phase 7: seasons, cups, polish, EAS preview APK (one offline APK).

## 7. First deliverables, in order (each tested before the next)

1. D1 — Data-pack schema + licence manifest + snapshot builder script
   (Wikidata + openfootball, offline, reproducible, dated, versioned).
   Test: rebuild produces identical output from the same inputs;
   manifest lists every source and licence.
2. D2 — Dataset loader replacing the shipped fictional path, with the
   fictional generator kept for tests. Test: loader output matches the
   snapshot; all existing core tests still pass.
3. D3 — Club/league browser on real structures (leagues, clubs,
   squads by name, position, age, tier rating). Test: coverage report
   (leagues/clubs/players loaded, gaps listed, not hidden).
4. D4 — Own rating tiers v1 + formula document. Test: ratings are
   reproducible from the snapshot; no EA/FM value appears anywhere in
   code, data or tests.
5. D5 — Season skeleton on real league membership (calendar, table,
   continue loop, save/resume). Test: calendar completeness, table
   maths, mid-season save/resume.
6. D6 — Engine v1 event stream. Test: determinism per seed, events
   chronological, stats consistent with events.
7. D7 — 2D Skia match view + match centre. Test: view renders the
   event stream end to end on a phone run; pause/speed controls work.
8. D8 — Takedown switch + disclaimer shipped and exercised in a test
   (rename/remove one entity, game still loads and plays).

## 8. Unresolved risks (not assumed away)

1. Club trademark claims on names alone — mitigation: text only,
   generic badges/kits, no endorsement wording, disclaimer, takedown
   switch. Resolver: club/league licences, or a legal opinion.
   Cost unknown.
2. Player publicity/personality rights, varying by jurisdiction —
   mitigation: names as factual text, no likeness, no photos, no star
   marketing. Resolver: FIFPro licence (price unknown, contact route
   identified) or jurisdiction-specific legal opinion.
3. FIFPro/club/league licence prices and indie routes — unknown, no
   public figures found. Do not budget around any number.
4. Play Store enforcement ladder — rejection, removal, suspension
   strikes, account termination for cumulative strikes. Mitigation:
   the V1 mitigations above + a documented takedown process. Resolver:
   licences, or a successful rights-evidence response if challenged.
5. Dataset completeness and staleness — exact V1 league coverage is
   unknown until the D1 snapshot is built; Wikidata is volunteer-edited
   and coarse. Mitigation: coverage report in D3, dated snapshots,
   honest in-game limits. Resolver: licensed live data later.
6. No per-season player stats in the clean spine — ratings stay coarse
   in V1 (§4). Resolver: licensed data or a broader permitted source
   found later.
7. football-data.org and API-Football redistribution terms — ambiguous
   or negative; avoided by exclusion, not resolved.
8. Post-Brexit UK database-right treatment — unverified; avoided by
   sourcing CC0 only.
9. TheSportsDB paid-app scope — unverified and not rights-clearing;
   excluded.
10. Godot half-screen embedding in React Native — no verified
    component; the 3D spike (Phase 3b) must prove it, or 3D stays a
    separate full-screen module behind the same event stream.

## 9. What was NOT changed

No code was changed to produce this plan. No file was deleted, no
feature removed, no rewrite performed. The fictional Phase 0 work
remains intact as the test/dev fixture and the architectural base.
