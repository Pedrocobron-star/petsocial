import { Pressable, ScrollView } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

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
      contentContainerClassName="gap-2 px-4 py-1.5"
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
  const { theme } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);

  // Atualiza animação quando active muda
  if (active && progress.value !== 1) {
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  } else if (!active && progress.value !== 0) {
    progress.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never });
  }

  // Segue o accent da área (default = brand). Mesmo padrão do Button primary.
  const activeBg = theme.accent.color;
  const activeText = theme.accent.onAccent;
  const inactiveBg = theme.borderLight;
  const inactiveText = theme.textMuted;

  const bgStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: progress.value > 0.5 ? activeBg : inactiveBg,
      transform: [{ scale: 0.96 + progress.value * 0.04 }],
    };
  });

  const textStyle = useAnimatedStyle(() => ({
    color: progress.value > 0.5 ? activeText : inactiveText,
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Animated.View
        style={[
          bgStyle,
          {
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 7,
          },
        ]}
      >
        <Animated.Text
          style={[
            textStyle,
            {
              fontFamily: FONTS.bodyBold,
              fontSize: 12.5,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}
