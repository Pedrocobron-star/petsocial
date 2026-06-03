import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  active?: boolean;
  activeColor?: string;
  activeBg?: string;
  inactiveColor?: string;
  inactiveBg?: string;
  onPress?: () => void;
  /** Conteúdo customizado (sobrescreve icon+count) */
  children?: ReactNode;
}

/**
 * Pill colorida pra reações de post: heart, comment, share, save.
 * Estilo: borda arredondada, fundo cor tonal, ícone + count animado.
 * Quando ativo: fundo cheio, ícone branco.
 */
export function ReactionPill({
  icon,
  count,
  active = false,
  activeColor = '#fff',
  activeBg = '#EF4444',
  inactiveColor = '#525252',
  inactiveBg = '#F5F3F0',
  onPress,
  children,
}: Props) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.94, {
          duration: 100,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.Never,
        });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, {
          duration: 160,
          easing: Easing.out(Easing.back(2)),
          reduceMotion: ReduceMotion.Never,
        });
      }}
      style={[
        style,
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          backgroundColor: active ? activeBg : inactiveBg,
        },
      ]}
    >
      {children ?? (
        <>
          <Ionicons name={icon} size={16} color={active ? activeColor : inactiveColor} />
          {typeof count === 'number' && count > 0 ? (
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                color: active ? activeColor : inactiveColor,
                letterSpacing: -0.1,
              }}
            >
              {formatCount(count)}
            </Text>
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
}
