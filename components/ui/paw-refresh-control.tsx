import { useEffect } from 'react';
import { RefreshControl, type RefreshControlProps, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/providers/theme-provider';

/**
 * Refresh control com cor da marca + emoji de pata.
 * Em iOS/Android usa nativo (com tint laranja).
 * No web você pode mostrar o overlay quando refreshing=true.
 */
export function PawRefreshControl(props: RefreshControlProps) {
  const { theme } = useTheme();
  return (
    <RefreshControl
      {...props}
      tintColor={theme.brand}
      colors={[theme.brand]}
      progressBackgroundColor={theme.surface}
      title="🐾 Carregando..."
      titleColor={theme.brand}
    />
  );
}

/**
 * Overlay visual de refresh pra web (RefreshControl não funciona bem lá).
 * Renderiza por cima da lista enquanto refreshing=true.
 */
export function PawRefreshOverlay({ refreshing }: { refreshing: boolean }) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      rotate.value = withRepeat(
        withTiming(360, { duration: 800, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      );
    } else {
      rotate.value = 0;
    }
  }, [refreshing, rotate]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  if (!refreshing) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 12,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: '#1A1410',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
        }}
      >
        <Animated.View style={style}>
          <Text style={{ fontSize: 16 }}>🐾</Text>
        </Animated.View>
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Atualizando...</Text>
      </View>
    </View>
  );
}
