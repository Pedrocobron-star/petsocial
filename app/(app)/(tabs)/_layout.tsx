import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AnimatedTabIcon } from '@/components/animated-tab-icon';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

export default function TabsLayout() {
  const { pets, loading } = useActivePet();
  const { theme } = useTheme();
  const { t } = useTranslation();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }
  if (pets.length === 0) return <Redirect href="/(app)/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textDim,
        tabBarStyle: {
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontFamily: FONTS.bodySemibold, fontSize: 11 },
      }}
      screenListeners={{
        tabPress: () => {
          haptic.light();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.feed'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="paw" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="search" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.create'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="add-circle" focused={focused} color={color} size={size + 6} />
          ),
        }}
      />
      <Tabs.Screen
        name="meetups"
        options={{
          title: t('tabs.meetups'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="calendar" focused={focused} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="person-circle" focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
