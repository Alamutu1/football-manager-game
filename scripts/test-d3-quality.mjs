#!/usr/bin/env node
/**
 * Automated tests for the D3 data-quality layer.
 *
 * Usage (same compile-then-test pattern as the other suites):
 *   npx tsc src/game/data-quality.ts --outDir /tmp/fm-dq --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/test-d3-quality.mjs /tmp/fm-dq [data-pack.json] [quality.json] [cross-check-v2.json]
 *
 * Covers:
 *  1. Classification rules on fixtures (current, ended, absent,
 *     deprecated-only, conflicting, national/youth ignored,
 *     women's-section, fictional item, no live data, return-after-
 *     leaving).
 *  2. Name normaliser pairs (Real Madrid, Bayern, Inter, Atlético).
 *  3. Overlay loading: valid input kept, malformed entries dropped,
 *     garbage input yields null without throwing.
 *  4. Club summary counts, including unverified players.
 *  5. Real overlay integrity (when given): every entry is a real
 *     pack association, every association has exactly one entry,
 *     counts sum to the pack size, and the named investigations
 *     come out as expected (Akliouche + Anderson verified current,
 *     Kiedrzynek uncertain, fictional Mbappé uncertain).
 *  6. Cross-check re-run (when given): normalised matching never
 *     scores below the D1 raw-string counts.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [compiledDir, packPath, qualityPath, crossPath] = process.argv.slice(2);
if (!compiledDir) {
  console.error("Usage: node scripts/test-d3-quality.mjs <compiled-dir> [data-pack.json] [quality.json] [cross-check-v2.json]");
  process.exit(2);
}
const dq = await import(pathToFileURL(join(resolve(compiledDir), "data-quality.js")).href);
const { classifyAssociation, loadQuality, clubSummary, normalizeClubName, statusLabel } = dq;
const { dedupeClubs } = await import("./club-dedupe.mjs");

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

const CLUB = "wd:Q1";
const OTHER = "wd:Q2";
const stmt = (clubId, overrides = {}) => ({
  clubId,
  clubLabel: overrides.label ?? clubId,
  rank: overrides.rank ?? "normal",
  start: overrides.start,
  end: overrides.end,
  kind: overrides.kind ?? "pack_club",
});
const classify = (statements, opts = {}) =>
  classifyAssociation({
    statements,
    packClubId: CLUB,
    female: opts.female ?? false,
    description: opts.description,
    liveDataAvailable: opts.live ?? true,
  });

// --- 1. Classification fixtures ---
check("current statement, no others -> verified_current",
  classify([stmt(CLUB)]).status === "verified_current");
check("ended statement only -> historical with end date",
  (() => {
    const r = classify([stmt(CLUB, { end: "2024-06-30T00:00:00Z" })]);
    return r.status === "historical" && r.reason.includes("2024-06-30");
  })());
check("no statement to the club -> historical (absent)",
  classify([stmt(OTHER)]).status === "historical");
check("deprecated only -> historical",
  classify([stmt(CLUB, { rank: "deprecated" })]).status === "historical");
check("current to club + current to another pack club -> conflicting",
  (() => {
    const r = classify([stmt(CLUB), stmt(OTHER, { label: "Other FC" })]);
    return r.status === "conflicting" && r.reason.includes("Other FC");
  })());
check("current to club + national team -> still verified (national ignored)",
  classify([stmt(CLUB), stmt(OTHER, { kind: "national", label: "France national team" })]).status === "verified_current");
check("current to club + youth team -> still verified (youth ignored)",
  classify([stmt(CLUB), stmt(OTHER, { kind: "youth_reserve", label: "Club U21" })]).status === "verified_current");
check("current to club + other senior club -> conflicting",
  classify([stmt(CLUB), stmt(OTHER, { kind: "other_senior", label: "Faraway FC" })]).status === "conflicting");
check("female + current to club -> uncertain (women's section)",
  classify([stmt(CLUB)], { female: true }).status === "uncertain");
check("fictional description -> uncertain even with current statement",
  classify([stmt(CLUB)], { description: "fictional character from a video game" }).status === "uncertain");
check("no live data -> uncertain, no throw",
  classify([stmt(CLUB)], { live: false }).status === "uncertain");
check("ended + current to same club (returned) -> verified_current",
  classify([stmt(CLUB, { end: "2015-01-01T00:00:00Z" }), stmt(CLUB, { start: "2026-08-09T00:00:00Z", rank: "preferred" })]).status === "verified_current");
check("preferred points at pack club despite stale other -> verified_current",
  classify([stmt(CLUB, { rank: "preferred" }), stmt(OTHER, { label: "Old FC" })]).status === "verified_current");
check("preferred points away from pack club -> historical",
  (() => {
    const r = classify([stmt(CLUB), stmt(OTHER, { rank: "preferred", label: "New FC" })]);
    return r.status === "historical" && r.reason.includes("New FC");
  })());
check("two preferred current clubs -> conflicting (Wikidata disagrees with itself)",
  classify([stmt(CLUB, { rank: "preferred" }), stmt(OTHER, { rank: "preferred", label: "Other FC" })]).status === "conflicting");
check("current to club + regional team -> still verified (regional ignored)",
  classify([stmt(CLUB), stmt(OTHER, { kind: "regional", label: "Basque Country regional football team" })]).status === "verified_current");

// --- 2. Normaliser ---
const eq = (a, b) => normalizeClubName(a) === normalizeClubName(b);
check("normaliser: Real Madrid CF == Real Madrid Club de Fútbol", eq("Real Madrid CF", "Real Madrid Club de Fútbol"));
check("normaliser: FC Bayern München == FC Bayern Munich", eq("FC Bayern München", "FC Bayern Munich"));
check("normaliser: Inter Milan == FC Internazionale Milano", eq("Inter Milan", "FC Internazionale Milano"));
check("normaliser: Club Atlético de Madrid == Atlético Madrid", eq("Club Atlético de Madrid", "Atlético Madrid"));
check("normaliser: Arsenal F.C. != Chelsea F.C.", !eq("Arsenal F.C.", "Chelsea F.C."));
check("normaliser: CA Osasuna == Osasuna", eq("CA Osasuna", "Osasuna"));
check("normaliser: dotted F.C. collapses (Arsenal F.C. == Arsenal FC)", eq("Arsenal F.C.", "Arsenal FC"));
check("normaliser: trailing founding year dropped (Stade Rennais FC 1901 == Stade Rennais F.C.)", eq("Stade Rennais FC 1901", "Stade Rennais F.C."));
check("normaliser: VfL Bochum 1848 == VfL Bochum", eq("VfL Bochum 1848", "VfL Bochum"));
check("normaliser: Racing Club de Lens == RC Lens (observed alias)", eq("Racing Club de Lens", "RC Lens"));

// --- 3. Overlay loading ---
check("loadQuality(null) -> null", loadQuality(null) === null);
check("loadQuality({}) -> null", loadQuality({}) === null);
check("loadQuality keeps valid, drops malformed",
  (() => {
    const q = loadQuality({
      entries: [
        { playerId: "wd:Q1", clubId: "wd:Q9", status: "verified_current", reason: "", evidence: { liveClubStatement: "current", otherCurrentClubs: [] } },
        { playerId: "wd:Q2", clubId: "wd:Q9", status: "bogus", reason: "", evidence: {} },
        { playerId: 42, clubId: "wd:Q9", status: "historical" },
      ],
    });
    return q !== null && q.entries.length === 1 && q.entries[0].playerId === "wd:Q1";
  })());
check("loadQuality never throws on garbage",
  (() => {
    try {
      return loadQuality("junk") === null && loadQuality([1, 2]) === null;
    } catch {
      return false;
    }
  })());

// --- 4. Club summary ---
check("clubSummary counts verified/historical/unverified",
  (() => {
    const q = loadQuality({
      entries: [
        { playerId: "wd:Q1", clubId: "wd:Q9", status: "verified_current", reason: "", evidence: { liveClubStatement: "current", otherCurrentClubs: [] } },
        { playerId: "wd:Q2", clubId: "wd:Q9", status: "historical", reason: "", evidence: { liveClubStatement: "ended", otherCurrentClubs: [] } },
      ],
    });
    const s = clubSummary(q, "wd:Q9", ["wd:Q1", "wd:Q2", "wd:Q3"]);
    return s.total === 3 && s.verified === 1 && s.historical === 1 && s.unverified === 1;
  })());
check("statusLabel values", statusLabel("verified_current") === "Current" && statusLabel("historical") === "Left");

// --- 4b. Club dedup ---
check("dedupe: zero-player duplicate dropped, main kept",
  (() => {
    const clubs = [
      { id: "wd:Q19518", name: "Toulouse FC" },
      { id: "wd:Q2422417", name: "Toulouse FC" },
      { id: "wd:Q1", name: "Other FC" },
    ];
    const counts = new Map([["wd:Q19518", 40], ["wd:Q2422417", 0], ["wd:Q1", 5]]);
    const { kept, dropped } = dedupeClubs(clubs, counts);
    return kept.length === 2 && dropped.length === 1 && dropped[0].id === "wd:Q2422417";
  })());
check("dedupe: split across two items keeps both (no orphaning)",
  (() => {
    const clubs = [
      { id: "wd:Q1", name: "Same FC" },
      { id: "wd:Q2", name: "Same FC" },
    ];
    const counts = new Map([["wd:Q1", 10], ["wd:Q2", 3]]);
    const { kept, dropped } = dedupeClubs(clubs, counts);
    return kept.length === 2 && dropped.length === 0;
  })());
check("dedupe: distinct names untouched",
  (() => {
    const clubs = [
      { id: "wd:Q1", name: "Arsenal F.C." },
      { id: "wd:Q2", name: "Chelsea F.C." },
    ];
    const { kept, dropped } = dedupeClubs(clubs, new Map());
    return kept.length === 2 && dropped.length === 0;
  })());

// --- 5. Real overlay integrity ---
if (packPath && qualityPath && existsSync(packPath) && existsSync(qualityPath)) {
  const pack = JSON.parse(readFileSync(packPath, "utf8"));
  const quality = loadQuality(JSON.parse(readFileSync(qualityPath, "utf8")));
  check("real overlay loads", quality !== null);
  if (quality) {
    const assocKeys = new Set(pack.players.map((p) => `${p.id}|${p.clubId}`));
    const entryKeys = quality.entries.map((e) => `${e.playerId}|${e.clubId}`);
    check("every overlay entry is a real pack association",
      quality.entries.every((e) => assocKeys.has(`${e.playerId}|${e.clubId}`)));
    check("every pack association has exactly one entry",
      entryKeys.length === assocKeys.size && new Set(entryKeys).size === entryKeys.length);
    const counts = { verified_current: 0, historical: 0, conflicting: 0, uncertain: 0 };
    for (const e of quality.entries) counts[e.status] += 1;
    const sum = Object.values(counts).reduce((a, b) => a + b, 0);
    check("status counts sum to the pack size", sum === pack.players.length, `sum=${sum} pack=${pack.players.length}`);
    const find = (playerId, clubId) => quality.entries.find((e) => e.playerId === playerId && e.clubId === clubId);
    const psg = pack.clubs.find((c) => c.name.includes("Paris Saint-Germain")).id;
    const city = pack.clubs.find((c) => c.name.includes("Manchester City")).id;
    const akl = find("wd:Q108910786", psg);
    check("Akliouche under PSG -> verified_current (D1 example corrected)", akl?.status === "verified_current", `got ${akl?.status}`);
    const and = find("wd:Q104762954", city);
    check("Elliot Anderson under City -> verified_current (D1 example corrected)", and?.status === "verified_current", `got ${and?.status}`);
    const kie = find("wd:Q16648117", psg);
    check("Kiedrzynek under PSG -> uncertain (women's section)", kie?.status === "uncertain", `got ${kie?.status}`);
    const fic = find("wd:Q123410299", psg);
    check("fictional Mbappé under PSG -> uncertain with fictional reason",
      fic?.status === "uncertain" && (fic?.reason ?? "").includes("fictional"), `got ${fic?.status}`);
    check("no overlay entry invents a player id",
      quality.entries.every((e) => pack.players.some((p) => p.id === e.playerId)));
  }
} else {
  console.log("SKIP: real-overlay checks (pack/quality path missing)");
}

// --- 6. Cross-check re-run ---
if (crossPath && existsSync(crossPath)) {
  const recheck = JSON.parse(readFileSync(crossPath, "utf8"));
  const old = JSON.parse(readFileSync("data-packs/v1/cross-check.json", "utf8"));
  let ok = true;
  for (const league of Object.keys(recheck)) {
    const oldEntry = Object.values(old).find((o) => o.league === league);
    if (oldEntry && recheck[league].matched < oldEntry.matched) ok = false;
  }
  check("normalised matching never scores below D1 raw-string counts", ok);
  console.log("  normalised totals:", Object.entries(recheck).map(([l, r]) => `${l} ${r.matched}/${r.openfootballTeams}`).join("; "));
} else {
  console.log("SKIP: cross-check re-run (no cross-check-v2 path)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
