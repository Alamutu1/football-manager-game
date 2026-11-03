import { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGameStore } from '@/game/store';
import { roundFixtures, totalRounds } from '@/game/season';
import { COLORS, SPACING, TYPE } from '@/theme';

/**
 * D5 fixtures screen: every game-generated season fixture, grouped
 * by round, with played results shown and unplayed fixtures shown
 * as upcoming. These are NOT real 2024-25 fixtures or results.
 */
export default function FixturesScreen() {
  const { ready, loading, league, game, ensureGame } = useGameStore();

  useEffect(() => {
    ensureGame();
  }, [ensureGame]);

  if (loading || !ready || !league || !game) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.muted, marginTop: 12 }}>Loading fixtures…</Text>
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

  const clubName = (id: string): string => league.clubs.find((c) => c.id === id)?.name ?? id;
  const total = totalRounds(data.fixtures);
  const rounds: number[] = [];
  for (let r = 1; r <= total; r += 1) rounds.push(r);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Fixtures · Season {game.season}</Text>
        <Text style={[styles.note, { marginBottom: 8 }]}>
          Game-generated season fixtures, not the real 2024-25 schedule or results.
          {data.status === 'complete' ? ' This season is complete.' : ` Current round: ${data.currentRound} of ${total}.`}
        </Text>
        {rounds.map((round) => (
          <View key={round} style={styles.roundCard}>
            <Text style={styles.roundTitle}>
              Round {round}
              {round === data.currentRound && data.status === 'inProgress' ? ' · next' : ''}
            </Text>
            {roundFixtures(data.fixtures, round).map((fixture, i) => {
              const isUser = fixture.homeClubId === game.userClubId || fixture.awayClubId === game.userClubId;
              return (
                <View key={i} style={[styles.row, isUser && styles.userRow]}>
                  <Text style={[styles.cell, styles.home]} numberOfLines={1}>{clubName(fixture.homeClubId)}</Text>
                  <Text style={styles.score}>
                    {fixture.result ? `${fixture.result.homeGoals} – ${fixture.result.awayGoals}` : 'vs'}
                  </Text>
                  <Text style={[styles.cell, styles.away]} numberOfLines={1}>{clubName(fixture.awayClubId)}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: SPACING.screen, gap: 12 },
  title: { ...TYPE.title, color: COLORS.text },
  note: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  roundCard: { backgroundColor: COLORS.card, borderRadius: SPACING.cardRadius, padding: 14, gap: 8 },
  roundTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userRow: { backgroundColor: COLORS.surface, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6 },
  cell: { flex: 1, color: COLORS.text, fontSize: 13 },
  home: { textAlign: 'right' },
  away: { textAlign: 'left' },
  score: { color: COLORS.gold, fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'center' },
});
