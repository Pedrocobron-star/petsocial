import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedTabIcon } from '@/components/animated-tab-icon';
import { haptic } from '@/lib/haptics';
import { useTranslation } from '@/lib/i18n';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

export default function TabsLayout() {
  const { pets, loading } = useActivePet();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

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
        tabBarShowLabel: false,
        tabBarStyle: {
          borderTopColor: theme.border,
          backgroundColor: theme.surface,
          height: 48 + insets.bottom,
          paddingTop: 4,
          paddingBottom: insets.bottom,
        },
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
