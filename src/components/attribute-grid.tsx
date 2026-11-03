import { StyleSheet, Text, View } from 'react-native';

import type { Attributes } from '@/game/types';
import { COLORS } from '@/theme';

/** The 8 D4 attributes in display order, with short labels. */
const LABELS: { key: keyof Attributes; label: string }[] = [
  { key: 'pace', label: 'Pace' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'passing', label: 'Passing' },
  { key: 'dribbling', label: 'Dribbling' },
  { key: 'defending', label: 'Defending' },
  { key: 'physical', label: 'Physical' },
  { key: 'goalkeeping', label: 'Goalkeeping' },
  { key: 'tactical', label: 'Tactical' },
];

/**
 * Attribute bars (UI Phase 1). One row per attribute: label, bar, and
 * value. Keys passed in highlightKeys (the role's key attributes)
 * get a green bar and bold label; the rest stay muted. Used by every
 * expanded player row.
 */
export function AttributeGrid({
  attributes,
  text,
  muted,
  highlightKeys = [],
}: {
  attributes: Attributes;
  text: string;
  muted: string;
  highlightKeys?: (keyof Attributes)[];
}) {
  return (
    <View style={styles.list}>
      {LABELS.map(({ key, label }) => {
        const value = attributes[key];
        const highlighted = highlightKeys.includes(key);
        return (
          <View key={key} style={styles.row}>
            <Text
              style={[
                styles.label,
                { color: highlighted ? text : muted, fontWeight: highlighted ? '700' : '400' },
              ]}>
              {label}
            </Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(2, Math.min(100, value))}%`,
                    backgroundColor: highlighted ? COLORS.primary : COLORS.border,
                  },
                ]}
              />
            </View>
            <Text style={[styles.value, { color: text }]}>{value}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 10, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 88, fontSize: 13, flexShrink: 0 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: COLORS.card, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  value: { width: 26, textAlign: 'right', fontWeight: '700', fontSize: 14 },
});
