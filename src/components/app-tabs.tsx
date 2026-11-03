import { NativeTabs } from 'expo-router/native-tabs';

import { COLORS } from '@/theme';

// Dark-first tab bar matching the Night Match identity (see
// docs/UI-UX-STANDARD.md). The game does not follow the OS setting.
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={COLORS.background}
      indicatorColor={COLORS.primary}
      labelStyle={{ selected: { color: COLORS.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Club</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="squad">
        <NativeTabs.Trigger.Label>Squad</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leagues">
        <NativeTabs.Trigger.Label>Leagues</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="fixtures">
        <NativeTabs.Trigger.Label>Fixtures</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="table">
        <NativeTabs.Trigger.Label>Table</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
