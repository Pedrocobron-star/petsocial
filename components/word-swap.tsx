import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  words: string[];
  interval?: number;
  style?: TextStyle;
  className?: string;
}

export function WordSwap({ words, interval = 2200, style, className }: Props) {
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timer = setInterval(() => {
      opacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.quad) });
      translateY.value = withTiming(-12, { duration: 220, easing: Easing.in(Easing.quad) }, () => {
        translateY.value = 12;
      });
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        opacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) });
        translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.quad) });
      }, 220);
    }, interval);
    return () => clearInterval(timer);
  }, [words.length, interval, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Text style={style} className={className}>
        {words[index]}
      </Text>
    </Animated.View>
  );
}
