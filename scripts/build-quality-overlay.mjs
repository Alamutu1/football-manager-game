#!/usr/bin/env node
/**
 * D3 overlay builder: turns cached live Wikidata responses into
 * data-packs/v1/quality.json, one classified entry per pack
 * association. Nothing is invented: every status comes from the
 * cached responses, and the reasoning is the pure classifier in
 * src/game/data-quality.ts (compiled here for the build).
 *
 * Inputs (all under data-packs/v1/raw/quality/, missing files are
 * tolerated and degrade their players to "uncertain", never a crash):
 * - quality-club-*.json (Phase A): statements pointing at each club
 * - quality-players-batch-*.json (Phase B): each player's full P54 set
 * - quality-desc-batch-*.json (Phase C): each player's description
 *
 * Usage:
 *   npx tsc src/game/data-quality.ts --outDir /tmp/fm-dq --module commonjs --target es2020 --skipLibCheck --ignoreConfig
 *   node scripts/build-quality-overlay.mjs data-packs/v1/data-pack.json /tmp/fm-dq \
 *     data-packs/v1/quality.json data-packs/v1/quality-summary.json
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [packPath, compiledDir, outPath, summaryPath] = process.argv.slice(2);
if (!packPath || !compiledDir || !outPath || !summaryPath) {
  console.error("Usage: node scripts/build-quality-overlay.mjs <data-pack.json> <compiled-dir> <quality.json> <summary.json>");
  process.exit(2);
}
const { classifyAssociation } = await import(
  pathToFileURL(join(resolve(compiledDir), "data-quality.js")).href
);

const pack = JSON.parse(readFileSync(packPath, "utf8"));
const rawDir = "data-packs/v1/raw/quality";
const today = new Date().toISOString().slice(0, 10);

const packClubIds = new Set(pack.clubs.map((c) => c.id));
const clubLabelById = new Map(pack.clubs.map((c) => [c.id, c.name]));

function bindingsOf(file) {
  try {
    const data = JSON.parse(readFileSync(file, "utf8"));
    return data?.results?.bindings ?? [];
  } catch {
    return [];
  }
}
function qidOf(uri) {
  const m = String(uri ?? "").match(/Q\d+$/);
  return m ? `wd:${m[0]}` : null;
}
function rankOf(uri) {
  if (String(uri).includes("PreferredRank")) return "preferred";
  if (String(uri).includes("DeprecatedRank")) return "deprecated";
  return "normal";
}
function kindOf(clubId, label) {
  if (packClubIds.has(clubId)) return "pack_club";
  const l = label ?? "";
  if (/national/i.test(l) && /team/i.test(l)) return "national";
  if (/regional/i.test(l) && /team/i.test(l)) return "regional";
  if (/women|f[eé]minine|ladies|female/i.test(l)) return "womens";
  if (/\bU ?\d+\b| II$|Jong |Mestalla| Academy|Youth| B$/.test(l)) return "youth_reserve";
  return "other_senior";
}

// --- Phase B: per-player statement sets ---
const statementsByPlayer = new Map();
const playersSeenLive = new Set();
if (existsSync(rawDir)) {
  for (const file of readdirSync(rawDir).filter((f) => f.startsWith("quality-players-batch-"))) {
    for (const b of bindingsOf(join(rawDir, file))) {
      const playerId = qidOf(b.player?.value);
      const clubId = qidOf(b.club?.value);
      if (!playerId || !clubId) continue;
      playersSeenLive.add(playerId);
      if (!statementsByPlayer.has(playerId)) statementsByPlayer.set(playerId, []);
      statementsByPlayer.get(playerId).push({
        clubId,
        clubLabel: b.clubLabel?.value ?? clubLabelById.get(clubId) ?? clubId,
        rank: rankOf(b.rank?.value),
        start: b.start?.value,
        end: b.end?.value,
        kind: kindOf(clubId, b.clubLabel?.value ?? ""),
      });
    }
  }
}

// --- Phase A: sex per player + live per-club current counts ---
const femaleByPlayer = new Map();
const liveCurrentByClub = new Map();
if (existsSync(rawDir)) {
  for (const file of readdirSync(rawDir).filter((f) => f.startsWith("quality-club-"))) {
    const clubQid = file.replace("quality-club-", "").replace(".json", "");
    const clubId = `wd:${clubQid}`;
    const current = new Set();
    for (const b of bindingsOf(join(rawDir, file))) {
      const playerId = qidOf(b.player?.value);
      if (!playerId) continue;
      const sexQid = qidOf(b.sex?.value);
      if (sexQid === "wd:Q6581072") femaleByPlayer.set(playerId, true);
      else if (sexQid === "wd:Q6581097" && !femaleByPlayer.has(playerId)) femaleByPlayer.set(playerId, false);
      const rank = rankOf(b.rank?.value);
      if (rank !== "deprecated" && !b.end?.value) current.add(playerId);
    }
    liveCurrentByClub.set(clubId, current.size);
  }
}

// --- Phase C: descriptions ---
const descriptionByPlayer = new Map();
if (existsSync(rawDir)) {
  for (const file of readdirSync(rawDir).filter((f) => f.startsWith("quality-desc-batch-"))) {
    try {
      const data = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
      for (const [qid, entity] of Object.entries(data.entities ?? {})) {
        const desc = entity?.descriptions?.en?.value;
        if (desc) descriptionByPlayer.set(`wd:${qid}`, desc);
      }
    } catch {
      // tolerates a corrupt batch: those players simply lack descriptions
    }
  }
}

// --- Classify every pack association ---
const entries = [];
const statusCounts = { verified_current: 0, historical: 0, conflicting: 0, uncertain: 0 };
const fictionalPlayers = [];
const conflictingPlayers = [];
for (const player of pack.players) {
  const statements = statementsByPlayer.get(player.id) ?? [];
  const live = playersSeenLive.has(player.id);
  const result = classifyAssociation({
    statements,
    packClubId: player.clubId,
    female: femaleByPlayer.get(player.id) === true,
    description: descriptionByPlayer.get(player.id),
    liveDataAvailable: live,
  });
  entries.push({
    playerId: player.id,
    clubId: player.clubId,
    status: result.status,
    reason: result.reason,
    evidence: result.evidence,
  });
  statusCounts[result.status] += 1;
  if (result.evidence.description && /fictional/i.test(result.evidence.description)) {
    fictionalPlayers.push({ id: player.id, name: player.name, club: clubLabelById.get(player.clubId), description: result.evidence.description });
  }
  if (result.status === "conflicting") {
    conflictingPlayers.push({ id: player.id, name: player.name, club: clubLabelById.get(player.clubId), also: result.evidence.otherCurrentClubs });
  }
}

const overlay = {
  version: 1,
  packVersion: `v${pack.version}@${pack.snapshotDate}`,
  generatedAt: today,
  method:
    "Live Wikidata P54 re-check (Nov 2026): per-club statements + per-player statement sets + item descriptions. " +
    "verified_current = non-deprecated, no-end-date statement at the club and no other senior current club. " +
    "See src/game/data-quality.ts for the exact rules.",
  entries,
};
writeFileSync(outPath, JSON.stringify(overlay, null, 2) + "\n");

// --- Summary for the coverage report ---
const perClub = pack.clubs.map((club) => {
  const clubEntries = entries.filter((e) => e.clubId === club.id);
  const counts = { verified_current: 0, historical: 0, conflicting: 0, uncertain: 0 };
  for (const e of clubEntries) counts[e.status] += 1;
  return {
    id: club.id,
    name: club.name,
    league: pack.leagues.find((l) => l.id === club.leagueId)?.name ?? club.leagueId,
    packPlayers: clubEntries.length,
    liveCurrentPlayers: liveCurrentByClub.get(club.id) ?? null,
    ...counts,
  };
});
const perLeague = pack.leagues.map((league) => {
  const clubs = perClub.filter((c) => c.league === league.name);
  const sum = (k) => clubs.reduce((a, c) => a + c[k], 0);
  return {
    name: league.name,
    clubs: clubs.length,
    packPlayers: sum("packPlayers"),
    verified_current: sum("verified_current"),
    historical: sum("historical"),
    conflicting: sum("conflicting"),
    uncertain: sum("uncertain"),
  };
});
const summary = {
  generatedAt: today,
  packVersion: overlay.packVersion,
  totals: { associations: entries.length, ...statusCounts },
  perLeague,
  perClub,
  fictionalPlayers,
  conflictingPlayers,
};
writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");

console.log(`Entries: ${entries.length}`);
console.log(`Status counts: ${JSON.stringify(statusCounts)}`);
console.log(`Fictional-flagged players: ${fictionalPlayers.length}`);
console.log(`Conflicting players: ${conflictingPlayers.length}`);
for (const l of perLeague) {
  console.log(`- ${l.name}: ${l.packPlayers} players -> verified ${l.verified_current}, historical ${l.historical}, conflicting ${l.conflicting}, uncertain ${l.uncertain}`);
}
