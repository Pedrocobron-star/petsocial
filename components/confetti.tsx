import { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const COLORS = ['#F97316', '#FB923C', '#FDBA74', '#FACC15', '#34D399', '#60A5FA', '#A78BFA', '#F472B6'];
const PIECES = 36;

interface Props {
  /**
   * Quando muda, dispara nova onda de confetti.
   * Use um número incrementado, ou Date.now().
   */
  trigger?: number;
  /** Quantas peças? Default 36. */
  count?: number;
}

/**
 * Componente de confetti leve, baseado em Reanimated.
 * Renderiza peças coloridas caindo do topo com rotação.
 * Coloca como overlay (position absolute) na tela.
 */
export function Confetti({ trigger, count = PIECES }: Props) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={`${trigger ?? 0}-${i}`} index={i} count={count} />
      ))}
    </View>
  );
}

function Piece({ index, count }: { index: number; count: number }) {
  const { width: W, height: H } = Dimensions.get('window');
  const color = COLORS[index % COLORS.length];
  const startX = (index / count) * W + (Math.random() - 0.5) * 30;
  const drift = (Math.random() - 0.5) * 120;
  const size = 6 + Math.random() * 8;
  const duration = 1800 + Math.random() * 1600;
  const delay = Math.random() * 300;
  const finalRotation = (Math.random() - 0.5) * 720;

  const translateY = useSharedValue(-40);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(H + 40, { duration, easing: Easing.in(Easing.quad) }),
    );
    translateX.value = withDelay(delay, withTiming(drift, { duration }));
    rotate.value = withDelay(delay, withTiming(finalRotation, { duration }));
    opacity.value = withDelay(
      delay + duration - 400,
      withTiming(0, { duration: 400 }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  // Shape varia: retângulo, círculo, ou retângulo fininho
  const shape = index % 3;
  const isCircle = shape === 1;
  const isStrip = shape === 2;

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          left: startX,
          top: 0,
          width: isStrip ? size * 0.4 : size,
          height: isStrip ? size * 1.6 : size,
          backgroundColor: color,
          borderRadius: isCircle ? size / 2 : 1,
        },
      ]}
    />
  );
}
