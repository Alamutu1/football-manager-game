#!/usr/bin/env node
/**
 * D3 Phase C: fetch the English description of every pack player's
 * Wikidata item (wbgetentities, 50 items per request, cached).
 *
 * Purpose: catch wrong-identity items the D1 query could not see.
 * The known case is wd:Q123410299 "Kylian Mbappé", whose
 * description is "fictional character from the 2023 video game
 * EA Sports FC 24" — a fictional character, not the footballer.
 * The classifier flags any pack player whose description contains
 * "fictional" as uncertain, with the description quoted as evidence.
 * No description is ever invented: only the API's own text is used.
 *
 * Usage:
 *   node scripts/fetch-descriptions.mjs data-packs/v1/data-pack.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packPath = process.argv[2];
if (!packPath) {
  console.error("Usage: node scripts/fetch-descriptions.mjs <data-pack.json>");
  process.exit(2);
}
const pack = JSON.parse(readFileSync(packPath, "utf8"));
const outDir = "data-packs/v1/raw/quality";
mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function curlJson(url) {
  const delays = [10000, 30000];
  let lastError = null;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      const out = execFileSync("curl", ["-s", "--max-time", "60", url], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      const parsed = JSON.parse(out);
      if (!parsed.success) throw new Error("API success != 1");
      return parsed;
    } catch (e) {
      lastError = e;
      if (attempt < delays.length) sleep(delays[attempt]);
    }
  }
  throw lastError;
}

const ids = [...new Set(pack.players.map((p) => p.id.replace("wd:", "")))];
const BATCH = 50;
let fresh = 0;
const failures = [];
for (let i = 0; i < ids.length; i += BATCH) {
  const batch = ids.slice(i, i + BATCH);
  const name = `quality-desc-batch-${String(i / BATCH).padStart(3, "0")}.json`;
  const file = join(outDir, name);
  if (existsSync(file)) continue;
  // ids already carry their Q prefix (pack ids are "wd:Q..."), so join as-is.
  const url =
    "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" +
    batch.join("|") +
    "&props=labels|descriptions&languages=en&format=json";
  try {
    const data = curlJson(url);
    writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
    fresh += 1;
  } catch (e) {
    failures.push({ batch: i / BATCH, error: e.message });
    console.warn(`  FAILED desc batch ${i / BATCH}: ${e.message}`);
  }
  if ((i / BATCH + 1) % 25 === 0) {
    console.log(`  Descriptions: batch ${i / BATCH + 1}/${Math.ceil(ids.length / BATCH)} (fresh: ${fresh})`);
  }
}
console.log(`Descriptions done. Fresh: ${fresh}, failures: ${failures.length}`);
if (failures.length > 0) console.log(JSON.stringify(failures, null, 2));
