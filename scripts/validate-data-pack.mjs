#!/usr/bin/env node
/**
 * Validate a data-pack JSON file with the authoritative validator in
 * src/game/data-pack.ts, and write the validation report.
 *
 * Usage:
 *   node scripts/validate-data-pack.mjs <pack.json> <report.json> [cross-check.json]
 *
 * The TypeScript module is compiled to /tmp/fm-datapack first (the
 * same pattern as scripts/test-core.mjs), because the pack validator
 * is pure TypeScript with no react-native / expo imports.
 *
 * Exit code 1 when the report contains any "error" issue; gaps and
 * warnings do not fail the run but are listed in the report.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [packPath, reportPath, crossCheckPath] = process.argv.slice(2);
if (!packPath || !reportPath) {
  console.error("Usage: node scripts/validate-data-pack.mjs <pack.json> <report.json> [cross-check.json]");
  process.exit(2);
}

const OUT_DIR = "/tmp/fm-datapack";
execFileSync(
  "npx",
  [
    "tsc",
    "src/game/data-pack.ts",
    "--outDir",
    OUT_DIR,
    "--module",
    "commonjs",
    "--target",
    "es2020",
    "--skipLibCheck",
    "--ignoreConfig",
  ],
  { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
);

const { validateDataPack } = await import(
  pathToFileURL(join(OUT_DIR, "data-pack.js")).href
);
const pack = JSON.parse(readFileSync(resolve(packPath), "utf8"));
const report = validateDataPack(pack);
if (crossCheckPath && existsSync(resolve(crossCheckPath))) {
  report.crossCheck = JSON.parse(readFileSync(resolve(crossCheckPath), "utf8"));
  const notes = [];
  for (const cc of Object.values(report.crossCheck)) {
    notes.push(
      `${cc.league}: ${cc.matched} of ${cc.openfootballTeams} openfootball teams matched in Wikidata; ` +
        `${cc.wikidataClubsNotInOpenfootball.length > 0 ? `Wikidata clubs missing from openfootball sample: ${cc.wikidataClubsNotInOpenfootball.join(", ")}` : "no Wikidata club missing from the openfootball sample"}.`,
    );
  }
  report.notes = notes;
}
writeFileSync(resolve(reportPath), JSON.stringify(report, null, 2) + "\n", "utf8");
const errors = report.issues.filter((i) => i.severity === "error").length;
const gaps = report.issues.filter((i) => i.severity === "gap").length;
const warnings = report.issues.filter((i) => i.severity === "warning").length;
console.log(
  `valid: ${report.valid} | leagues: ${report.counts.leagues}, clubs: ${report.counts.clubs}, players: ${report.counts.players}, sources: ${report.counts.sources} | errors: ${errors}, warnings: ${warnings}, gaps: ${gaps}`,
);
if (!report.valid) {
  for (const issue of report.issues.filter((i) => i.severity === "error").slice(0, 20)) {
    console.log(`  ERROR ${issue.code}: ${issue.message}`);
  }
  process.exit(1);
}
