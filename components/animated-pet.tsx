import { useEffect } from 'react';
import { Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export type PetKind = 'dog' | 'cat' | 'rabbit' | 'bird' | 'parrot' | 'hamster';

interface Props {
  kind: PetKind;
  size?: number;
  delay?: number;
}

const EMOJI: Record<PetKind, string> = {
  dog: '🐶',
  cat: '🐱',
  rabbit: '🐰',
  bird: '🦜',
  parrot: '🦜',
  hamster: '🐹',
};

/**
 * Cada espécie ganha uma personalidade própria via animação:
 * - cão: pulinho rápido + abana cabeça (rotation curtinha)
 * - gato: cabeceia lentinho (rotation pra cada lado)
 * - coelho: pulos altos com pausa
 * - pássaro: flutua + vai e vem suave
 * - hamster: vibração rápida
 */
export function AnimatedPet({ kind, size = 48, delay = 0 }: Props) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const start = (cb: () => void) => setTimeout(cb, delay);

    if (kind === 'dog') {
      // pulinho rítmico + abana cabeça
      start(() => {
        translateY.value = withRepeat(
          withSequence(
            withTiming(-10, { duration: 380, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }),
            withTiming(0, { duration: 240 }),
          ),
          -1,
        );
        rotate.value = withRepeat(
          withSequence(
            withTiming(-4, { duration: 180 }),
            withTiming(4, { duration: 360 }),
            withTiming(0, { duration: 180 }),
            withTiming(0, { duration: 280 }),
          ),
          -1,
        );
      });
    } else if (kind === 'cat') {
      // cabeceia preguiçoso
      start(() => {
        rotate.value = withRepeat(
          withSequence(
            withTiming(-6, { duration: 900, easing: Easing.inOut(Easing.sin) }),
            withTiming(6, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
        scale.value = withRepeat(
          withSequence(
            withTiming(1.03, { duration: 1800 }),
            withTiming(1, { duration: 1800 }),
          ),
          -1,
          true,
        );
      });
    } else if (kind === 'rabbit') {
      // pulos altos com pausa entre eles
      start(() => {
        translateY.value = withRepeat(
          withSequence(
            withTiming(-18, { duration: 320, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 280, easing: Easing.bounce }),
            withTiming(-12, { duration: 240, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 240, easing: Easing.bounce }),
            withTiming(0, { duration: 900 }),
          ),
          -1,
        );
      });
    } else if (kind === 'bird' || kind === 'parrot') {
      // flutua e oscila lateralmente como se voasse
      start(() => {
        translateY.value = withRepeat(
          withSequence(
            withTiming(-6, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
            withTiming(6, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
        translateX.value = withRepeat(
          withSequence(
            withTiming(4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
            withTiming(-4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        );
      });
    } else {
      // hamster: vibração rápida
      start(() => {
        translateY.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 90 }),
            withTiming(2, { duration: 90 }),
          ),
          -1,
          true,
        );
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, delay]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: size }}>{EMOJI[kind]}</Text>
    </Animated.View>
  );
}
