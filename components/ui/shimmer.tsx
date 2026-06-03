import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Skeleton com efeito shimmer (brilho passando) animado.
 * Sensação de "carregando" premium.
 */
export function Shimmer({ width = '100%', height = 16, borderRadius = 6, style }: Props) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [translateX]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translateX.value * 100}%` }],
  }));

  return (
    <View
      style={[
        {
          width: width as number,
          height: height as number,
          borderRadius,
          backgroundColor: '#E5E5E5',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          animStyle,
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-30%',
            right: '-30%',
            backgroundColor: 'transparent',
          },
        ]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#F5F5F5',
            shadowColor: '#fff',
            shadowOpacity: 0.6,
            shadowRadius: 12,
            opacity: 0.6,
          }}
        />
      </Animated.View>
    </View>
  );
}
