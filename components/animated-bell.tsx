import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  count: number;
  color: string;
  size?: number;
}

/**
 * Sino que sacode quando o número de notificações aumenta.
 * Pequeno detalhe que chama atenção sem ser irritante.
 */
export function AnimatedBell({ count, color, size = 26 }: Props) {
  const rotate = useSharedValue(0);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      // Shake
      rotate.value = withRepeat(
        withSequence(
          withTiming(-12, { duration: 80, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
          withTiming(12, { duration: 80, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
          withTiming(-8, { duration: 80, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
          withTiming(8, { duration: 80, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
          withTiming(0, { duration: 80, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
        ),
        1,
        false,
        undefined,
        ReduceMotion.Never,
      );
    }
    prevCount.current = count;
  }, [count, rotate]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={size} color={color} />
    </Animated.View>
  );
}
