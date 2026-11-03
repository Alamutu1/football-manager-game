#!/usr/bin/env node
/**
 * D1 snapshot builder for Pocket Club Manager.
 *
 * Fetches real-world leagues, clubs and players from openly licensed
 * sources and writes a versioned, dated, offline data pack that the
 * Android app can bundle without an internet connection:
 *
 *   data-packs/v1/
 *     data-pack.json    - leagues, clubs, players + licence manifest
 *     MANIFEST.json     - the licence manifest on its own
 *     cross-check.json  - Wikidata vs openfootball name comparison
 *     validation.json   - written by scripts/validate-data-pack.mjs
 *     raw/              - every raw response, cached for rebuilds
 *       _fetch.json     - snapshot date of the cached raw files
 *
 * Reproducibility and resume:
 * - The builder is incremental: every raw response is cached in
 *   raw/, and a later run reuses cached raws instead of refetching
 *   them. Re-running after a failure therefore resumes where it
 *   stopped instead of starting over.
 * - --force-refresh refetches everything and sets snapshotDate to
 *   today. Without it, snapshotDate is the date the cached raws were
 *   fetched (recorded in raw/_fetch.json), so the manifest never
 *   claims fresh data for old raws.
 * - A run with --from-cache makes no network calls at all and
 *   rebuilds ONLY from raw/. Its output is byte-identical to the
 *   run that fetched those raws. That is what the determinism test
 *   checks.
 * - Records are sorted by id before writing, so output order never
 *   depends on source ordering.
 *
 * Sources (all CC0, see docs/REVISED-PLAN-REAL-WORLD.md):
 * - Wikidata (wbsearchentities + SPARQL): league resolution, clubs
 *   via P118 (league), players via P54 (member of sports team).
 * - openfootball / football.json (2024-25 season files): fixtures
 *   and results, used for the manifest and the name cross-check.
 *
 * No proprietary data, no logos, no photographs, no player ratings:
 * this pack carries facts only. Ratings are D4, from our own formula.
 *
 * Usage:
 *   node scripts/build-data-pack.mjs [--from-cache] [--force-refresh] [--out-dir <dir>]
 *
 * Uses curl (proxy-aware in this environment) rather than Node fetch.
 * Exits non-zero if no league could be resolved at all.
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeClubs } from "./club-dedupe.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fromCache = args.includes("--from-cache");
const forceRefresh = args.includes("--force-refresh");
// NOTE: indexOf returns -1 when --out-dir is absent, so reading
// args[index + 1] would silently swallow the first flag as the
// directory (this bug once sent --from-cache runs to a stray
// "--from-cache" directory and skipped every league). Guard it.
const outDirIndex = args.indexOf("--out-dir");
const outDirArg = outDirIndex >= 0 ? args[outDirIndex + 1] : undefined;
const OUT = resolve(outDirArg ?? join(ROOT, "data-packs", "v1"));
const RAW = join(OUT, "raw");

// Leagues in scope for D1: the five biggest Western European top
// flights. The openfootball file is the 2024-25 season file for that
// league. Wikidata resolution is by label search, never by a guessed
// QID, and the resolved QID + description are recorded in the pack.
const LEAGUES = [
  { search: "Premier League", country: "England", file: "en.1.json" },
  { search: "La Liga", country: "Spain", file: "es.1.json" },
  { search: "Serie A", country: "Italy", file: "it.1.json" },
  { search: "Bundesliga", country: "Germany", file: "de.1.json" },
  { search: "Ligue 1", country: "France", file: "fr.1.json" },
];

const CC0_ATTRIBUTION =
  "CC0 1.0: no attribution is legally required; credit to the source is recorded here anyway.";
function today() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Run curl once, returning HTTP status + body. Wikidata's query
 * service sometimes answers a failed query with an HTML error page
 * (rate limit / overload) instead of JSON, so callers must check the
 * status and parse defensively; see curlJson below.
 */
