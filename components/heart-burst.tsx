import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  visible: boolean;
  onComplete: () => void;
  size?: number;
}

/**
 * Coração grande que estoura no meio de um post quando dá double-tap.
 * Estilo Instagram clássico.
 */
export function HeartBurst({ visible, onComplete, size = 120 }: Props) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    // Burst in → hold → fade out
    scale.value = withSequence(
      withTiming(1.3, { duration: 200, easing: Easing.out(Easing.back(1.5)), reduceMotion: ReduceMotion.Never }),
      withTiming(1, { duration: 100, reduceMotion: ReduceMotion.Never }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 100, reduceMotion: ReduceMotion.Never }),
      withDelay(
        500,
        withTiming(0, { duration: 250, reduceMotion: ReduceMotion.Never }, (finished) => {
          if (finished) {
            scale.value = 0;
            runOnJS(onComplete)();
          }
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
      }}
    >
      <Animated.View style={animStyle}>
        <Ionicons name="heart" size={size} color="#ef4444" style={{ opacity: 0.9 }} />
      </Animated.View>
    </View>
  );
}
