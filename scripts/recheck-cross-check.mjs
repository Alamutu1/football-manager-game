#!/usr/bin/env node
/**
 * D3 cross-check re-run: match openfootball 2024-25 team names to
 * Wikidata club names with the D3 normaliser (diacritics, suffixes,
 * and the explicit alias table), and compare against the D1
 * raw-string match counts. No data is changed; this only reports.
 *
 * Usage:
 *   npx tsc src/game/data-quality.ts --outDir /tmp/fm-dq --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/recheck-cross-check.mjs data-packs/v1/data-pack.json /tmp/fm-dq \
 *     data-packs/v1/cross-check-v2.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [packPath, compiledDir, outPath] = process.argv.slice(2);
if (!packPath || !compiledDir || !outPath) {
  console.error("Usage: node scripts/recheck-cross-check.mjs <data-pack.json> <compiled-dir> <out.json>");
  process.exit(2);
}
const { normalizeClubName } = await import(
  pathToFileURL(join(resolve(compiledDir), "data-quality.js")).href
);

const pack = JSON.parse(readFileSync(packPath, "utf8"));
const old = JSON.parse(readFileSync("data-packs/v1/cross-check.json", "utf8"));

const LEAGUE_FILES = {
  "Premier League": "openfootball-en.1.json",
  "La Liga": "openfootball-es.1.json",
  "Serie A": "openfootball-it.1.json",
  Bundesliga: "openfootball-de.1.json",
  "Ligue 1": "openfootball-fr.1.json",
};

const result = {};
for (const league of pack.leagues) {
  const file = LEAGUE_FILES[league.name];
  const raw = JSON.parse(readFileSync(`data-packs/v1/raw/${file}`, "utf8"));
  const teams = [...new Set(raw.matches.flatMap((m) => [m.team1, m.team2]))];
  const wdClubs = pack.clubs.filter((c) => c.leagueId === league.id);
  const byNormalized = new Map();
  for (const c of wdClubs) {
    const n = normalizeClubName(c.name);
    if (!byNormalized.has(n)) byNormalized.set(n, []);
    byNormalized.get(n).push(c.name);
  }
  const matched = [];
  const unmatched = [];
  for (const team of teams) {
    const n = normalizeClubName(team);
    if (byNormalized.has(n)) matched.push({ openfootball: team, wikidata: byNormalized.get(n) });
    else unmatched.push(team);
  }
  const oldEntry = Object.values(old).find((o) => o.league === league.name);
  result[league.name] = {
    openfootballTeams: teams.length,
    wikidataClubs: wdClubs.length,
    matched: matched.length,
    oldMatched: oldEntry?.matched ?? null,
    unmatchedOpenfootballTeams: unmatched,
    matchedPairs: matched,
  };
  console.log(`${league.name}: ${matched.length}/${teams.length} matched (D1 raw-string: ${oldEntry?.matched ?? "?"})`);
  if (unmatched.length > 0) console.log(`  still unmatched: ${unmatched.join(", ")}`);
}
writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");
