import { Image } from 'expo-image';
import { Dimensions, type ImageSourcePropType } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { width: W } = Dimensions.get('window');

interface Props {
  uri?: string | null;
  scrollY: SharedValue<number>;
  height?: number;
  /** Cor de fundo se sem imagem */
  fallbackColor?: string;
}

/**
 * Hero image com efeito parallax + zoom-out ao scrollar pra baixo
 * (pull-to-refresh estilo Instagram/Twitter).
 */
export function HeroParallax({ uri, scrollY, height = 220, fallbackColor = '#FED7AA' }: Props) {
  const animStyle = useAnimatedStyle(() => {
    const translate = interpolate(scrollY.value, [-100, 0, 100], [-50, 0, 100], 'clamp');
    const scale = interpolate(scrollY.value, [-100, 0, 100], [1.4, 1, 1], 'clamp');
    return {
      transform: [{ translateY: translate }, { scale }],
    };
  });

  return (
    <Animated.View
      style={[
        animStyle,
        {
          width: W,
          height,
          backgroundColor: fallbackColor,
          overflow: 'hidden',
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri } as ImageSourcePropType}
          style={{ width: W, height, opacity: 0.4 }}
          contentFit="cover"
          blurRadius={8}
        />
      ) : null}
    </Animated.View>
  );
}
