import { View } from 'react-native';

import { useTheme } from '@/providers/theme-provider';

import { CenteredColumn } from './ui/centered-column';
import { Shimmer } from './ui/shimmer';

/**
 * Skeleton de loading do perfil do pet — matches o layout do PetProfileHero
 * + PetQuickActions pra não dar layout-shift quando dados chegam.
 */
export function PetProfileSkeleton() {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.bg, flex: 1 }}>
      {/* Banner placeholder */}
      {/* Mesma cor do banner real do PetProfileHero (theme.brandLight) — sem
          color-shift skeleton->hero, e adapta no dark (era #FFEDD5 hardcoded). */}
      <View style={{ height: 96, backgroundColor: theme.brandLight, opacity: 0.6 }} />

      <CenteredColumn maxWidth={540} withMargin={false} style={{ paddingHorizontal: 16 }}>
        {/* Avatar circle */}
        <View style={{ marginTop: -50, alignItems: 'center' }}>
          <View
            style={{
              width: 116,
              height: 116,
              borderRadius: 58,
              backgroundColor: theme.surface,
              padding: 4,
            }}
          >
            <Shimmer width={108} height={108} borderRadius={54} />
          </View>
        </View>

        {/* Nome */}
        <View style={{ alignItems: 'center', marginTop: 14, gap: 8 }}>
          <Shimmer width={140} height={26} borderRadius={6} />
          <Shimmer width={180} height={22} borderRadius={11} />
        </View>

        {/* Bio */}
        <View style={{ alignItems: 'center', marginTop: 14, gap: 4 }}>
          <Shimmer width={'80%' as never} height={14} />
          <Shimmer width={'60%' as never} height={14} />
        </View>

        {/* Stats pills */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginTop: 16,
          }}
        >
          <View style={{ flex: 1, height: 54, borderRadius: 14, backgroundColor: theme.borderLight }} />
          <View style={{ flex: 1, height: 54, borderRadius: 14, backgroundColor: theme.borderLight }} />
          <View style={{ flex: 1, height: 54, borderRadius: 14, backgroundColor: theme.borderLight }} />
        </View>

        {/* Buttons row */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Shimmer width={'48%' as never} height={42} borderRadius={12} />
          <Shimmer width={'48%' as never} height={42} borderRadius={12} />
        </View>
      </CenteredColumn>

      {/* Quick actions */}
      <CenteredColumn maxWidth={540}>
        <View style={{ marginTop: 24, gap: 8 }}>
          <View
            style={{
              height: 76,
              backgroundColor: theme.borderLight,
              borderRadius: 18,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, height: 92, backgroundColor: theme.borderLight, borderRadius: 14 }} />
            <View style={{ flex: 1, height: 92, backgroundColor: theme.borderLight, borderRadius: 14 }} />
          </View>
        </View>
      </CenteredColumn>
    </View>
  );
}
