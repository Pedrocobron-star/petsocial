import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  color?: string;
  size?: number;
}

/**
 * 3 pontinhos pulando sequencialmente — usado pra "alguém está digitando..." e IA pensando.
 */
export function TypingDots({ color = '#737373', size = 6 }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size / 2 }}>
      <Dot color={color} size={size} delay={0} />
      <Dot color={color} size={size} delay={180} />
      <Dot color={color} size={size} delay={360} />
    </View>
  );
}

function Dot({ color, size, delay }: { color: string; size: number; delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-size, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic), reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 300, reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 280, reduceMotion: ReduceMotion.Never }),
          withTiming(0.4, { duration: 580, reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
  }, [delay, size, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
      ]}
    />
  );
}
