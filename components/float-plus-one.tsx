import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';

interface Props {
  visible: boolean;
  onDone: () => void;
  text?: string;
  color?: string;
}

/**
 * Mini animação de "+1" flutuante (estilo Twitter ao curtir).
 * Aparece, sobe e desaparece em ~700ms.
 */
export function FloatPlusOne({ visible, onDone, text = '+1', color = '#EF4444' }: Props) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    translateY.value = 0;
    opacity.value = 0;
    translateY.value = withTiming(-40, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
    opacity.value = withSequence(
      withTiming(1, { duration: 150, reduceMotion: ReduceMotion.Never }),
      withTiming(0, { duration: 500, reduceMotion: ReduceMotion.Never }, (finished) => {
        if (finished) runOnJS(onDone)();
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        marginLeft: -16,
        zIndex: 10,
      }}
    >
      <Animated.View style={style}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color }}>
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}
