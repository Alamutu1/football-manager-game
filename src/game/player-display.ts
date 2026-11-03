/**
 * Player display helpers (UI Phase 1). Pure string/colour logic, no
 * data, no photographs: the game has no player photos and must not
 * invent or scrape any, so avatars are initials on a position-coloured
 * ring. Deterministic: the same player always gets the same avatar.
 */

import type { Position } from './types';

/** Ring colour per position line. Distinct at a glance. */
export const POSITION_COLORS: Record<Position, string> = {
  GK: '#F5B81D',
  DF: '#2FA84F',
  MF: '#4DA3FF',
  FW: '#FF7A1A',
};

export function positionColorFor(position: Position): string {
  return POSITION_COLORS[position] ?? '#93A29A';
}

/**
 * Two initials for an avatar. First letter of the first name plus
 * first letter of the last name; a single name gives its first two
 * letters; empty input gives "?". "Spencer-Adams" counts as "S".
 */
export function initialsFor(firstName: string, lastName: string): string {
  const first = (firstName ?? '').trim();
  const last = (lastName ?? '').trim();
  if (first && last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }
  const only = first || last;
  if (only.length >= 2) {
    return only.slice(0, 2).toUpperCase();
  }
  if (only.length === 1) {
    return only.toUpperCase();
  }
  return '?';
}

/** Split a full display name ("Bukayo Saka") into first/last words. */
export function splitDisplayName(fullName: string): { first: string; last: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: '', last: '' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: '' };
  }
  return { first: parts[0], last: parts[parts.length - 1] };
}
