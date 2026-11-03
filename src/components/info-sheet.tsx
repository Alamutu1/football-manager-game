import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS, SPACING, TYPE } from '@/theme';

/**
 * About-this-data sheet (UI Phase 1). All paragraph explanations
 * live here instead of on primary screens, which keep only short
 * markers ("est.", Provisional). Reached from a text link on Club,
 * Squad, and Leagues screens — deliberately NOT a tab, so the main
 * navigation stays uncluttered. Works identically on Android and
 * web because it is a modal, not a route.
 */
export function InfoSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>About this data</Text>
          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.section}>Where the data comes from</Text>
          <Text style={styles.text}>
            Real clubs and players come from Wikidata and openfootball, both
            released under CC0, snapshot 2 Nov 2026. The game works fully
            offline from the bundled pack; nothing is fetched while you play.
          </Text>
          <Text style={styles.section}>What est. means</Text>
          <Text style={styles.text}>
            Player ratings are PCM estimates from the D4 model (v2), built
            from position, age, and club results in 2024-25. They are model
            estimates only: no individual performance data is used, and a
            verified club association does not make a rating verified.
          </Text>
          <Text style={styles.section}>Association statuses</Text>
          <Text style={styles.text}>
            Current means Wikidata-current, not a confirmed matchday squad.
            Left means the player left the club in the data. Conflicting
            means sources disagree. Uncertain means the association could
            not be verified. Players with any status are shown, not hidden;
            non-current players are marked Provisional.
          </Text>
          <Text style={styles.section}>About the game</Text>
          <Text style={styles.text}>
            Pocket Club Manager is not affiliated with any club, league, or
            competition. No official logos, kits, badges, or photographs are
            used; club marks are initials on a colour, and player avatars
            are initials on a position-coloured ring.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Text link that opens the sheet. Drop it into any screen footer. */
export function InfoLink() {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={styles.link}>About this data →</Text>
      </Pressable>
      <InfoSheet visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: COLORS.background, paddingTop: 12 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.screen, paddingBottom: 8,
  },
  title: { ...TYPE.title, color: COLORS.text },
  done: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 14 },
  doneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  body: { paddingHorizontal: SPACING.screen, paddingBottom: 32, gap: 8 },
  section: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 14 },
  text: { color: COLORS.muted, fontSize: 14, lineHeight: 21 },
  link: { color: COLORS.primary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
