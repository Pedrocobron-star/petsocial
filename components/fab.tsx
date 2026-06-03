import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  href: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  position?: ViewStyle;
}

/**
 * Floating Action Button — botão flutuante grande no canto da tela.
 * Pulsa sutilmente pra chamar atenção sem ser irritante.
 */
export function Fab({ href, icon = 'add', color = '#F97316', position }: Props) {
  const pulse = useSharedValue(1);
  const enterScale = useSharedValue(0);

  useEffect(() => {
    // Entry animation
    enterScale.value = withDelay(
      300,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        reduceMotion: ReduceMotion.Never,
      }),
    );
    // Pulse sutil
    pulse.value = withDelay(
      1000,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 1000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin), reduceMotion: ReduceMotion.Never }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    );
  }, [pulse, enterScale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: enterScale.value * pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          position: 'absolute',
          right: 16,
          bottom: 96, // acima do tab bar
          zIndex: 100,
        },
        position,
      ]}
    >
      <Link href={href as never} asChild>
        <Pressable
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: color,
            shadowOpacity: 0.5,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}
        >
          <Ionicons name={icon} size={28} color="#fff" />
        </Pressable>
      </Link>
    </Animated.View>
  );
}
