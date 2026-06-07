import { ActivityIndicator, Pressable, Text, type PressableProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<Variant, { bg: string; text: string }> = {
  primary: { bg: '#F97316', text: '#FFFFFF' },
  secondary: { bg: '#E5E5E5', text: '#171717' },
  ghost: { bg: 'transparent', text: '#404040' },
  danger: { bg: '#EF4444', text: '#FFFFFF' },
};

const sizeStyles: Record<Size, { paddingX: number; paddingY: number; radius: number; fontSize: number }> = {
  sm: { paddingX: 12, paddingY: 8, radius: 10, fontSize: 14 },
  md: { paddingX: 16, paddingY: 12, radius: 12, fontSize: 15 },
  lg: { paddingX: 20, paddingY: 16, radius: 16, fontSize: 17 },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  disabled,
  style,
  ...rest
}: Props) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const scale = useSharedValue(1);
  // 'primary' segue o accent da área (default = brand). Os demais são neutros/
  // semânticos e nunca mudam por área.
  const variantStyle =
    variant === 'primary'
      ? { bg: theme.accent.color, text: theme.accent.onAccent }
      : variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      disabled={isDisabled}
      onPressIn={(e) => {
        scale.value = withTiming(0.96, {
          duration: 100,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.Never,
        });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, {
          duration: 160,
          easing: Easing.out(Easing.back(1.5)),
          reduceMotion: ReduceMotion.Never,
        });
        rest.onPressOut?.(e);
      }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: variantStyle.bg,
          paddingHorizontal: sizeStyle.paddingX,
          paddingVertical: sizeStyle.paddingY,
          borderRadius: sizeStyle.radius,
          width: fullWidth ? '100%' : undefined,
          opacity: isDisabled ? 0.5 : 1,
        },
        animStyle,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary'
              ? theme.accent.onAccent
              : variant === 'danger'
                ? '#fff'
                : '#111'
          }
        />
      ) : (
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: sizeStyle.fontSize,
            color: variantStyle.text,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}
