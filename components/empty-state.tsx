import { useEffect } from 'react';
import { Image, Platform, Text, View } from 'react-native';
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
import { MOZART, type MozartKey } from '@/lib/mozart';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  emoji: string;
  /** Quando definido, mostra a ilustração do Mozart (mascote) no lugar do emoji. */
  mozart?: MozartKey;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji, mozart, title, description, action }: Props) {
  const { theme } = useTheme();
  const isMozart = !!mozart;

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

  // Conteúdo do "personagem": ilustração do Mozart (mascote) ou emoji.
  const character = isMozart ? (
    <Image
      source={{ uri: MOZART[mozart] }}
      style={{ width: 132, height: 132 }}
      resizeMode="contain"
      accessibilityLabel="Mozart, o mascote do Maestro Pet"
    />
  ) : (
    <Text style={{ fontSize: 56 }}>{emoji}</Text>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 64 }}>
      {/* Halo atrás do personagem — só atrás do emoji; o mascote tem arte própria */}
      <View
        style={{
          width: isMozart ? 144 : 120,
          height: isMozart ? 144 : 120,
          borderRadius: isMozart ? 72 : 60,
          backgroundColor: isMozart ? 'transparent' : theme.brandLight,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: isMozart ? 12 : 16,
          opacity: isMozart ? 1 : 0.6,
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
            {character}
          </View>
        ) : (
          <Animated.View style={emojiStyle}>{character}</Animated.View>
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
