#!/usr/bin/env node
/**
 * D3 live re-check: for every pack association, fetch the CURRENT
 * Wikidata P54 statement set, so associations can be classified as
 * verified-current, historical, conflicting, or uncertain from
 * evidence instead of from the snapshot alone.
 *
 * Two query families, both cached under data-packs/v1/raw/quality/
 * and resumable (existing cache files are reused, never refetched):
 *  A. Per club (174 queries): every P54 statement pointing at the
 *     club, with rank and start/end/point-in-time qualifiers, plus
 *     the player's sex (P21) for the women's-section signal.
 *  B. Per player batch (200 players per query): every P54 statement
 *     of each pack player, so a player's current club elsewhere can
 *     be detected (conflict check), not just the pack club.
 *
 * Uses curl (proxy-aware in this environment), same retry pattern
 * as the D1 builder. No data is invented: everything the classifier
 * later uses comes from these cached responses.
 *
 * Usage:
 *   node scripts/fetch-association-dates.mjs data-packs/v1/data-pack.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packPath = process.argv[2];
if (!packPath) {
  console.error("Usage: node scripts/fetch-association-dates.mjs <data-pack.json>");
  process.exit(2);
}
const pack = JSON.parse(readFileSync(packPath, "utf8"));
const outDir = "data-packs/v1/raw/quality";
mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runCurl(query) {
  const out = execFileSync(
    "curl",
    ["-s", "--max-time", "120", "-w", "\n%{http_code}", "-G",
     "--data-urlencode", `query=${query}`, "--data-urlencode", "format=json",
     "https://query.wikidata.org/sparql"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const split = out.lastIndexOf("\n");
  return { status: Number(out.slice(split + 1).trim()), body: out.slice(0, split) };
}

function curlJson(query) {
  const delays = [10000, 30000, 60000];
  let lastError = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    const { status, body } = runCurl(query);
    try {
      if (status !== 200) throw new Error(`HTTP ${status}`);
      return JSON.parse(body);
    } catch (e) {
      lastError = e;
      if (attempt < delays.length) {
        console.warn(`  retry ${attempt + 1} after ${e.message}; waiting ${delays[attempt] / 1000}s`);
        sleep(delays[attempt]);
      }
    }
  }
  throw lastError;
}

function cachedOrFetch(name, query) {
  const file = join(outDir, name);
  if (existsSync(file)) return { cached: true, data: JSON.parse(readFileSync(file, "utf8")) };
  const data = curlJson(query);
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return { cached: false, data };
}

// --- Phase A: per-club statements ---
let fetchedA = 0;
const clubFailures = [];
for (const club of pack.clubs) {
  const qid = club.id.replace("wd:", "");
  const query = `SELECT ?player ?rank ?start ?end ?point ?sex WHERE { ?player p:P54 ?stmt . ?stmt ps:P54 wd:${qid} . ?stmt wikibase:rank ?rank . OPTIONAL { ?stmt pq:P580 ?start . } OPTIONAL { ?stmt pq:P582 ?end . } OPTIONAL { ?stmt pq:P585 ?point . } OPTIONAL { ?player wdt:P21 ?sex . } }`;
  try {
    const { cached } = cachedOrFetch(`quality-club-${qid}.json`, query);
    if (!cached) fetchedA += 1;
  } catch (e) {
    clubFailures.push({ club: club.id, error: e.message });
    console.warn(`  FAILED club ${club.id}: ${e.message}`);
  }
  if ((pack.clubs.indexOf(club) + 1) % 25 === 0) {
    console.log(`  Phase A: ${pack.clubs.indexOf(club) + 1}/${pack.clubs.length} clubs (fresh: ${fetchedA})`);
  }
}
console.log(`Phase A done. Fresh fetches: ${fetchedA}, failures: ${clubFailures.length}`);

// --- Phase B: per-player statement sets, 200 per batch ---
const playerIds = [...new Set(pack.players.map((p) => p.id.replace("wd:", "")))];
const BATCH = 200;
let fetchedB = 0;
const playerFailures = [];
for (let i = 0; i < playerIds.length; i += BATCH) {
  const batch = playerIds.slice(i, i + BATCH);
  const values = batch.map((q) => `wd:${q}`).join(" ");
  const query = `SELECT ?player ?club ?clubLabel ?rank ?start ?end WHERE { VALUES ?player { ${values} } ?player p:P54 ?stmt . ?stmt ps:P54 ?club . ?stmt wikibase:rank ?rank . OPTIONAL { ?stmt pq:P580 ?start . } OPTIONAL { ?stmt pq:P582 ?end . } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const name = `quality-players-batch-${String(i / BATCH).padStart(2, "0")}.json`;
  try {
    const { cached } = cachedOrFetch(name, query);
    if (!cached) fetchedB += 1;
  } catch (e) {
    playerFailures.push({ batch: i / BATCH, error: e.message });
    console.warn(`  FAILED player batch ${i / BATCH}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 10 === 0) {
    console.log(`  Phase B: batch ${i / BATCH + 1}/${Math.ceil(playerIds.length / BATCH)} (fresh: ${fetchedB})`);
  }
}
console.log(`Phase B done. Fresh fetches: ${fetchedB}, failures: ${playerFailures.length}`);
console.log(JSON.stringify({ clubFailures, playerFailures }, null, 2));