function runCurl(url, { query = null } = {}) {
  const curlArgs = ["-s", "--max-time", "120", "-w", "\n%{http_code}"];
  if (query !== null) {
    curlArgs.push("-G", "--data-urlencode", `query=${query}`, "--data-urlencode", "format=json");
  }
  curlArgs.push(url);
  const out = execFileSync("curl", curlArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const split = out.lastIndexOf("\n");
  return { status: Number(out.slice(split + 1).trim()), body: out.slice(0, split) };
}

/** Fetch JSON with retries on HTML error pages / non-200 statuses. */
function curlJson(url, { query = null } = {}) {
  const delays = [10000, 30000, 60000];
  let lastError = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const { status, body } = runCurl(url, { query });
    try {
      if (status !== 200) throw new Error(`HTTP ${status}`);
      return JSON.parse(body);
    } catch (e) {
      lastError = e;
      if (attempt < delays.length) {
        console.warn(`  fetch retry ${attempt + 1} after ${e.message}; waiting ${delays[attempt] / 1000}s`);
        sleep(delays[attempt]);
      }
    }
  }
  throw lastError;
}

function curlText(url) {
  const delays = [10000, 30000];
  let lastError = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const { status, body } = runCurl(url);
    if (status === 200) return body;
    lastError = new Error(`HTTP ${status}`);
    if (attempt < delays.length) sleep(delays[attempt]);
  }
  throw lastError;
}

function readRaw(name) {
  return JSON.parse(readFileSync(join(RAW, name), "utf8"));
}

