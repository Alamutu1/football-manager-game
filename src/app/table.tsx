import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGameStore } from '@/game/store';
import { tableForCached } from '@/game/season';
import { SEASON_MEMBERSHIP_VERSION, membershipFor } from '@/game/season-membership';
import { COLORS, SPACING, TYPE } from '@/theme';

/** D5 league table screen: computed from played fixtures only. */
export default function TableScreen() {
  const { ready, loading, league, game, ensureGame } = useGameStore();

  useEffect(() => {
    ensureGame();
  }, [ensureGame]);

  if (loading || !ready || !league || !game) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.muted, marginTop: 12 }}>Loading table…</Text>
      </SafeAreaView>
    );
  }

  const data = game.seasonData;
  if (!data) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <Text style={[styles.note, { paddingHorizontal: 24 }]}>
          Season play is not available for this club’s league in D5.
        </Text>
      </SafeAreaView>
    );
  }

  const memberIds = membershipFor(data.leagueId);
  const clubsById = new Map(league.clubs.filter((c) => !memberIds || memberIds.includes(c.id)).map((c) => [c.id, c.name]));
  const table = tableForCached(data.fixtures, clubsById, game.season, data.leagueId, SEASON_MEMBERSHIP_VERSION);
  const clubName = (id: string): string => clubsById.get(id) ?? id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Table · Season {game.season}</Text>
        <Text style={[styles.note, { marginBottom: 8 }]}>
          {data.status === 'complete' && data.championClubId
            ? `Champions: ${clubName(data.championClubId)}`
            : 'Points: 3 for a win, 1 for a draw. Ties: goal difference, then goals for, then club name.'}
        </Text>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.pos, styles.header]}>#</Text>
          <Text style={[styles.name, styles.header]}>Club</Text>
          <Text style={[styles.num, styles.header]}>P</Text>
          <Text style={[styles.num, styles.header]}>W</Text>
          <Text style={[styles.num, styles.header]}>D</Text>
          <Text style={[styles.num, styles.header]}>L</Text>
          <Text style={[styles.num, styles.header]}>GD</Text>
          <Text style={[styles.num, styles.header]}>Pts</Text>
        </View>
        {table.map((row) => (
          <View key={row.clubId} style={[styles.row, row.clubId === game.userClubId && styles.userRow]}>
            <Text style={styles.pos}>{row.position}</Text>
            <Text style={styles.name} numberOfLines={1}>{clubName(row.clubId)}</Text>
            <Text style={styles.num}>{row.played}</Text>
            <Text style={styles.num}>{row.won}</Text>
            <Text style={styles.num}>{row.drawn}</Text>
            <Text style={styles.num}>{row.lost}</Text>
            <Text style={styles.num}>{row.goalDifference}</Text>
            <Text style={[styles.num, styles.points]}>{row.points}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: SPACING.screen, gap: 4 },
  title: { ...TYPE.title, color: COLORS.text, marginBottom: 4 },
  note: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  headerRow: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  userRow: { backgroundColor: COLORS.surface, borderRadius: 8, paddingHorizontal: 6 },
  pos: { width: 24, color: COLORS.muted, fontSize: 13, textAlign: 'right' },
  name: { flex: 1, color: COLORS.text, fontSize: 13 },
  num: { width: 24, color: COLORS.text, fontSize: 13, textAlign: 'center' },
  points: { fontWeight: '800', color: COLORS.gold },
  header: { color: COLORS.muted, fontWeight: '700' },
});
