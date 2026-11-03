import { Link, usePathname } from 'expo-router';
import { Tabs, TabSlot } from 'expo-router/ui';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/theme';

/**
 * Web-only tab bar (UI Phase 1). The old version followed the OS
 * colour scheme and floated as a white pill over dark content. This
 * version uses the same Night Match tokens as the Android native
 * tabs (dark bar, green active state) and sits above the content
 * instead of overlapping it, so web previews match the phone.
 * The Info sheet is reached from in-screen links, not from here,
 * so the main navigation stays to three tabs.
 */
const LINKS = [
  { href: '/', label: 'Club' },
  { href: '/squad', label: 'Squad' },
  { href: '/leagues', label: 'Leagues' },
  { href: '/fixtures', label: 'Fixtures' },
  { href: '/table', label: 'Table' },
] as const;

export default function AppTabs() {
  const pathname = usePathname();
  return (
    <Tabs>
      <View style={styles.bar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.barContent}>
          <Text style={styles.brand} numberOfLines={1}>
            Pocket Club Manager
          </Text>
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} asChild>
                <Pressable style={styles.linkPressable}>
                  <Text style={[styles.link, active && styles.linkActive]}>{link.label}</Text>
                </Pressable>
              </Link>
            );
          })}
        </ScrollView>
      </View>
      <TabSlot style={styles.slot} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  barContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingRight: 16,
  },
  brand: { color: COLORS.text, fontWeight: '800', fontSize: 15, flexShrink: 0 },
  linkPressable: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 4, flexShrink: 0 },
  link: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  linkActive: { color: COLORS.primary, fontWeight: '800' },
  slot: { flex: 1 },
});
