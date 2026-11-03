/**
 * Leagues tab: browse the real-world data pack offline.
 *
 * One screen, three views driven by local state (no extra routes):
 * leagues -> clubs of a league -> players of a club. From a club's
 * player list the user can select that club as their career club.
 * Nothing here fetches: everything comes from the bundled pack in
 * the store, so browsing works with no connection.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useGameStore } from '@/game/store';
import {
  ageAt,
  clubsOfLeague,
  leaguesOf,
  playersOfClub,
  ratingForPackPlayer,
} from '@/game/data-pack-loader';
import { clubSummary, playerStatus, statusLabel } from '@/game/data-quality';
import { formatValueEstimate, keyAttributesFor, positionGroup } from '@/game/ratings';
import { splitDisplayName } from '@/game/player-display';
import { AttributeGrid } from '@/components/attribute-grid';
import { InfoLink } from '@/components/info-sheet';
import { PlayerAvatar } from '@/components/player-avatar';
import { COLORS } from '@/theme';
import type { DataPackClub, DataPackLeague } from '@/game/data-pack';

type BrowseView =
  | { kind: 'leagues' }
  | { kind: 'clubs'; league: DataPackLeague }
  | { kind: 'players'; league: DataPackLeague; club: DataPackClub };

export default function LeaguesScreen() {
  const router = useRouter();
  const { ready, loading, pack, packError, quality, clubStrength, error, ensureGame, startRealCareer } =
    useGameStore();
  const [view, setView] = useState<BrowseView>({ kind: 'leagues' });
  const [notice, setNotice] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    ensureGame();
  }, [ensureGame]);

  const text = COLORS.text;
  const muted = COLORS.muted;
  const bg = COLORS.background;
  const card = COLORS.card;

  if (loading || !ready) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" />
        <Text style={{ color: muted, marginTop: 12 }}>Loading leagues…</Text>
      </SafeAreaView>
    );
  }

  if (!pack) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <Text style={[styles.error, { paddingHorizontal: 24 }]}>
          The real-world data pack could not be loaded.
        </Text>
        <Text style={[{ color: muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }]}>
          {packError ?? 'Unknown pack error.'} Browsing needs the pack; your fictional career still works
          from the Club tab.
        </Text>
      </SafeAreaView>
    );
  }

  const onSelectClub = async (club: DataPackClub) => {
    setNotice(null);
    const ok = await startRealCareer(club.id);
    if (ok) {
      setNotice(`${club.name} is now your club. Opening your career…`);
      router.push('/');
    }
  };

  if (view.kind === 'leagues') {
    const leagues = leaguesOf(pack);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: text }]}>Real leagues</Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {leagues.length} leagues · {pack.clubs.length} clubs · {pack.players.length} players
          </Text>
        </View>
        <FlatList
          data={leagues}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const clubs = clubsOfLeague(pack, item.id);
            const clubIds = new Set(clubs.map((c) => c.id));
            const playerCount = pack.players.filter((p) => clubIds.has(p.clubId)).length;
            return (
              <Pressable
                style={[styles.row, { backgroundColor: card }]}
                onPress={() => setView({ kind: 'clubs', league: item })}>
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, { color: text }]}>{item.name}</Text>
                  <Text style={{ color: muted, fontSize: 13 }}>{item.country}</Text>
                </View>
                <Text style={{ color: muted, fontSize: 13 }}>
                  {clubs.length} clubs · {playerCount} players
                </Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.footerInfo}>
          <Text style={[styles.foot, { color: muted }]}>
            Data: Wikidata + openfootball · Snapshot {pack.snapshotDate} · CC0 · Works offline
          </Text>
          <InfoLink />
        </View>
      </SafeAreaView>
    );
  }

  if (view.kind === 'clubs') {
    const clubs = clubsOfLeague(pack, view.league.id);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View style={styles.header}>
          <Pressable onPress={() => setView({ kind: 'leagues' })}>
            <Text style={[styles.back, { color: text }]}>← Leagues</Text>
          </Pressable>
          <Text style={[styles.title, { color: text }]}>{view.league.name}</Text>
          <Text style={[styles.subtitle, { color: muted }]}>{clubs.length} clubs</Text>
        </View>
        <FlatList
          data={clubs}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const count = playersOfClub(pack, item.id).length;
            return (
              <Pressable
                style={[styles.row, { backgroundColor: card }]}
                onPress={() => setView({ kind: 'players', league: view.league, club: item })}>
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, { color: text }]}>{item.name}</Text>
                  <Text style={{ color: muted, fontSize: 13 }}>
                    {count === 0 ? 'No players recorded' : `${count} players`}
                  </Text>
                </View>
                <Text style={{ color: muted, fontSize: 16 }}>›</Text>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    );
  }

  const allPlayers = playersOfClub(pack, view.club.id);
  const players =
    verifiedOnly && quality
      ? allPlayers.filter((p) => playerStatus(quality, p.id, view.club.id)?.status === 'verified_current')
      : allPlayers;
  const summary = clubSummary(quality, view.club.id, allPlayers.map((p) => p.id));
  const qualityLine = quality
    ? `${summary.verified} current · ${summary.historical} left · ${summary.conflicting} conflicting · ${summary.uncertain} uncertain`
    : 'Quality check unavailable for this club.';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => setView({ kind: 'clubs', league: view.league })}>
          <Text style={[styles.back, { color: text }]}>← {view.league.name}</Text>
        </Pressable>
        <Text style={[styles.title, { color: text }]}>{view.club.name}</Text>
        <Text style={[styles.subtitle, { color: muted }]}>
          {allPlayers.length === 0
            ? 'No players recorded for this club in the data pack.'
            : `${players.length} players`}
        </Text>
        <Text style={[styles.qualityLine, { color: muted }]}>{qualityLine}</Text>
        {quality ? (
          <View style={styles.toggles}>
            <Pressable
              style={[styles.toggle, verifiedOnly && styles.toggleActive]}
              onPress={() => setVerifiedOnly((v) => !v)}>
              <Text style={[styles.toggleText, verifiedOnly && styles.toggleTextActive]}>
                Verified only
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const age = ageAt(pack.snapshotDate, item.dateOfBirth);
          const entry = playerStatus(quality, item.id, view.club.id);
          const rating = ratingForPackPlayer(pack, clubStrength, item, 0);
          const expanded = expandedId === item.id;
          const provisional = entry && entry.status !== 'verified_current';
          const parts = splitDisplayName(item.name);
          return (
            <Pressable
              style={[styles.rowWrap, { backgroundColor: card }]}
              onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.row}>
                <PlayerAvatar
                  firstName={parts.first}
                  lastName={parts.last}
                  position={positionGroup(rating.role)}
                  size={40}
                />
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, { color: text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: muted, fontSize: 13 }} numberOfLines={1}>
                    {rating.role}
                    {age !== null ? ` · Age ${age}` : ''}
                    {item.nationality ? ` · ${item.nationality}` : ''}
                  </Text>
                  {provisional ? (
                    <View style={styles.provisionalPill}>
                      <Text style={styles.provisionalText}>Provisional</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.ratings}>
                  <Text style={[styles.ovr, { color: text }]}>
                    {rating.overall}
                    <Text style={{ fontSize: 12, color: muted }}> est.</Text>
                  </Text>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    POT {rating.potential} · {rating.tier}
                  </Text>
                </View>
              </View>
              {expanded ? (
                <View>
                  <AttributeGrid
                    attributes={rating.attributes}
                    text={text}
                    muted={muted}
                    highlightKeys={keyAttributesFor(rating.role)}
                  />
                  <Text style={{ color: muted, fontSize: 13, marginTop: 10 }}>
                    Potential {rating.potential} · Development {rating.developmentBand}
                    {` · Est. value ${formatValueEstimate(rating.valueEstimate)}`}
                    {` · ${entry ? statusLabel(entry.status) : 'Unverified'}`}
                  </Text>
                  <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
                    <InfoLink />
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
      <View style={styles.footerInfo}>
        <Text style={[styles.foot, { color: muted }]}>
          Ratings marked est. are PCM model estimates.
        </Text>
        <InfoLink />
      </View>
      {players.length > 0 ? (
        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={() => onSelectClub(view.club)}>
            <Text style={styles.buttonText}>Select as my club</Text>
          </Pressable>
          <Text style={[styles.foot, { color: muted }]}>
            Starts a new career with this club. Your current save is replaced.
          </Text>
        </View>
      ) : null}
      {notice ? <Text style={[styles.notice, { color: text }]}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 2 },
  back: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 2 },
  qualityLine: { fontSize: 12, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowWrap: { borderRadius: 10, padding: 12 },
  provisionalPill: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8,
  },
  provisionalText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  ratings: { alignItems: 'flex-end', flexShrink: 0 },
  ovr: { fontSize: 20, fontWeight: '800' },
  toggles: { flexDirection: 'row', gap: 8, marginTop: 10 },
  toggle: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 13, color: COLORS.text },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '700' },
  nameBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600' },
  footerInfo: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  footer: { paddingHorizontal: 20, paddingBottom: 20, gap: 8 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.primary },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  foot: { fontSize: 12, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  notice: { textAlign: 'center', paddingHorizontal: 20, paddingBottom: 16, fontWeight: '600' },
  error: { color: COLORS.danger, textAlign: 'center' },
});
