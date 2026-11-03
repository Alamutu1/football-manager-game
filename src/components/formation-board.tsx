import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { positionColorFor } from '@/game/player-display';
import { COLORS } from '@/theme';
import type { Player, Position } from '@/game/types';

/** Short name for markers: "B. Saka". */
function shortName(p: Player): string {
  return `${p.firstName.charAt(0)}. ${p.lastName}`;
}

const PITCH_HEIGHT = 480;
const BOX_HEIGHT = 64;
const SPOT_OFFSET = 24;

/**
 * Formation board (UI Phase 1): the same best XI the engine uses,
 * laid out in a 4-4-2 on a realistic pitch — mowing stripes, full
 * markings (boxes, six-yard boxes, penalty spots and arcs, corner
 * arcs, centre circle and spot), and shirt-style markers: a disc
 * with the overall number, ringed by position colour, name below.
 * Tapping a marker selects that player (the parent shows the detail
 * panel); it never changes the XI.
 */
export function FormationBoard({
  xi,
  rating,
  selectedId,
  onSelect,
}: {
  xi: Player[];
  rating: number;
  selectedId: string | null;
  onSelect: (player: Player) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  // Stage 1 only: scale the fixed 480px pitch down on narrow phones so
  // it never forces horizontal overflow, and keep markers readable.
  // Spots, order and selection logic are unchanged.
  const isNarrow = windowWidth < 380;
  const pitchHeight = Math.round(Math.min(PITCH_HEIGHT, Math.max(380, (windowWidth - 32) * 1.4)));
  const markerWidth = isNarrow ? 64 : 72;
  const shirtSize = isNarrow ? 40 : 44;
  const shirtSizeSelected = isNarrow ? 44 : 48;
  const circleSize = Math.min(96, Math.max(72, windowWidth * 0.28));
  const byPos = (pos: Position) => xi.filter((p) => p.position === pos);
  const spots: { player: Player; x: number; y: number }[] = [];
  const place = (players: Player[], xs: number[], y: number) => {
    players.forEach((p, i) => spots.push({ player: p, x: xs[i] ?? 50, y }));
  };
  place(byPos('GK'), [50], 88);
  place(byPos('DF'), [14, 38, 62, 86], 68);
  place(byPos('MF'), [14, 38, 62, 86], 45);
  place(byPos('FW'), [32, 68], 20);

  return (
    <View style={styles.boardWrap}>
      <View style={styles.boardHeader}>
        <Text style={styles.boardTitle}>Best XI · 4-4-2</Text>
        <Text style={styles.boardRating}>Rating {rating}</Text>
      </View>
      <Text style={styles.viewOnlyNote}>
        View only — the game automatically selects the highest-rated players.
        Players cannot be moved and the formation cannot be changed yet.
      </Text>
      <View style={[styles.pitch, { height: pitchHeight }]}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.stripe,
              {
                top: `${i * 12.5}%`,
                backgroundColor: i % 2 === 0 ? COLORS.pitchStripe : COLORS.pitch,
              },
            ]}
          />
        ))}
        <View style={styles.halfway} />
        <View
          style={[
            styles.centreCircle,
            {
              width: circleSize,
              height: circleSize,
              marginLeft: -circleSize / 2,
              marginTop: -circleSize / 2,
              borderRadius: circleSize / 2,
            },
          ]}
        />
        <View style={styles.centreSpot} />
        <View style={styles.boxTop} />
        <View style={styles.sixYardTop} />
        <View style={styles.spotTop} />
        <View style={styles.arcTop} />
        <View style={styles.boxBottom} />
        <View style={styles.sixYardBottom} />
        <View style={styles.spotBottom} />
        <View style={styles.arcBottom} />
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
        {spots.map(({ player, x, y }) => {
          const selected = player.id === selectedId;
          const size = selected ? shirtSizeSelected : shirtSize;
          return (
            <Pressable
              key={player.id}
              style={[
                styles.marker,
                { left: `${x}%`, top: `${y}%`, width: markerWidth, marginLeft: -markerWidth / 2 },
              ]}
              onPress={() => onSelect(player)}>
              <View
                style={[
                  styles.shirt,
                  {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: selected ? COLORS.gold : positionColorFor(player.position),
                  },
                ]}>
                <Text style={styles.shirtOvr}>{player.overall}</Text>
              </View>
              <Text style={styles.markerName} numberOfLines={1}>
                {shortName(player)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const LINE = COLORS.pitchLine;

const styles = StyleSheet.create({
  boardWrap: { marginBottom: 8 },
  boardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  boardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  boardRating: { color: COLORS.gold, fontSize: 14, fontWeight: '700' },
  viewOnlyNote: { color: COLORS.muted, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  pitch: {
    height: PITCH_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: LINE,
    overflow: 'hidden',
    backgroundColor: COLORS.pitch,
  },
  stripe: { position: 'absolute', left: 0, right: 0, height: '12.5%' },
  halfway: { position: 'absolute', left: 0, right: 0, top: '50%', height: 1, backgroundColor: LINE },
  centreCircle: {
    position: 'absolute', left: '50%', top: '50%', width: 96, height: 96,
    marginLeft: -48, marginTop: -48, borderRadius: 48, borderWidth: 1, borderColor: LINE,
  },
  centreSpot: {
    position: 'absolute', left: '50%', top: '50%', width: 5, height: 5,
    marginLeft: -2.5, marginTop: -2.5, borderRadius: 2.5, backgroundColor: LINE,
  },
  boxTop: {
    position: 'absolute', left: '22%', right: '22%', top: 0, height: BOX_HEIGHT,
    borderWidth: 1, borderTopWidth: 0, borderColor: LINE,
  },
  sixYardTop: {
    position: 'absolute', left: '36%', right: '36%', top: 0, height: 26,
    borderWidth: 1, borderTopWidth: 0, borderColor: LINE,
  },
  spotTop: {
    position: 'absolute', left: '50%', top: BOX_HEIGHT + SPOT_OFFSET, width: 5, height: 5,
    marginLeft: -2.5, marginTop: -2.5, borderRadius: 2.5, backgroundColor: LINE,
  },
  // Arc circle centred on the penalty spot with radius equal to the
  // spot-to-box distance, so it touches the box line and reads as a D.
  arcTop: {
    position: 'absolute', left: '50%', top: BOX_HEIGHT + SPOT_OFFSET, width: SPOT_OFFSET * 2, height: SPOT_OFFSET * 2,
    marginLeft: -SPOT_OFFSET, marginTop: -SPOT_OFFSET, borderRadius: SPOT_OFFSET, borderWidth: 1, borderColor: LINE,
  },
  boxBottom: {
    position: 'absolute', left: '22%', right: '22%', bottom: 0, height: BOX_HEIGHT,
    borderWidth: 1, borderBottomWidth: 0, borderColor: LINE,
  },
  sixYardBottom: {
    position: 'absolute', left: '36%', right: '36%', bottom: 0, height: 26,
    borderWidth: 1, borderBottomWidth: 0, borderColor: LINE,
  },
  spotBottom: {
    position: 'absolute', left: '50%', bottom: BOX_HEIGHT + SPOT_OFFSET, width: 5, height: 5,
    marginLeft: -2.5, marginBottom: -2.5, borderRadius: 2.5, backgroundColor: LINE,
  },
  arcBottom: {
    position: 'absolute', left: '50%', bottom: BOX_HEIGHT + SPOT_OFFSET, width: SPOT_OFFSET * 2, height: SPOT_OFFSET * 2,
    marginLeft: -SPOT_OFFSET, marginBottom: -SPOT_OFFSET, borderRadius: SPOT_OFFSET, borderWidth: 1, borderColor: LINE,
  },
  cornerTL: {
    position: 'absolute', left: -18, top: -18, width: 36, height: 36,
    borderRadius: 18, borderWidth: 1, borderColor: LINE,
  },
  cornerTR: {
    position: 'absolute', right: -18, top: -18, width: 36, height: 36,
    borderRadius: 18, borderWidth: 1, borderColor: LINE,
  },
  cornerBL: {
    position: 'absolute', left: -18, bottom: -18, width: 36, height: 36,
    borderRadius: 18, borderWidth: 1, borderColor: LINE,
  },
  cornerBR: {
    position: 'absolute', right: -18, bottom: -18, width: 36, height: 36,
    borderRadius: 18, borderWidth: 1, borderColor: LINE,
  },
  marker: { position: 'absolute', alignItems: 'center', marginTop: -22 },
  shirt: {
    backgroundColor: 'rgba(10, 14, 12, 0.92)',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shirtOvr: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  markerName: {
    color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },
});
