import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
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

interface Props {
  petName: string;
  years: number | null;
  petId?: string;
}

/**
 * Banner exibido no perfil do pet quando for aniversário hoje.
 * Confete animado + cumprimento.
 */
export function BirthdayBanner({ petName, years, petId }: Props) {
  const rotate = useSharedValue(0);

  useEffect(() => {
    rotate.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        withTiming(4, { duration: 600, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
      ),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [rotate]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }));

  const banner = (
    <View
      style={{
        backgroundColor: '#FFEDD5',
        borderRadius: 16,
        padding: 14,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Confetes flutuando atrás */}
      <Confetti emoji="🎉" left={'10%'} top={6} delay={0} />
      <Confetti emoji="🎂" left={'82%'} top={10} delay={300} />
      <Confetti emoji="✨" left={'48%'} top={-4} delay={600} />

      <Animated.View style={[animStyle, { zIndex: 2 }]}>
        <Text style={{ fontSize: 36 }}>🎂</Text>
      </Animated.View>
      <View style={{ flex: 1, zIndex: 2 }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#9A3412', lineHeight: 22 }}>
          {years && years > 0 ? `${petName} faz ${years} ano${years > 1 ? 's' : ''} hoje!` : `É aniversário de ${petName}!`}
        </Text>
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#9A3412', marginTop: 2 }}>
          Toque pra ver a festa 🐾
        </Text>
      </View>
    </View>
  );

  if (petId) {
    return (
      <Link href={{ pathname: '/pet/[id]/birthday' as never, params: { id: petId } as never }} asChild>
        <Pressable>{banner}</Pressable>
      </Link>
    );
  }
  return banner;
}

function Confetti({ emoji, left, top, delay }: { emoji: string; left: string; top: number; delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-6, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          withTiming(6, { duration: 1400, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
    }, delay);
  }, [delay, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: left as `${number}%`,
          top,
          opacity: 0.5,
          zIndex: 0,
        },
      ]}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
    </Animated.View>
  );
}
