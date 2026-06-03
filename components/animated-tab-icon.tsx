import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size: number;
}

/**
 * Tab icon que bounce quando vira active. Estilo iOS/Twitter.
 */
export function AnimatedTabIcon({ name, focused, color, size }: Props) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (focused) {
      scale.value = withSequence(
        withTiming(0.8, { duration: 100, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
        withTiming(1.15, { duration: 180, easing: Easing.out(Easing.back(2)), reduceMotion: ReduceMotion.Never }),
        withTiming(1, { duration: 120, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      );
    }
  }, [focused, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={style}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}
