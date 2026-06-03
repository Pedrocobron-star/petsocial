import { Pressable, ScrollView, Text } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4 py-2"
    >
      {options.map((opt) => (
        <SegmentItem
          key={opt.value}
          label={opt.label}
          active={opt.value === value}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </ScrollView>
  );
}

function SegmentItem({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const progress = useSharedValue(active ? 1 : 0);

  // Atualiza animação quando active muda
  if (active && progress.value !== 1) {
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  } else if (!active && progress.value !== 0) {
    progress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }

  const bgStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: progress.value > 0.5 ? '#F97316' : '#F5F5F5',
      transform: [{ scale: 0.96 + progress.value * 0.04 }],
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    color: progress.value > 0.5 ? '#fff' : '#404040',
  }));

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={[
          bgStyle,
          {
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
          },
        ]}
      >
        <Animated.Text
          style={[
            textStyle,
            {
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
