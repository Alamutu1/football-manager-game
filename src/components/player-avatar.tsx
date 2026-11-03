import { StyleSheet, Text, View } from 'react-native';

import { initialsFor, positionColorFor } from '@/game/player-display';
import { COLORS } from '@/theme';
import type { Position } from '@/game/types';

/**
 * Player avatar (UI Phase 1). No photographs exist in the data and
 * none are invented: initials on a ring coloured by position line.
 * Deterministic and fully offline.
 */
export function PlayerAvatar({
  firstName,
  lastName,
  position,
  size = 44,
}: {
  firstName: string;
  lastName: string;
  position: Position;
  size?: number;
}) {
  const ring = positionColorFor(position);
  const fontSize = size >= 56 ? 20 : size >= 44 ? 15 : 12;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ring,
          borderWidth: size >= 56 ? 3 : 2,
        },
      ]}>
      <Text style={[styles.initials, { fontSize }]}>
        {initialsFor(firstName, lastName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initials: { color: COLORS.text, fontWeight: '800' },
});
