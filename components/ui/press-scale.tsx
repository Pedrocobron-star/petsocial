import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  /** Quanto o componente escala ao pressionar. Default 0.97. */
  scale?: number;
  /** Duração da animação em ms. Default 120. */
  duration?: number;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Wrapper de Pressable com animação de scale ao tocar.
 * Dá sensação tátil premium em qualquer botão/card.
 *
 * Uso:
 *   <PressScale onPress={onPress}>
 *     <Card />
 *   </PressScale>
 */
export function PressScale({ children, scale = 0.97, duration = 120, style, ...rest }: Props) {
  const s = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        s.value = withTiming(scale, {
          duration,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.Never,
        });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, {
          duration: duration + 40,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.Never,
        });
        rest.onPressOut?.(e);
      }}
      style={[animStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
}
