#!/usr/bin/env node
/**
 * Automated tests for the D1 data-pack generation + validation.
 *
 * Usage (same compile-then-test pattern as scripts/test-core.mjs):
 *   npx tsc src/game/data-pack.ts --outDir /tmp/fm-datapack --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/test-data-pack.mjs /tmp/fm-datapack [path/to/data-pack.json]
 *
 * Covers:
 *  1. A valid fixture pack passes.
 *  2. Validation catches: dangling club->league, dangling
 *     player->club, duplicate ids, missing manifest fields, and a
 *     record pointing at an unknown manifest entry.
 *  3. Missing factual fields are reported as gaps, not errors.
 *  4. The real pack (when given) is structurally valid, has all five
 *     leagues, and every manifest entry records source, licence,
 *     attribution and dates.
 *  5. Offline bundle: the real pack loads from disk with no network
 *     (this test performs no fetch at all).
 *  6. Determinism: rebuilding from cached raws produces a
 *     byte-identical data-pack.json (run separately, see D1 report).
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const compiledDir = process.argv[2];
const realPackPath = process.argv[3];
if (!compiledDir) {
  console.error("Usage: node scripts/test-data-pack.mjs <compiled-dir> [data-pack.json]");
  process.exit(2);
}
const { validateDataPack } = await import(
  pathToFileURL(join(resolve(compiledDir), "data-pack.js")).href
);

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
const hasCode = (report, code) => report.issues.some((i) => i.code === code);

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
    clubs: [{ id: "wd:Q2", name: "Test FC", leagueId: "wd:Q1", country: "Testland", sourceId: "wikidata-leagues" }],
    players: [
      {
        id: "wd:Q3",
        name: "Test Player",
        clubId: "wd:Q2",
        position: "Midfielder",
        dateOfBirth: "2000-01-01",
        sourceId: "wikidata-leagues",
      },
    ],
  };
}

// 1. Valid fixture passes.
{
  const r = validateDataPack(basePack());
  check("valid fixture pack passes", r.valid && r.issues.length === 0, JSON.stringify(r.issues));
}

// 2a. Dangling club -> league.
{
  const p = basePack();
  p.clubs[0].leagueId = "wd:Q999";
  check("dangling league reference caught", !validateDataPack(p).valid && hasCode(validateDataPack(p), "DANGLING_LEAGUE"));
}
// 2b. Dangling player -> club.
{
  const p = basePack();
  p.players[0].clubId = "wd:Q999";
  check("dangling club reference caught", !validateDataPack(p).valid && hasCode(validateDataPack(p), "DANGLING_CLUB"));
}
// 2c. Duplicate ids.
{
  const p = basePack();
  p.clubs.push({ ...p.clubs[0] });
  check("duplicate club id caught", !validateDataPack(p).valid && hasCode(validateDataPack(p), "DUPLICATE_ID"));
}
// 2d. Missing manifest licence.
{
  const p = basePack();
  delete p.sources[0].licence;
  check("missing manifest licence caught", !validateDataPack(p).valid && hasCode(validateDataPack(p), "SOURCE_NO_LICENCE"));
}
// 2e. Missing manifest attribution / dates.
{
  const p = basePack();
  delete p.sources[0].attribution;
  delete p.sources[0].fetchedAt;
  const r = validateDataPack(p);
  check(
    "missing manifest attribution and fetch date caught",
    !r.valid && hasCode(r, "SOURCE_NO_ATTRIBUTION") && hasCode(r, "SOURCE_NO_FETCH_DATE"),
  );
}
// 2f. Record pointing at an unknown manifest entry.
{
  const p = basePack();
  p.clubs[0].sourceId = "no-such-dataset";
  check("unknown manifest reference caught", !validateDataPack(p).valid && hasCode(validateDataPack(p), "UNKNOWN_SOURCE"));
}
// 2g. Non-object input.
{
  const r = validateDataPack("not a pack");
  check("non-object input rejected", !r.valid && hasCode(r, "NOT_AN_OBJECT"));
}

// 3. Missing factual fields are gaps, not errors.
{
  const p = basePack();
  delete p.players[0].position;
  delete p.players[0].dateOfBirth;
  const r = validateDataPack(p);
  check(
    "missing position/DOB reported as gaps, pack still valid",
    r.valid && hasCode(r, "PLAYER_NO_POSITION") && hasCode(r, "PLAYER_NO_DOB"),
    JSON.stringify(r.issues),
  );
}
// 3b. Club with no players is a gap, not an error.
{
  const p = basePack();
  p.players = [];
  const r = validateDataPack(p);
  check("club with no players reported as gap", r.valid && hasCode(r, "CLUB_NO_PLAYERS"));
}

// 4 + 5. Real pack checks (offline: read from disk only).
if (realPackPath) {
  if (!existsSync(resolve(realPackPath))) {
    check("real pack file exists", false, realPackPath);
  } else {
    const real = JSON.parse(readFileSync(resolve(realPackPath), "utf8"));
    const r = validateDataPack(real);
    check("real pack is structurally valid (no errors)", r.valid, JSON.stringify(r.issues.filter((i) => i.severity === "error").slice(0, 5)));
    check("real pack has 5 leagues", real.leagues.length === 5, `got ${real.leagues.length}`);
    check("real pack has clubs", real.clubs.length > 0, `got ${real.clubs.length}`);
    check("real pack has players", real.players.length > 0, `got ${real.players.length}`);
    const leagueNames = real.leagues.map((l) => l.name);
    for (const want of ["Premier League", "La Liga", "Serie A", "Bundesliga", "Ligue 1"]) {
      check(`real pack includes ${want}`, leagueNames.includes(want));
    }
    const manifestComplete = real.sources.every(
      (s) =>
        s.dataset && s.source && s.url && s.licence && s.attribution &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.fetchedAt ?? "") &&
        /^\d{4}-\d{2}-\d{2}$/.test(s.snapshotDate ?? "") &&
        typeof s.recordCount === "number",
    );
    check("every manifest entry records source, licence, attribution and dates", manifestComplete);
    const allCc0 = real.sources.every((s) => s.licence === "CC0-1.0");
    check("every manifest entry is CC0 (no proprietary dataset bundled)", allCc0);
    const noRatings = !JSON.stringify(real).includes("overall");
    check("pack carries facts only, no ratings fields", noRatings);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
