import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGameStore } from '@/game/store';
import { bestXI, playersOfClub } from '@/game/seed';
import { clubSummary, playerStatus, statusLabel } from '@/game/data-quality';
import {
  developmentBand,
  formatValueEstimate,
  keyAttributesFor,
  tierFor,
  valueEstimate,
} from '@/game/ratings';
import { AttributeGrid } from '@/components/attribute-grid';
import { FormationBoard } from '@/components/formation-board';
import { InfoLink } from '@/components/info-sheet';
import { PlayerAvatar } from '@/components/player-avatar';
import { COLORS, SPACING, TIER_BADGE, TYPE } from '@/theme';
import { indexOfPlayer, isProfileExpanded } from '@/game/profile-navigation';
import type { Player, Position } from '@/game/types';

const POSITION_ORDER: Position[] = ['GK', 'DF', 'MF', 'FW'];

type SortMode = 'overall' | 'position';
type SquadView = 'list' | 'formation';
type PosFilter = 'ALL' | Position;

export default function SquadScreen() {
  const { ready, loading, league, game, pack, quality, ensureGame } = useGameStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('overall');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [view, setView] = useState<SquadView>('list');
  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [formationSelectedId, setFormationSelectedId] = useState<string | null>(null);
  // Profile fix: when Profile is tapped from Formation, remember the
  // sorted-list index to scroll to after the view switches to the
  // list. The FlatList itself persists across the view switch; only
  // its header changes, so its ref stays valid. The index is computed
  // in the tap handler, where the sorted list is already available,
  // so no ref is read during render and no state is set in an effect.
  const listRef = useRef<FlatList<Player> | null>(null);
  const pendingScrollIndexRef = useRef<number | null>(null);

  useEffect(() => {
    ensureGame();
  }, [ensureGame]);

  useEffect(() => {
    if (view !== 'list') return;
    const index = pendingScrollIndexRef.current;
    if (index === null || index < 0) return;
    pendingScrollIndexRef.current = null;
    // Defer one tick so the list view has rendered before scrolling.
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, viewPosition: 0.1, animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [view]);

  const text = COLORS.text;
  const muted = COLORS.muted;
  const bg = COLORS.background;
  const card = COLORS.card;

  if (loading || !ready || !league || !game) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ color: muted, marginTop: 12 }}>Loading squad…</Text>
      </SafeAreaView>
    );
  }

  const club = league.clubs.find((c) => c.id === game.userClubId) ?? league.clubs[0];
  const isReal = game.datasetSource === 'real';

  // Real careers: adapted league players carry D4 ratings. The pack
  // lookup only adds nationality and the D3 association status.
  let squad = playersOfClub(league, club.id);
  if (isReal && verifiedOnly && quality) {
    squad = squad.filter((p) => playerStatus(quality, p.id, club.id)?.status === 'verified_current');
  }
  if (posFilter !== 'ALL') {
    squad = squad.filter((p) => p.position === posFilter);
  }
  const sorted = [...squad].sort((a, b) => {
    if (sortMode === 'overall') return b.overall - a.overall;
    const posDiff = POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position);
    return posDiff !== 0 ? posDiff : b.overall - a.overall;
  });
  const avg = Math.round(sorted.reduce((sum, p) => sum + p.overall, 0) / Math.max(1, sorted.length));
  const xi = bestXI(league, club.id);
  const xiRating = xi.length > 0
    ? Math.round(xi.reduce((sum, p) => sum + p.overall, 0) / xi.length)
    : 0;

  const qualityLine = isReal && pack
    ? (() => {
        const summary = clubSummary(
          quality,
          club.id,
          pack.players.filter((p) => p.clubId === club.id).map((p) => p.id),
        );
        return quality
          ? `${summary.verified} current · ${summary.historical} left · ${summary.conflicting} conflicting · ${summary.uncertain} uncertain`
          : 'Quality check unavailable.';
      })()
    : null;

  const clubName = isReal && pack
    ? (pack.clubs.find((c) => c.id === club.id)?.name ?? club.name)
    : club.name;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>{clubName}</Text>
        <Text style={[styles.subtitle, { color: muted }]}>
          {sorted.length} players · Average rating {avg}
        </Text>
        {qualityLine ? <Text style={[styles.qualityLine, { color: muted }]}>{qualityLine}</Text> : null}
        <View style={styles.viewSwitch} accessibilityRole="tablist">
          <Pressable
            style={[styles.viewButton, view === 'list' && styles.viewButtonActive]}
            onPress={() => setView('list')}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === 'list' }}>
            <Text style={[styles.viewButtonText, view === 'list' && styles.viewButtonTextActive]}>
              Squad list
            </Text>
          </Pressable>
          <Pressable
            style={[styles.viewButton, view === 'formation' && styles.viewButtonActive]}
            onPress={() => setView('formation')}
            accessibilityRole="tab"
            accessibilityState={{ selected: view === 'formation' }}>
            <Text style={[styles.viewButtonText, view === 'formation' && styles.viewButtonTextActive]}>
              Formation
            </Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['ALL', ...POSITION_ORDER] as PosFilter[]).map((pos) => (
            <Pressable
              key={pos}
              style={[styles.chip, posFilter === pos && styles.chipActive]}
              onPress={() => setPosFilter(pos)}>
              <Text style={[styles.chipText, posFilter === pos && styles.chipTextActive]}>
                {pos === 'ALL' ? 'All' : pos === 'GK' ? 'Goalkeepers' : pos === 'DF' ? 'Defenders' : pos === 'MF' ? 'Midfielders' : 'Forwards'}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.toggles}>
          <Pressable
            style={[styles.toggle, sortMode === 'overall' && styles.toggleActive]}
            onPress={() => setSortMode('overall')}>
            <Text style={[styles.toggleText, sortMode === 'overall' && styles.toggleTextActive]}>
              By overall
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggle, sortMode === 'position' && styles.toggleActive]}
            onPress={() => setSortMode('position')}>
            <Text style={[styles.toggleText, sortMode === 'position' && styles.toggleTextActive]}>
              By position
            </Text>
          </Pressable>
          {isReal && quality ? (
            <Pressable
              style={[styles.toggle, verifiedOnly && styles.toggleActive]}
              onPress={() => setVerifiedOnly((v) => !v)}>
              <Text style={[styles.toggleText, verifiedOnly && styles.toggleTextActive]}>
                Verified only
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={sorted}
        keyExtractor={(p) => p.id}
        extraData={expandedId}
        onScrollToIndexFailed={(info) => {
          // Virtualised fallback: scroll near the target so its row
          // renders, then the already-set expandedId shows its profile.
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
        }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          view === 'formation' ? (
            <View>
              <FormationBoard
                xi={xi}
                rating={xiRating}
                selectedId={formationSelectedId}
                onSelect={(p) => setFormationSelectedId(p.id)}
              />
              {(() => {
                const selected = xi.find((p) => p.id === formationSelectedId);
                if (!selected) {
                  return (
                    <Text style={[styles.formationHint, { color: muted }]}>
                      Tap a shirt on the pitch to see that player. This is a view-only Best XI.
                    </Text>
                  );
                }
                return (
                  <View style={[styles.selectedCard, { backgroundColor: card }]}>
                    <PlayerAvatar
                      firstName={selected.firstName}
                      lastName={selected.lastName}
                      position={selected.position}
                      size={52}
                    />
                    <View style={styles.nameBlock}>
                      <Text style={[styles.name, { color: text }]}>
                        {selected.firstName} {selected.lastName}
                      </Text>
                      <Text style={{ color: muted, fontSize: 13 }}>
                        {selected.role} · Overall {selected.overall} · POT {selected.potential}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.miniButton, { backgroundColor: COLORS.primary }]}
                      onPress={() => {
                        const index = indexOfPlayer(sorted, selected.id);
                        pendingScrollIndexRef.current = index >= 0 ? index : null;
                        setExpandedId(selected.id);
                        setView('list');
                      }}>
                      <Text style={styles.miniButtonText}>Profile</Text>
                    </Pressable>
                  </View>
                );
              })()}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const packPlayer = isReal && pack ? pack.players.find((p) => p.id === item.id) : undefined;
          const entry = isReal ? playerStatus(quality, item.id, club.id) : undefined;
          const expanded = isProfileExpanded(expandedId, item.id);
          const provisional = isReal && entry && entry.status !== 'verified_current';
          const badge = TIER_BADGE[tierFor(item.overall)];
          return (
            <Pressable
              style={[styles.rowWrap, { backgroundColor: card }]}
              onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.row}>
                <PlayerAvatar
                  firstName={item.firstName}
                  lastName={item.lastName}
                  position={item.position}
                />
                <View style={styles.nameBlock}>
                  <Text style={[styles.name, { color: text }]} numberOfLines={1}>
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text style={{ color: muted, fontSize: 13 }} numberOfLines={1}>
                    {item.role} · Age {item.age}
                    {packPlayer?.nationality ? ` · ${packPlayer.nationality}` : ''}
                  </Text>
                  {provisional ? (
                    <View style={styles.provisionalPill}>
                      <Text style={styles.provisionalText}>Provisional</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.ratings}>
                  <View style={styles.ovrRow}>
                    <View style={[styles.ovrBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.ovrBadgeText, { color: badge.fg }]}>{item.overall}</Text>
                    </View>
                    {isReal ? <Text style={{ color: muted, fontSize: 11 }}>est.</Text> : null}
                  </View>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    POT {item.potential} · {tierFor(item.overall)}
                  </Text>
                </View>
              </View>
              {expanded ? (
                <View style={styles.details}>
                  <AttributeGrid
                    attributes={item.attributes}
                    text={text}
                    muted={muted}
                    highlightKeys={keyAttributesFor(item.role)}
                  />
                  {isReal ? (
                    <Text style={{ color: muted, fontSize: 13, marginTop: 10 }}>
                      Potential {item.potential}
                      {item.developmentRate !== undefined
                        ? ` · Development ${developmentBand(item.developmentRate)}`
                        : ''}
                      {` · Est. value ${formatValueEstimate(valueEstimate(item.overall, item.age))}`}
                      {entry ? ` · ${statusLabel(entry.status)}` : ''}
                    </Text>
                  ) : null}
                  {isReal ? (
                    <View style={{ marginTop: 8, alignItems: 'flex-start' }}>
                      <InfoLink />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
      {isReal ? (
        <View style={styles.footer}>
          <Text style={[styles.foot, { color: muted }]}>
            Ratings marked est. are PCM model estimates.
          </Text>
          <InfoLink />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: SPACING.screen, paddingTop: 12, paddingBottom: 8 },
  title: { ...TYPE.title },
  subtitle: { fontSize: 14, marginTop: 2 },
  qualityLine: { fontSize: 12, marginTop: 4 },
  viewSwitch: { flexDirection: 'row', gap: 8, marginTop: 12 },
  viewButton: {
    flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  viewButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  viewButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  viewButtonTextActive: { color: '#FFFFFF' },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10, paddingRight: 8 },
  chip: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.text },
  chipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  toggle: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  toggleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleText: { fontSize: 13, color: COLORS.text },
  toggleTextActive: { color: '#FFFFFF', fontWeight: '700' },
  list: { paddingHorizontal: SPACING.list, paddingBottom: 24, gap: 8 },
  formationHint: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: SPACING.rowRadius, padding: 12, marginBottom: 8,
  },
  miniButton: { borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  miniButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  rowWrap: { borderRadius: SPACING.rowRadius, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameBlock: { flex: 1, minWidth: 0 },
  name: { ...TYPE.name },
  provisionalPill: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8,
  },
  provisionalText: { color: COLORS.muted, fontSize: 11, fontWeight: '600' },
  ratings: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  ovrRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ovrBadge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  ovrBadgeText: { fontSize: 15, fontWeight: '800' },
  details: { marginTop: 4 },
  footer: { paddingHorizontal: 20, paddingBottom: 16, gap: 6 },
  foot: { fontSize: 12, textAlign: 'center' },
});
