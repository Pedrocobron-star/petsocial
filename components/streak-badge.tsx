import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';

interface Props {
  current: number;
  longest: number;
  postedToday: boolean;
  compact?: boolean;
}

/**
 * Badge de daily streak com chamiha animada.
 * - 0 dias: cinza, sem animação
 * - 1-6 dias: chama pequena
 * - 7-29 dias: chama média
 * - 30+ dias: chama gigante
 */
export function StreakBadge({ current, longest, postedToday, compact }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (current === 0) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [current, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const emojiSize = current >= 30 ? 44 : current >= 7 ? 36 : current >= 1 ? 30 : 24;
  const emoji = current === 0 ? '🪵' : '🔥';

  if (compact) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: current > 0 ? '#FEF3C7' : '#F5F5F5',
          borderRadius: 999,
        }}
      >
        <Text style={{ fontSize: 14 }}>{emoji}</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: current > 0 ? '#92400E' : '#737373',
          }}
        >
          {current}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: current > 0 ? '#FEF3C7' : '#FAFAFA',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: current > 0 ? '#FBBF24' : '#E5E5E5',
      }}
    >
      <Animated.View style={animStyle}>
        <Text style={{ fontSize: emojiSize }}>{emoji}</Text>
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            color: current > 0 ? '#92400E' : '#737373',
            lineHeight: 26,
          }}
        >
          {current === 0
            ? 'Sem streak'
            : current === 1
            ? '1 dia em chamas'
            : `${current} dias em chamas`}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 2 }}>
          {current === 0
            ? 'Posta hoje pra começar a sequência'
            : postedToday
            ? `Recorde: ${longest} dias 🏆`
            : 'Posta hoje pra manter a chama acesa'}
        </Text>
      </View>
    </View>
  );
}
