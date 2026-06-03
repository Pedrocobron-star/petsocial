import { useEffect } from 'react';
import { Platform, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  emoji: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji, title, description, action }: Props) {
  const { theme } = useTheme();

  // Emoji float animation (sobe e desce suavemente)
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    rotate.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 2000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(3, { duration: 2000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [translateY, rotate]);

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
      {/* Halo behind emoji */}
      <View
        style={{
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: theme.brandLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          opacity: 0.6,
        }}
      >
        {/* Web: anima via inline CSS (bypassa Reanimated reduce motion).
            Native: usa Reanimated normal. */}
        {Platform.OS === 'web' ? (
          <View
            style={
              {
                animation: 'pet-float-y 3s ease-in-out infinite',
                transformOrigin: '50% 80%',
              } as never
            }
          >
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </View>
        ) : (
          <Animated.View style={emojiStyle}>
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </Animated.View>
        )}
      </View>
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: 22,
          color: theme.text,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.textDim,
            textAlign: 'center',
            lineHeight: 22,
            maxWidth: 320,
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}
