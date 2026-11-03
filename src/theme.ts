/**
 * Pocket Club Manager visual identity: "Night Match".
 *
 * A dark, football-inspired theme that is ours, not a copy of
 * Football Manager or Top Eleven: deep green-tinted charcoal
 * surfaces, one pitch green, one gold accent for ratings and
 * highlights, and white text. No club logos, badges, kits, or
 * photographs are used anywhere; club marks are initials on a
 * deterministic colour, as before.
 *
 * The game is dark-first by design: screens use these tokens
 * directly instead of following the OS light/dark setting, so the
 * identity is identical on every device. See docs/UI-UX-STANDARD.md
 * for the full standard (layout, type, motion, screenshots).
 */

export const COLORS = {
  /** App background. */
  background: '#0A0E0C',
  /** Raised surface (headers, sheets). */
  surface: '#131A16',
  /** Cards and rows. */
  card: '#1B241F',
  /** Card borders and dividers. */
  border: '#2A352E',
  /** Primary text. */
  text: '#F2F5F1',
  /** Secondary text. */
  muted: '#93A29A',
  /** Primary action green (buttons, active tabs, selection). */
  primary: '#2FA84F',
  /** Darker green for pressed/secondary emphasis. */
  primaryDark: '#1E7D32',
  /** Gold accent: ratings, highlights, Established tier. */
  gold: '#F5B81D',
  /** Elite accent: Exceptional tier. */
  elite: '#FF7A1A',
  /** Pitch green for the formation board. */
  pitch: '#14532D',
  /** Lighter mowing stripe for the formation board. */
  pitchStripe: '#166534',
  /** Pitch line colour (low-opacity white). */
  pitchLine: 'rgba(255, 255, 255, 0.25)',
  /** Danger / error text. */
  danger: '#E5484D',
};

export const SPACING = {
  screen: 20,
  list: 16,
  gap: 12,
  cardRadius: 14,
  rowRadius: 12,
};

export const TYPE = {
  display: { fontSize: 28, fontWeight: '800' as const },
  title: { fontSize: 22, fontWeight: '800' as const },
  name: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14 },
  small: { fontSize: 13 },
  caption: { fontSize: 12 },
};

export type TierName = 'Developing' | 'Professional' | 'Established' | 'Exceptional';

/** Overall-badge colours per tier (background + text). */
export const TIER_BADGE: Record<TierName, { bg: string; fg: string }> = {
  Developing: { bg: '#3A453E', fg: '#F2F5F1' },
  Professional: { bg: '#2FA84F', fg: '#FFFFFF' },
  Established: { bg: '#F5B81D', fg: '#0A0E0C' },
  Exceptional: { bg: '#FF7A1A', fg: '#0A0E0C' },
};
