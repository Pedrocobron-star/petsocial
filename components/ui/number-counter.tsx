import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  value: number;
  duration?: number;
  style?: TextStyle | TextStyle[];
  formatter?: (n: number) => string;
}

/**
 * Número que anima suavemente quando muda (tipo o YouTube subscribe counter).
 * Uso: <NumberCounter value={likes} />
 */
export function NumberCounter({ value, duration = 600, style, formatter }: Props) {
  const animated = useSharedValue(value);
  const [displayed, setDisplayed] = useState(value);

  useEffect(() => {
    animated.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.Never,
    });
  }, [value, duration, animated]);

  useAnimatedReaction(
    () => Math.round(animated.value),
    (v) => {
      runOnJS(setDisplayed)(v);
    },
  );

  const text = formatter ? formatter(displayed) : displayed.toLocaleString('pt-BR');

  return <Animated.Text style={style as TextStyle}>{text}</Animated.Text>;
}
