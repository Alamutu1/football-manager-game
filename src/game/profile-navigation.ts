/**
 * Pure helpers for the Formation -> Squad list Profile flow.
 *
 * Stage 1 profile fix only: these helpers find a player in the
 * currently displayed, sorted squad list so Squad can scroll the
 * FlatList to that player's expanded row. They do not change the XI,
 * formation, bench, roles, or any selection logic.
 */

export interface ProfileListEntry {
  id: string;
}

/** Index of a player in a list, or -1 when the player is not listed. */
export function indexOfPlayer<T extends ProfileListEntry>(
  players: readonly T[],
  playerId: string | null,
): number {
  if (playerId === null) return -1;
  return players.findIndex((p) => p.id === playerId);
}

/** Whether a row should show its expanded profile details. */
export function isProfileExpanded(
  expandedId: string | null,
  playerId: string,
): boolean {
  return expandedId !== null && expandedId === playerId;
}
