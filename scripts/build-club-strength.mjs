/**
 * Build data-packs/v1/club-strength.json from the pack's own 2024–25
 * openfootball results (raw cache) plus the D3 cross-check pairs.
 *
 * This is a DERIVED file, not an edit to the frozen v1 pack: it ranks
 * each league's clubs by points then goal difference and maps rank to
 * a modifier from +4 (champion) to −4 (last). Clubs with no 2024–25
 * results are simply absent (callers treat absence as modifier 0).
 *
 * Usage:
 *   node scripts/build-club-strength.mjs [packPath] [crossCheckPath] [outPath]
 * Defaults assume data-packs/v1/.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packPath = process.argv[2] || join(here, '..', 'data-packs', 'v1', 'data-pack.json');
const xcheckPath =
  process.argv[3] || join(here, '..', 'data-packs', 'v1', 'cross-check-v2.json');
const outPath = process.argv[4] || join(here, '..', 'data-packs', 'v1', 'club-strength.json');
const rawDir = join(dirname(packPath), 'raw');

const pack = JSON.parse(readFileSync(packPath, 'utf8'));
const xcheck = JSON.parse(readFileSync(xcheckPath, 'utf8'));

const nameToClub = new Map(pack.clubs.map((c) => [c.name, c]));
const teamToClub = new Map();
const unmatched = [];
for (const lg of Object.values(xcheck)) {
  for (const pair of lg.matchedPairs || []) {
    const club = nameToClub.get(pair.wikidata[0]);
    if (club) teamToClub.set(pair.openfootball, club.id);
    else unmatched.push(pair.openfootball);
  }
}

const stats = new Map();
for (const f of readdirSync(rawDir).filter((x) => x.startsWith('openfootball-'))) {
  const raw = JSON.parse(readFileSync(join(rawDir, f), 'utf8'));
  for (const m of raw.matches || []) {
    const h = teamToClub.get(m.team1);
    const a = teamToClub.get(m.team2);
    if (!h || !a || !m.score?.ft) continue;
    const [hg, ag] = m.score.ft;
    const hs = stats.get(h) || { points: 0, goalDifference: 0, played: 0 };
    const as = stats.get(a) || { points: 0, goalDifference: 0, played: 0 };
    hs.played += 1;
    as.played += 1;
    hs.goalDifference += hg - ag;
    as.goalDifference += ag - hg;
    if (hg > ag) hs.points += 3;
    else if (hg < ag) as.points += 3;
    else {
      hs.points += 1;
      as.points += 1;
    }
    stats.set(h, hs);
    stats.set(a, as);
  }
}

const entries = [];
for (const lg of pack.leagues) {
  const clubs = pack.clubs.filter((c) => c.leagueId === lg.id && stats.has(c.id));
  clubs.sort(
    (a, b) =>
      stats.get(b.id).points - stats.get(a.id).points ||
      stats.get(b.id).goalDifference - stats.get(a.id).goalDifference,
  );
  const n = clubs.length;
  clubs.forEach((c, i) => {
    const s = stats.get(c.id);
    entries.push({
      clubId: c.id,
      modifier: n <= 1 ? 0 : Math.round(8 * (0.5 - i / (n - 1))),
      points: s.points,
      goalDifference: s.goalDifference,
      rank: i + 1,
      teams: n,
    });
  });
}

const out = {
  packVersion: `v${pack.version}@${pack.snapshotDate}`,
  season: '2024-25',
  entries,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`club-strength: ${entries.length} clubs of ${pack.clubs.length} have 2024-25 results`);
if (unmatched.length > 0) console.log(`unmatched cross-check teams: ${unmatched.join(', ')}`);
console.log(`wrote ${outPath}`);