function writeRaw(name, data) {
  writeFileSync(join(RAW, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Return the cached raw response when one exists (unless
 * --force-refresh), fetch and cache it otherwise, or null when
 * fetching is impossible: --from-cache with a missing raw, or a
 * fetch that failed after retries. Callers must handle null by
 * recording a gap, never by crashing the whole build.
 */
function getRaw(name, fetcher) {
  const path = join(RAW, name);
  if (existsSync(path) && !forceRefresh) return { data: readRaw(name), reused: true };
  if (fromCache) return null;
  try {
    const data = fetcher();
    writeRaw(name, data);
    return { data, reused: false };
  } catch (e) {
    console.warn(`  WARNING: could not fetch ${name}: ${e.message}`);
    return null;
  }
}

function qid(uri) {
  return "wd:" + uri.split("/").pop();
}

function normName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  const fetchDate = today();
  // Pack vintage: the date the raw cache was first fetched, unless
  // --force-refresh. Per-source fetchedAt below distinguishes reused
  // raws (snapshotDate) from raws fetched on this run (fetchDate).
  let snapshotDate = fetchDate;
  if (!forceRefresh && existsSync(join(RAW, "_fetch.json"))) {
    snapshotDate = readRaw("_fetch.json").snapshotDate;
  }
  if (fromCache) {
    console.log(`Rebuilding from cached raws (snapshot date ${snapshotDate}).`);
  } else if (forceRefresh) {
    console.log(`Force-refreshing all sources (snapshot date ${snapshotDate}).`);
  } else {
    console.log(`Incremental build; reusing cached raws (snapshot date ${snapshotDate}).`);
  }

  const sources = [];
  const leagues = [];
  const clubs = [];
  const players = [];
  const seenPlayers = new Set();
  const crossCheck = {};

  for (const wanted of LEAGUES) {
    const slug = wanted.file.replace(".json", "");
    // 1. Resolve the league by label search.
    const searchUrl =
      "https://www.wikidata.org/w/api.php?action=wbsearchentities" +
      `&search=${encodeURIComponent(wanted.search)}&language=en&format=json`;
    const searchRes = getRaw(`search-${slug}.json`, () => JSON.parse(curlText(searchUrl)));
    const search = searchRes?.data;
    const leagueEntity = (search?.search ?? []).find(
      (r) => r.label && r.label.toLowerCase() === wanted.search.toLowerCase(),
    ) ?? null;
    if (!leagueEntity) {
      console.warn(`SKIP: league "${wanted.search}" could not be resolved.`);
      sources.push({
        dataset: `wikidata-league-${slug}`,
        source: "Wikidata",
        url: "https://www.wikidata.org/w/api.php?action=wbsearchentities",
        licence: "CC0-1.0",
        attribution: CC0_ATTRIBUTION,
        fetchedAt: fetchDate,
        snapshotDate,
        recordCount: 0,
        status: `failed: no entity matching "${wanted.search}"`,
      });
      continue;
    }
    const leagueId = qid(leagueEntity.concepturi);
    leagues.push({
      id: leagueId,
      name: leagueEntity.label,
      country: wanted.country,
      sourceId: `wikidata-league-${slug}`,
    });
    sources.push({
      dataset: `wikidata-league-${slug}`,
      source: "Wikidata",
      url: `https://www.wikidata.org/wiki/${leagueId.replace("wd:", "")}`,
      licence: "CC0-1.0",
      attribution: CC0_ATTRIBUTION,
      fetchedAt: searchRes.reused ? snapshotDate : fetchDate,
      snapshotDate,
      recordCount: 1,
      status: "ok",
    });
    console.log(`League: ${leagueEntity.label} (${leagueId}) — ${leagueEntity.description ?? ""}`);

    // 2. Clubs in the league: instance of association football club
    //    (P31, through subclasses, = Q476028) AND league (P118).
    //    Two probing lessons are baked in here:
    //    - P118 alone is NOT enough: it also matches players and
    //      season items (2,603 raw hits for the Premier League).
    //    - The truthy wdt:P118 triple hides normal-rank statements
    //      whenever a preferred-rank league statement exists (this
    //      silently dropped West Ham United from the truthy query),
    //      so the query reads statements directly (p:/ps:) at any
    //      rank. Rows are deduplicated below: one club can hold
    //      several P118 statements for different spells.
    //    Membership is historical as well as current, which the D1
    //    report states plainly.
    const clubsQuery = `SELECT ?club ?clubLabel WHERE { ?club wdt:P31/wdt:P279* wd:Q476028 . ?club p:P118 ?leagueStmt . ?leagueStmt ps:P118 ${leagueId.replace("wd:", "wd:")} . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?clubLabel`;
    const clubsRes = getRaw(`clubs-${slug}.json`, () =>
      curlJson("https://query.wikidata.org/sparql", { query: clubsQuery }),
    );
    const clubsRaw = clubsRes?.data ?? { results: { bindings: [] } };
    if (!clubsRes) console.warn(`  WARNING: club list for ${wanted.search} unavailable; league will show a gap.`);
    const seenClubs = new Set();
    const leagueClubs = [];
    for (const b of clubsRaw.results?.bindings ?? []) {
      const id = qid(b.club.value);
      if (seenClubs.has(id)) continue;
      seenClubs.add(id);
      leagueClubs.push({
        id,
        name: b.clubLabel.value,
        leagueId,
        country: wanted.country,
        sourceId: `wikidata-clubs-${slug}`,
      });
    }
    clubs.push(...leagueClubs);
    const clubsSource = {
      dataset: `wikidata-clubs-${slug}`,
      source: "Wikidata",
      url: "https://query.wikidata.org/sparql",
      licence: "CC0-1.0",
      attribution: CC0_ATTRIBUTION,
      fetchedAt: clubsRes?.reused ? snapshotDate : fetchDate,
      snapshotDate,
      recordCount: leagueClubs.length,
      status: clubsRes ? "ok" : "failed: club list fetch failed after retries",
    };
    sources.push(clubsSource);
    console.log(`  clubs: ${leagueClubs.length}`);

    // 3. Recent-era players associated with those clubs (P54 =
    //    member of sports team). Probing showed a bare association
    //    query returns centuries of history and wrong statements, so
    //    the query requires: no end-time qualifier on the P54
    //    statement (P582), a recorded position (P413), and a birth
    //    date from 1990 onward. That still does NOT guarantee a
    //    current men's squad: women's-team and youth associations
    //    and occasional wrong statements survive, and players are
    //    deduplicated by id keeping the first row (one player can
    //    hold several positions). The pack therefore documents
    //    these players as "recent-era associated players", never as
    //    verified current squads, and the D1 report lists squad
    //    currency as an open gap for D3 and beyond. Rows whose label
    //    is a bare QID (no English label) are skipped in code.
    let leaguePlayerCount = 0;
    let playersAllReused = true;
    const playerFailures = [];
    for (const club of leagueClubs) {
      const perClubQuery = `SELECT ?player ?playerLabel ?positionLabel ?dob ?nationalityLabel WHERE { ?player p:P54 ?stmt . ?stmt ps:P54 ${club.id.replace("wd:", "wd:")} . FILTER NOT EXISTS { ?stmt pq:P582 ?end . } ?player wdt:P413 ?position . ?player wdt:P569 ?dob . FILTER(?dob >= "1990-01-01T00:00:00Z"^^xsd:dateTime) OPTIONAL { ?player wdt:P27 ?nationality . } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?playerLabel LIMIT 80`;
      const rawName = `players-${slug}-${club.id.replace("wd:", "")}.json`;
      const perClubRes = getRaw(rawName, () =>
        curlJson("https://query.wikidata.org/sparql", { query: perClubQuery }),
      );
      if (!perClubRes) {
        playerFailures.push(club.name);
        continue;
      }
      if (!perClubRes.reused) playersAllReused = false;
      const perClubRaw = perClubRes.data;
      for (const b of perClubRaw.results?.bindings ?? []) {
        const pid = qid(b.player.value);
        if (seenPlayers.has(pid)) continue;
        if (/^Q\d+$/.test(b.playerLabel?.value ?? "")) continue;
        seenPlayers.add(pid);
        const player = {
          id: pid,
          name: b.playerLabel.value,
          clubId: club.id,
          sourceId: `wikidata-players-${slug}`,
        };
        if (b.positionLabel?.value) player.position = b.positionLabel.value;
        if (b.dob?.value) player.dateOfBirth = String(b.dob.value).slice(0, 10);
        if (b.nationalityLabel?.value) player.nationality = b.nationalityLabel.value;
        players.push(player);
        leaguePlayerCount += 1;
      }
    }
    sources.push({
      dataset: `wikidata-players-${slug}`,
      source: "Wikidata",
      url: "https://query.wikidata.org/sparql",
      licence: "CC0-1.0",
      attribution: CC0_ATTRIBUTION,
      fetchedAt: playersAllReused ? snapshotDate : fetchDate,
      snapshotDate,
      recordCount: leaguePlayerCount,
      status:
        playerFailures.length > 0
          ? `ok (player fetch failed for ${playerFailures.length} club(s), see cross-check)`
          : "ok",
    });
    console.log(`  players: ${leaguePlayerCount}${playerFailures.length > 0 ? ` (failed clubs: ${playerFailures.join(", ")})` : ""}`);

    // D3 fix: drop duplicate club entities (same normalised name, two
    // Wikidata items, players pointing at only one). Keeps the entry
    // with the most players; takes effect on the next snapshot
    // rebuild, not on the frozen v1 pack.
    {
      const counts = new Map();
      for (const p of players) counts.set(p.clubId, (counts.get(p.clubId) ?? 0) + 1);
      const { kept, dropped } = dedupeClubs(leagueClubs, counts);
      if (dropped.length > 0) {
        const dropIds = new Set(dropped.map((c) => c.id));
        for (let i = clubs.length - 1; i >= 0; i -= 1) {
          if (dropIds.has(clubs[i].id)) clubs.splice(i, 1);
        }
        leagueClubs.length = 0;
        leagueClubs.push(...kept);
        clubsSource.recordCount = leagueClubs.length;
        console.log(`  dedup: dropped duplicate club entities: ${dropped.map((c) => `${c.name} (${c.id})`).join(", ")}`);
      }
    }

    // 4. openfootball 2024-25 season file for the cross-check.
    const ofUrl = `https://raw.githubusercontent.com/openfootball/football.json/master/2024-25/${wanted.file}`;
    const ofRes = getRaw(`openfootball-${slug}.json`, () => JSON.parse(curlText(ofUrl)));
    const ofRaw = ofRes?.data ?? null;
    const ofStatus = ofRes ? "ok" : "failed: file fetch failed after retries or missing from cache";
    const ofTeams = new Set();
    let ofMatches = 0;
    if (ofRaw) {
      const matches = ofRaw.matches ?? [];
      ofMatches = matches.length;
      for (const m of matches) {
        if (m.team1) ofTeams.add(m.team1);
        if (m.team2) ofTeams.add(m.team2);
      }
    }
    sources.push({
      dataset: `openfootball-2024-25-${slug}`,
      source: "openfootball / football.json",
      url: ofUrl,
      licence: "CC0-1.0",
      attribution: CC0_ATTRIBUTION,
      fetchedAt: ofRes?.reused ? snapshotDate : fetchDate,
      snapshotDate,
      recordCount: ofMatches,
      status: ofStatus,
    });
    const wdNames = new Map(leagueClubs.map((c) => [normName(c.name), c.name]));
    const unmatchedOf = [...ofTeams].filter((t) => !wdNames.has(normName(t)));
    const ofNorm = new Set([...ofTeams].map(normName));
    const unmatchedWd = leagueClubs.filter((c) => !ofNorm.has(normName(c.name))).map((c) => c.name);
    crossCheck[slug] = {
      league: wanted.search,
      openfootballTeams: ofTeams.size,
      openfootballMatches: ofMatches,
      wikidataClubs: leagueClubs.length,
      matched: ofTeams.size - unmatchedOf.length,
      openfootballTeamsNotInWikidata: unmatchedOf.slice(0, 10),
      wikidataClubsNotInOpenfootball: unmatchedWd.slice(0, 10),
      playersIncluded: leaguePlayerCount,
      playerFetchFailures: playerFailures,
    };
    console.log(`  openfootball: ${ofMatches} matches, ${ofTeams.size} teams (${ofStatus})`);
  }

  if (leagues.length === 0) {
    console.error("No league resolved; refusing to write an empty pack.");
    process.exit(1);
  }

  leagues.sort((a, b) => (a.id < b.id ? -1 : 1));
  clubs.sort((a, b) => (a.id < b.id ? -1 : 1));
  players.sort((a, b) => (a.id < b.id ? -1 : 1));
  sources.sort((a, b) => (a.dataset < b.dataset ? -1 : 1));

  const pack = { version: 1, snapshotDate, sources, leagues, clubs, players };
  writeFileSync(join(OUT, "data-pack.json"), JSON.stringify(pack, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT, "MANIFEST.json"), JSON.stringify(sources, null, 2) + "\n", "utf8");
  writeFileSync(join(OUT, "cross-check.json"), JSON.stringify(crossCheck, null, 2) + "\n", "utf8");
  if (!fromCache && (forceRefresh || !existsSync(join(RAW, "_fetch.json")))) {
    writeRaw("_fetch.json", { snapshotDate });
  }
  console.log(`\nPack written to ${OUT}`);
  console.log(`leagues: ${leagues.length}, clubs: ${clubs.length}, players: ${players.length}, sources: ${sources.length}`);
  console.log("Next: node scripts/validate-data-pack.mjs data-packs/v1/data-pack.json data-packs/v1/validation.json");
}

main().catch((e) => {
  console.error("Builder failed:", e.message);
  process.exit(1);
});
