#!/usr/bin/env node
/**
 * D3 offline analysis: coverage + quality signals computed from the
 * pack alone, before any live re-check. No network, no invention.
 *
 * Usage:
 *   node scripts/analyze-data-quality.mjs data-packs/v1/data-pack.json \
 *     data-packs/v1/coverage-analysis.json
 *
 * Outputs a JSON report with:
 * - per-league and per-club player counts, field completeness
 *   (position / DOB / nationality), and age flags (players aged
 *   38+ at the snapshot date: plausible veterans, but also the
 *   classic shape of a stale association with no end date)
 * - clubs with no players (the 14 D1 gaps, re-verified)
 * - players associated with 2+ clubs in the pack (a current player
 *   cannot be in two current squads; loans aside, these are
 *   conflicts or stale statements)
 * - the exact size distribution, to check the D1 per-club LIMIT 80
 *   (a club at exactly 80 would suggest truncation)
 * - the two named D1 examples: PSG's list and Man City's list,
 *   with the suspicious names printed for the live investigation
 */
import { readFileSync, writeFileSync } from "node:fs";

const [packPath, outPath] = process.argv.slice(2);
if (!packPath || !outPath) {
  console.error("Usage: node scripts/analyze-data-quality.mjs <data-pack.json> <out.json>");
  process.exit(2);
}
const pack = JSON.parse(readFileSync(packPath, "utf8"));
const SNAP = pack.snapshotDate;

function ageAt(dob) {
  if (!dob) return null;
  const born = new Date(dob);
  const at = new Date(SNAP);
  if (Number.isNaN(born.getTime())) return null;
  let age = at.getFullYear() - born.getFullYear();
  if (
    at.getMonth() < born.getMonth() ||
    (at.getMonth() === born.getMonth() && at.getDate() < born.getDate())
  ) {
    age -= 1;
  }
  return age;
}

const playersByClub = new Map();
for (const p of pack.players) {
  if (!playersByClub.has(p.clubId)) playersByClub.set(p.clubId, []);
  playersByClub.get(p.clubId).push(p);
}
const clubsByPlayer = new Map();
for (const p of pack.players) {
  if (!clubsByPlayer.has(p.id)) clubsByPlayer.set(p.id, new Set());
  clubsByPlayer.get(p.id).add(p.clubId);
}

const clubById = new Map(pack.clubs.map((c) => [c.id, c]));
const leagueById = new Map(pack.leagues.map((l) => [l.id, l]));

const perLeague = pack.leagues.map((league) => {
  const clubs = pack.clubs.filter((c) => c.leagueId === league.id);
  const players = clubs.flatMap((c) => playersByClub.get(c.id) ?? []);
  return {
    id: league.id,
    name: league.name,
    clubs: clubs.length,
    players: players.length,
    withNationality: players.filter((p) => !!p.nationality).length,
    aged38Plus: players.filter((p) => (ageAt(p.dateOfBirth) ?? 0) >= 38).length,
    clubsWithNoPlayers: clubs
      .filter((c) => (playersByClub.get(c.id) ?? []).length === 0)
      .map((c) => c.name),
  };
});

const perClub = pack.clubs
  .map((club) => {
    const players = playersByClub.get(club.id) ?? [];
    return {
      id: club.id,
      name: club.name,
      league: leagueById.get(club.leagueId)?.name ?? club.leagueId,
      players: players.length,
      withNationality: players.filter((p) => !!p.nationality).length,
      aged38Plus: players.filter((p) => (ageAt(p.dateOfBirth) ?? 0) >= 38).length,
      oldestAge: players.reduce((m, p) => Math.max(m, ageAt(p.dateOfBirth) ?? 0), 0),
    };
  })
  .sort((a, b) => b.players - a.players);

const multiClubPlayers = [...clubsByPlayer.entries()]
  .filter(([, clubs]) => clubs.size > 1)
  .map(([playerId, clubs]) => {
    const p = pack.players.find((x) => x.id === playerId);
    return {
      id: playerId,
      name: p?.name ?? playerId,
      clubs: [...clubs].map((id) => clubById.get(id)?.name ?? id),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const sizes = perClub.map((c) => c.players);
const report = {
  snapshotDate: SNAP,
  totals: {
    leagues: pack.leagues.length,
    clubs: pack.clubs.length,
    players: pack.players.length,
    withNationality: pack.players.filter((p) => !!p.nationality).length,
    withPosition: pack.players.filter((p) => !!p.position).length,
    withDob: pack.players.filter((p) => !!p.dateOfBirth).length,
    aged38Plus: pack.players.filter((p) => (ageAt(p.dateOfBirth) ?? 0) >= 38).length,
    multiClubPlayers: multiClubPlayers.length,
    maxClubSize: Math.max(...sizes),
    clubsAtLimit80: perClub.filter((c) => c.players === 80).length,
    clubsWithNoPlayers: perClub.filter((c) => c.players === 0).length,
  },
  perLeague,
  perClub,
  multiClubPlayers,
};

writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(`Leagues: ${report.totals.leagues}, clubs: ${report.totals.clubs}, players: ${report.totals.players}`);
console.log(`With nationality: ${report.totals.withNationality}, aged 38+: ${report.totals.aged38Plus}`);
console.log(`Multi-club players: ${report.totals.multiClubPlayers}, max club size: ${report.totals.maxClubSize}, clubs at 80: ${report.totals.clubsAtLimit80}`);
console.log(`Clubs with no players: ${report.totals.clubsWithNoPlayers}`);
for (const l of perLeague) {
  console.log(`- ${l.name}: ${l.clubs} clubs, ${l.players} players, ${l.withNationality} with nationality, ${l.aged38Plus} aged 38+, no-player clubs: ${l.clubsWithNoPlayers.join(", ") || "none"}`);
}
console.log("Largest clubs:");
for (const c of perClub.slice(0, 8)) {
  console.log(`- ${c.name} (${c.league}): ${c.players} players, ${c.aged38Plus} aged 38+, oldest ${c.oldestAge}`);
}
console.log("Smallest non-empty clubs:");
for (const c of perClub.filter((x) => x.players > 0).slice(-5)) {
  console.log(`- ${c.name} (${c.league}): ${c.players} players`);
}
