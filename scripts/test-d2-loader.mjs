#!/usr/bin/env node
/**
 * Automated tests for the D2 dataset loader integration.
 *
 * Usage (same compile-then-test pattern as scripts/test-core.mjs):
 *   npx tsc src/game/data-pack.ts src/game/data-pack-loader.ts src/game/seed.ts src/game/engine.ts \
 *     --outDir /tmp/fm-d2 --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/test-d2-loader.mjs /tmp/fm-d2 [path/to/data-pack.json]
 *
 * Covers the D2 requirements:
 *  1. The real pack loads correctly (counts, version).
 *  2. The browse flow works: leagues -> clubs -> players, with a
 *     real club (Arsenal) and a real player (Saka) reachable.
 *  3. Invalid or missing data fails safely: loadDataPack returns a
 *     failure object, never throws, for null, strings, empty
 *     objects, dangling references and duplicate ids.
 *  4. A league with clubs but no players adapts to an empty-but-
 *     valid League, and the v0 engine plays a 0-player side without
 *     crashing (0-0, no scorer lookup).
 *  5. Dataset versions survive a JSON save round-trip; legacy saves
 *     (no dataset fields) classify as fictional.
 *  6. The fictional generator still works (kept for tests, not the
 *     default player experience).
 *  7. The loader performs no network access (source contains no
 *     fetch; this test itself performs none).
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const compiledDir = process.argv[2];
const realPackPath = process.argv[3];
if (!compiledDir) {
  console.error("Usage: node scripts/test-d2-loader.mjs <compiled-dir> [data-pack.json]");
  process.exit(2);
}
const load = async (name) =>
  import(pathToFileURL(join(resolve(compiledDir), `${name}.js`)).href);
const loader = await load("data-pack-loader");
const seed = await load("seed");
const engine = await load("engine");
const {
  loadDataPack, packVersion, datasetOf, leaguesOf, clubsOfLeague,
  playersOfClub, leagueOfClub, ageAt, mapPosition, adaptPackToLeague,
} = loader;
const { generateLeague } = seed;
const { simulateMatch } = engine;

let passed = 0;
let failed = 0;
function check(name, cond, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`PASS: ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL: ${name} ${extra}`);
  }
}

function basePack() {
  return {
    version: 1,
    snapshotDate: "2026-11-02",
    sources: [
      {
        dataset: "wikidata-leagues",
        source: "Wikidata",
        url: "https://www.wikidata.org",
        licence: "CC0-1.0",
        attribution: "CC0: no attribution legally required.",
        fetchedAt: "2026-11-02",
        snapshotDate: "2026-11-02",
        recordCount: 1,
        status: "ok",
      },
    ],
    leagues: [{ id: "wd:Q1", name: "Test League", country: "Testland", sourceId: "wikidata-leagues" }],
    clubs: [
      { id: "wd:Q2", name: "Test FC", leagueId: "wd:Q1", country: "Testland", sourceId: "wikidata-leagues" },
      { id: "wd:Q4", name: "Empty FC", leagueId: "wd:Q1", country: "Testland", sourceId: "wikidata-leagues" },
    ],
    players: [
      {
        id: "wd:Q3", name: "Test Player", clubId: "wd:Q2", position: "Goalkeeper",
        dateOfBirth: "2000-01-01", sourceId: "wikidata-leagues",
      },
      {
        id: "wd:Q5", name: "Mid Player", clubId: "wd:Q2", position: "Attacking midfielder",
        dateOfBirth: "2001-09-05", sourceId: "wikidata-leagues",
      },
    ],
  };
}

// --- 3. Invalid / missing data fails safely, never throws ---
for (const [label, input] of [
  ["null", null],
  ["string", "not a pack"],
  ["empty object", {}],
  ["array", []],
]) {
  let threw = false;
  let result;
  try {
    result = loadDataPack(input);
  } catch {
    threw = true;
  }
  check(`loadDataPack(${label}) returns failure, no throw`, !threw && result && result.ok === false);
}
{
  const dangling = basePack();
  dangling.players[0].clubId = "wd:Q999";
  check("loadDataPack(dangling player->club) fails safely", loadDataPack(dangling).ok === false);
  const dup = basePack();
  dup.clubs.push({ ...dup.clubs[0] });
  check("loadDataPack(duplicate club id) fails safely", loadDataPack(dup).ok === false);
  const good = loadDataPack(basePack());
  check("loadDataPack(valid fixture) succeeds", good.ok === true);
}

// --- Position mapping + age ---
check("mapPosition goalkeeper -> GK", mapPosition("goalkeeper") === "GK");
check("mapPosition centre-back -> DF", mapPosition("centre-back") === "DF");
check("mapPosition full-back -> DF", mapPosition("full-back") === "DF");
check("mapPosition attacking midfielder -> MF", mapPosition("attacking midfielder") === "MF");
check("mapPosition winger -> FW", mapPosition("winger") === "FW");
check("mapPosition unknown -> MF (documented default)", mapPosition("something else") === "MF");
check("ageAt before birthday in snapshot year", ageAt("2026-11-02", "2001-12-01") === 24);
check("ageAt after birthday in snapshot year", ageAt("2026-11-02", "2001-09-05") === 25);
check("ageAt undefined DOB -> null", ageAt("2026-11-02", undefined) === null);

// --- Fixture adapt + 0-player engine safety ---
{
  const pack = loadDataPack(basePack()).pack;
  const league = adaptPackToLeague(pack, "wd:Q1");
  check("adaptPackToLeague keeps both clubs", league.clubs.length === 2);
  check("adaptPackToLeague keeps only real players", league.players.length === 2);
  check("adapted player positions are game buckets",
    league.players.every((p) => ["GK", "DF", "MF", "FW"].includes(p.position)));
  check("adapted club funds are 0 (pack carries no financial data)",
    league.clubs.every((c) => c.funds === 0));
  const withEmpty = simulateMatch(league, "wd:Q2", "wd:Q4", 123);
  check("simulateMatch vs 0-player club does not crash",
    withEmpty && typeof withEmpty.homeGoals === "number" && typeof withEmpty.awayGoals === "number");
  check("0-player side scores 0", withEmpty.awayGoals === 0);
  const bothEmpty = simulateMatch(league, "wd:Q4", "wd:Q4", 123);
  check("simulateMatch with no players at all is 0-0, no crash",
    bothEmpty.homeGoals === 0 && bothEmpty.awayGoals === 0);
}

// --- 5. Save versioning + legacy compatibility ---
{
  const realSave = {
    seed: 42, userClubId: "wd:Q2", season: 1, results: [],
    datasetSource: "real", datasetVersion: "v1@2026-11-02",
  };
  const roundTripped = JSON.parse(JSON.stringify(realSave));
  check("real save round-trips its dataset version",
    roundTripped.datasetVersion === "v1@2026-11-02" && roundTripped.datasetSource === "real");
  check("datasetOf(real save) is real", datasetOf(roundTripped).source === "real");
  const legacySave = { seed: 42, userClubId: "club-0", season: 1, results: [] };
  const legacyRoundTripped = JSON.parse(JSON.stringify(legacySave));
  check("legacy save (no dataset fields) parses fine", legacyRoundTripped.userClubId === "club-0");
  check("datasetOf(legacy save) is fictional", datasetOf(legacyRoundTripped).source === "fictional");
}

// --- 6. Fictional generator still works (tests, not the default) ---
{
  const league = generateLeague(1);
  check("generateLeague still produces 16 clubs", league.clubs.length === 16);
  check("generateLeague still produces 352 players", league.players.length === 352);
}

// --- 7. Loader performs no network access ---
{
  const loaderPath = new URL("./src/game/data-pack-loader.ts", `file://${process.cwd()}/`).pathname;
  const src = readFileSync(loaderPath, "utf8");
  check("loader source contains no fetch call", !src.includes("fetch("));
}

// --- 1 + 2. Real pack: load, version, browse flow ---
if (realPackPath && existsSync(realPackPath)) {
  const real = JSON.parse(readFileSync(realPackPath, "utf8"));
  const loaded = loadDataPack(real);
  check("real pack loads", loaded.ok === true);
  if (loaded.ok) {
    const pack = loaded.pack;
    check("real pack version is v1@2026-11-02", packVersion(pack) === "v1@2026-11-02");
    check("real pack has 5 leagues", pack.leagues.length === 5);
    check("real pack has 174 clubs", pack.clubs.length === 174);
    check("real pack has 6426 players", pack.players.length === 6426);
    const leagues = leaguesOf(pack);
    const pl = leagues.find((l) => l.name === "Premier League");
    check("browse: Premier League listed", !!pl);
    const plClubs = pl ? clubsOfLeague(pack, pl.id) : [];
    const arsenal = plClubs.find((c) => c.name.includes("Arsenal"));
    check("browse: Arsenal listed in Premier League", !!arsenal);
    const arsenalPlayers = arsenal ? playersOfClub(pack, arsenal.id) : [];
    check("browse: Arsenal has players", arsenalPlayers.length > 0);
    check("browse: Saka reachable in Arsenal squad",
      arsenalPlayers.some((p) => p.name.includes("Saka")));
    check("browse: Arsenal players all have position + DOB",
      arsenalPlayers.every((p) => !!p.position && !!p.dateOfBirth));
    check("browse: leagueOfClub maps Arsenal to Premier League",
      arsenal ? leagueOfClub(pack, arsenal.id)?.name === "Premier League" : false);
    const adapted = pl ? adaptPackToLeague(pack, pl.id) : null;
    check("adapt: Premier League adapts to a playable league",
      !!adapted && adapted.clubs.length === plClubs.length && adapted.players.length > 0);
    if (adapted && arsenal) {
      const match = simulateMatch(adapted, arsenal.id, plClubs[1].id, 7);
      check("adapt: engine plays a real-club test match without crashing",
        match && typeof match.homeGoals === "number");
    }
  }
} else {
  console.log("SKIP: real-pack checks (no pack path given or file missing)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
