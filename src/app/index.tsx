import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useGameStore } from '@/game/store';
import { bestXI, playersOfClub, teamRating } from '@/game/seed';
import { leagueOfClub as packLeagueOfClub, playersOfClub as packPlayersOfClub } from '@/game/data-pack-loader';
import { clubSummary } from '@/game/data-quality';
import { SEASON_MEMBERSHIP_VERSION, membershipFor, seasonLeagueOfClub } from '@/game/season-membership';
import { tableForCached, totalRounds, validateSeasonData } from '@/game/season';
import { InfoLink } from '@/components/info-sheet';
import { COLORS, SPACING, TYPE } from '@/theme';

/**
 * Club dashboard (UI Phase 1): a club homepage, not a stats page.
 * Stadium-style header with the club identity, squad-at-a-glance
 * cards, the real last result (or an honest empty state), and
 * management actions. No fixtures, news, or financial figures are
 * shown: that data does not exist yet, and nothing is invented.
 */
export default function ClubScreen() {
  const router = useRouter();
  const {
    ready, loading, saving, error, league, game, pack, quality, ensureGame, startNewCareer,
    playTestMatch, continueSeason, startNextSeason, backups, pendingRestore, prepareRestore,
    confirmRestore, cancelRestore, corruptedSave,
  } = useGameStore();

  useEffect(() => {
    ensureGame();
  }, [ensureGame]);

  // Corrupted current save: never auto-restore, never offer a fresh
  // career here (that would silently replace it). Only an explicit,
  // confirmed restore from a backup or snapshot may replace it.
  if (ready && corruptedSave) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ScrollView contentContainerStyle={[styles.container, { alignItems: 'stretch' }]}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Saved career cannot be read</Text>
          <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>
            Your saved career cannot be read, so its season, round and progress cannot be determined.
            The exact progress difference cannot be determined. Nothing has been overwritten, and the
            raw save has been preserved in a snapshot before any restore.
          </Text>
          <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>
            Saved file: {corruptedSave.saveId} · {corruptedSave.rawLength} characters
          </Text>
          {pendingRestore ? (
            <View style={styles.matchCard}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Confirm restore</Text>
              <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>
                {pendingRestore.currentDeterminate
                  ? `Restoring will return this career to Season ${pendingRestore.backupSeason ?? '?'}, Round ${pendingRestore.backupRound ?? '?'}, and you will lose the progress since that backup (current: Season ${pendingRestore.currentSeason ?? '?'}, Round ${pendingRestore.currentRound ?? '?'}).`
                  : 'The exact progress difference cannot be determined because the current save cannot be read. Restoring will replace it with the selected backup. The current raw save has been preserved as a snapshot, so it is not lost by restoring, but its contents cannot be recovered automatically.'}
              </Text>
              <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>
                Snapshot: {pendingRestore.snapshotId}
              </Text>
              <Pressable style={[styles.button, { backgroundColor: COLORS.primary }]} onPress={confirmRestore}>
                <Text style={styles.buttonText}>Confirm restore</Text>
              </Pressable>
              <Pressable onPress={cancelRestore} hitSlop={8}>
                <Text style={[styles.quiet, { color: COLORS.muted }]}>Cancel restore</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.matchCard}>
              <Text style={[styles.sectionTitle, { color: COLORS.text }]}>Backups and snapshots</Text>
              {backups.length === 0 ? (
                <Text style={[styles.hint, { color: COLORS.muted }]}>No backup or snapshot is available.</Text>
              ) : (
                backups.map((entry) => (
                  <View key={entry.id} style={{ gap: 4, marginBottom: 8 }}>
                    <Text style={{ color: COLORS.text, fontSize: 13 }}>
                      {entry.kind === 'backup' ? 'Backup' : 'Snapshot'} · {new Date(entry.createdAt).toLocaleString()}
                      {entry.season !== null ? ` · Season ${entry.season}` : ' · season unknown'}
                      {entry.round !== null ? `, Round ${entry.round}` : ''}
                    </Text>
                    <Pressable
                      style={[styles.buttonSecondary, { borderColor: COLORS.muted }]}
                      onPress={() => prepareRestore(entry.id)}>
                      <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Restore this</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Safe-failure state: the pack failed to load but a real-club save
  // exists. The save was NOT deleted; offer a fictional career instead.
  if (ready && !loading && error && !game) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <Text style={[styles.error, { paddingHorizontal: 24 }]}>{error}</Text>
        <Pressable
          style={[styles.buttonSecondary, { borderColor: COLORS.muted, marginTop: 20, paddingHorizontal: 20 }]}
          onPress={startNewCareer}>
          <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Start fictional career</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (loading || !ready || !league || !game) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: COLORS.muted, marginTop: 12 }}>Loading your club…</Text>
        {error ? <Text style={[styles.error, { marginTop: 12 }]}>{error}</Text> : null}
      </SafeAreaView>
    );
  }

  const club = league.clubs.find((c) => c.id === game.userClubId) ?? league.clubs[0];
  const squad = playersOfClub(league, club.id);
  const rating = teamRating(bestXI(league, club.id));
  const isReal = game.datasetSource === 'real';
  const packLeague = isReal && pack ? packLeagueOfClub(pack, club.id) : undefined;
  const qualitySummary = isReal && pack
    ? clubSummary(quality, club.id, packPlayersOfClub(pack, club.id).map((p) => p.id))
    : null;
  // Season careers show the last recent result; non-season careers
  // show the last legacy test result, exactly as before.
  const recentLast = game.seasonData && game.recentResults && game.recentResults.length > 0
    ? game.recentResults[game.recentResults.length - 1]
    : null;
  const last = recentLast ? recentLast.result : game.results[game.results.length - 1];
  const lastOpponent = last
    ? league.clubs.find((c) => c.id === (last.homeClubId === club.id ? last.awayClubId : last.homeClubId))
    : undefined;
  const lastHome = last ? last.homeClubId === club.id : false;
  const seasonData = game.seasonData ?? null;
  const seasonIssues = seasonData ? validateSeasonData(seasonData, SEASON_MEMBERSHIP_VERSION) : [];
  const seasonMemberIds = seasonData ? membershipFor(seasonData.leagueId) : null;
  const seasonClubsById = new Map(league.clubs.filter((c) => !seasonMemberIds || seasonMemberIds.includes(c.id)).map((c) => [c.id, c.name]));
  const seasonTable = seasonData
    ? tableForCached(seasonData.fixtures, seasonClubsById, game.season, seasonData.leagueId, SEASON_MEMBERSHIP_VERSION)
    : [];
  const seasonUserRow = seasonTable.find((r) => r.clubId === club.id);
  const seasonTotalRounds = seasonData ? totalRounds(seasonData.fixtures) : 0;
  const seasonComplete = seasonData?.status === 'complete';
  const seasonChampion = seasonComplete && seasonData?.championClubId
    ? league.clubs.find((c) => c.id === seasonData.championClubId)
    : undefined;
  const isSeasonMember = isReal && seasonLeagueOfClub(club.id) !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.stadium}>
          <View style={styles.stadiumLine} />
          <View style={styles.stadiumCircle} />
          <View style={[styles.badge, { backgroundColor: club.primaryColor }]}>
            <Text style={styles.badgeText}>{club.shortName}</Text>
          </View>
          <Text style={styles.title}>{club.name}</Text>
          <View style={styles.chips}>
            <Text style={styles.chip}>Season {game.season}</Text>
            <Text style={styles.chip}>{isReal ? (packLeague?.name ?? 'Real league') : 'Manager career'}</Text>
            {isReal && game.datasetVersion ? <Text style={styles.chip}>Data {game.datasetVersion}</Text> : null}
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{isReal ? `${rating} est.` : `${rating}`}</Text>
            <Text style={styles.statLabel}>Best XI</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{squad.length}</Text>
            <Text style={styles.statLabel}>Squad</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {qualitySummary ? `${qualitySummary.verified}/${qualitySummary.total}` : '—'}
            </Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {last && lastOpponent ? (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Last result</Text>
            <Text style={styles.score}>
              {lastHome ? club.shortName : lastOpponent.shortName} {last.homeGoals} –{' '}
              {last.awayGoals} {lastHome ? lastOpponent.shortName : club.shortName}
            </Text>
            <Text style={styles.matchNote}>
              {recentLast
                ? `Season ${recentLast.season} · Round ${recentLast.round} · simulated league match`
                : `Test match · ${game.results.length} played`}
            </Text>
          </View>
        ) : (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Last result</Text>
            <Text style={styles.matchNote}>
              {seasonData ? 'No league match played yet this season.' : 'No match played yet. Play a test match to get started.'}
            </Text>
          </View>
        )}

        {seasonData ? (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Season progress</Text>
            <Text style={[styles.hint, { color: COLORS.muted }]}>
              2024-25 top-flight membership · Game-generated season fixtures, not the real 2024-25 schedule or results.
            </Text>
            {seasonComplete ? (
              <Text style={[styles.score, { fontSize: 18 }]}>
                Season complete{seasonChampion ? ` · Champions: ${seasonChampion.name}` : ''}
              </Text>
            ) : (
              <Text style={[styles.score, { fontSize: 18 }]}>
                Round {seasonData.currentRound} of {seasonTotalRounds}
              </Text>
            )}
            {seasonUserRow ? (
              <Text style={styles.matchNote}>
                Your position: {seasonUserRow.position} · {seasonUserRow.points} pts · {seasonUserRow.played} played
              </Text>
            ) : null}
            {seasonIssues.length > 0 ? (
              <Text style={styles.error}>Season state is invalid, so Continue is blocked: {seasonIssues.join(' ')}</Text>
            ) : null}
            {!seasonComplete ? (
              <Pressable
                style={[styles.button, { backgroundColor: COLORS.primary, opacity: saving ? 0.5 : 1 }]}
                onPress={continueSeason}
                disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Continue · play this round'}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.button, { backgroundColor: COLORS.primary, opacity: saving ? 0.5 : 1 }]}
                onPress={startNextSeason}
                disabled={saving}>
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Start next season'}</Text>
              </Pressable>
            )}
            <Text style={[styles.hint, { color: COLORS.muted }]}>
              Continue simulates every match in this round, including your club, using the v0 match engine.
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.buttonSecondary, styles.actionButton, { borderColor: COLORS.muted }]}
                onPress={() => router.push('/fixtures')}>
                <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Fixtures</Text>
              </Pressable>
              <Pressable
                style={[styles.buttonSecondary, styles.actionButton, { borderColor: COLORS.muted }]}
                onPress={() => router.push('/table')}>
                <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Table</Text>
              </Pressable>
            </View>
          </View>
        ) : isReal && !isSeasonMember ? (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Season play</Text>
            <Text style={[styles.hint, { color: COLORS.muted }]}>
              Season play is not available for this club’s league in D5.
            </Text>
          </View>
        ) : null}

        {!seasonData ? (
          <>
            <Pressable style={[styles.button, { backgroundColor: COLORS.primary }]} onPress={playTestMatch}>
              <Text style={styles.buttonText}>Play test match</Text>
            </Pressable>
            <Text style={[styles.hint, { color: COLORS.muted }]}>
              Your club against the next club in the league, using the v0 match engine.
            </Text>
          </>
        ) : null}

        {pendingRestore ? (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Confirm restore</Text>
            <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>
              {pendingRestore.currentDeterminate
                ? `Restoring will return this career to Season ${pendingRestore.backupSeason ?? '?'}, Round ${pendingRestore.backupRound ?? '?'}, and you will lose the progress since that backup (current: Season ${pendingRestore.currentSeason ?? '?'}, Round ${pendingRestore.currentRound ?? '?'}).`
                : 'The exact progress difference cannot be determined because the current save cannot be read. Restoring will replace it with the selected backup. The current raw save has been preserved as a snapshot.'}
            </Text>
            <Text style={[styles.hint, { color: COLORS.muted, textAlign: 'left' }]}>Snapshot: {pendingRestore.snapshotId}</Text>
            <Pressable style={[styles.button, { backgroundColor: COLORS.primary }]} onPress={confirmRestore}>
              <Text style={styles.buttonText}>Confirm restore</Text>
            </Pressable>
            <Pressable onPress={cancelRestore} hitSlop={8}>
              <Text style={[styles.quiet, { color: COLORS.muted }]}>Cancel restore</Text>
            </Pressable>
          </View>
        ) : backups.length > 0 ? (
          <View style={styles.matchCard}>
            <Text style={styles.sectionTitle}>Save backups</Text>
            {backups.slice(0, 3).map((entry) => (
              <View key={entry.id} style={{ gap: 4, marginBottom: 8 }}>
                <Text style={{ color: COLORS.text, fontSize: 13 }}>
                  {entry.kind === 'backup' ? 'Backup' : 'Snapshot'} · {new Date(entry.createdAt).toLocaleString()}
                  {entry.season !== null ? ` · Season ${entry.season}` : ' · season unknown'}
                  {entry.round !== null ? `, Round ${entry.round}` : ''}
                </Text>
                <Pressable
                  style={[styles.buttonSecondary, { borderColor: COLORS.muted }]}
                  onPress={() => prepareRestore(entry.id)}>
                  <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Restore this</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.buttonSecondary, styles.actionButton, { borderColor: COLORS.muted }]}
            onPress={() => router.push('/squad')}>
            <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>View squad</Text>
          </Pressable>
          <Pressable
            style={[styles.buttonSecondary, styles.actionButton, { borderColor: COLORS.muted }]}
            onPress={() => router.push('/leagues')}>
            <Text style={[styles.buttonSecondaryText, { color: COLORS.text }]}>Browse leagues</Text>
          </Pressable>
        </View>

        <Pressable onPress={startNewCareer} hitSlop={8}>
          <Text style={[styles.quiet, { color: COLORS.muted }]}>Start new career</Text>
        </Pressable>
        <Text style={[styles.hint, { color: COLORS.muted }]}>Replaces the current save with a fresh fictional league.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={[styles.foot, { color: COLORS.muted }]}>
          Ratings marked est. are PCM model estimates.
        </Text>
        <InfoLink />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: SPACING.screen, gap: 16, alignItems: 'stretch' },
  stadium: {
    backgroundColor: COLORS.pitch,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.pitchLine,
    overflow: 'hidden',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  stadiumLine: {
    position: 'absolute', left: 0, right: 0, top: '50%',
    height: 1, backgroundColor: COLORS.pitchLine,
  },
  stadiumCircle: {
    position: 'absolute', left: '50%', top: '50%', width: 110, height: 110,
    marginLeft: -55, marginTop: -55, borderRadius: 55,
    borderWidth: 1, borderColor: COLORS.pitchLine,
  },
  badge: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  title: { ...TYPE.display, color: '#FFFFFF', textAlign: 'center' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    color: '#F2F5F1', fontSize: 13, fontWeight: '600',
    backgroundColor: 'rgba(10, 14, 12, 0.55)', borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11,
    overflow: 'hidden',
  },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card, borderRadius: SPACING.cardRadius, paddingVertical: 14, paddingHorizontal: 10, gap: 2,
    alignItems: 'center',
  },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.muted, fontSize: 12 },
  matchCard: { backgroundColor: COLORS.card, borderRadius: SPACING.cardRadius, padding: 16, gap: 8, alignItems: 'center' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', alignSelf: 'flex-start' },
  score: { color: COLORS.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  matchNote: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: { flex: 1 },
  buttonSecondary: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  buttonSecondaryText: { fontWeight: '600', fontSize: 15 },
  quiet: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  foot: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  error: { color: COLORS.danger, textAlign: 'center' },
});
