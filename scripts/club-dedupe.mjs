/**
 * D3 builder helper: drop duplicate club entities.
 *
 * Wikidata sometimes holds two items for one club (found in the v1
 * pack: Toulouse FC as wd:Q19518 and wd:Q2422417, FC Augsburg as
 * wd:Q15755 and wd:Q97905916, Hamburger SV as wd:Q51974 and
 * wd:Q97905930). Players' P54 statements point at only one of
 * them, so the other shows up with zero players and the game lists
 * the same club twice.
 *
 * Within one league, group clubs by normalised name and keep the
 * entry with the most players (ties: lowest id, for determinism).
 * Pure function, unit-tested in scripts/test-d3-quality.mjs.
 * Takes effect on the next snapshot rebuild, not on the frozen v1.
 */

function keyOf(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function dedupeClubs(clubs, playersByClubId) {
  const groups = new Map();
  for (const club of clubs) {
    const key = keyOf(club.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(club);
  }
  const kept = [];
  const dropped = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      kept.push(group[0]);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) =>
        (playersByClubId.get(b.id) ?? 0) - (playersByClubId.get(a.id) ?? 0) ||
        (a.id < b.id ? -1 : 1),
    );
    // Only drop the rest when they hold no players: dropping a club
    // that owns players would orphan them (dangling player->club).
    // A split across two items needs human judgment, so keep both.
    const rest = sorted.slice(1);
    if (rest.every((c) => (playersByClubId.get(c.id) ?? 0) === 0)) {
      kept.push(sorted[0]);
      dropped.push(...rest);
    } else {
      kept.push(...group);
    }
  }
  return { kept, dropped };
}
