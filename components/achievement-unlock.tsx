import { useEffect } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Confetti } from '@/components/confetti';
import { FONTS } from '@/lib/fonts';

interface Props {
  visible: boolean;
  emoji: string;
  title: string;
  description: string;
  onClose: () => void;
}

/**
 * Modal "Conquista desbloqueada!" com confete + animação de escala + glow.
 * Aparece quando o user destrava um achievement novo.
 */
export function AchievementUnlock({ visible, emoji, title, description, onClose }: Props) {
  const scale = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    scale.value = withSequence(
      withSpring(1, { damping: 8, stiffness: 100, reduceMotion: ReduceMotion.Never }),
    );
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 400, reduceMotion: ReduceMotion.Never }),
      withDelay(
        2500,
        withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (finished) => {
          if (finished) {
            scale.value = 0;
            runOnJS(onClose)();
          }
        }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Confetti count={60} />
        <Animated.View
          style={[
            cardStyle,
            {
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: 32,
              alignItems: 'center',
              gap: 12,
              maxWidth: 360,
              width: '100%',
              shadowColor: '#F59E0B',
              shadowOpacity: 0.6,
              shadowRadius: 30,
              shadowOffset: { width: 0, height: 0 },
            },
          ]}
        >
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.8,
              color: '#F59E0B',
              textTransform: 'uppercase',
            }}
          >
            🏆 Conquista desbloqueada!
          </Text>
          {/* Emoji dançante — usa animação CSS no web pra ignorar reduce motion */}
          <View
            style={
              Platform.OS === 'web'
                ? ({
                    animation: 'pet-dance 1.2s ease-in-out infinite',
                    transformOrigin: '50% 90%',
                  } as never)
                : undefined
            }
          >
            <Text style={{ fontSize: 96 }}>{emoji}</Text>
          </View>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 26,
              color: '#1A1410',
              textAlign: 'center',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: '#525252',
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            {description}
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
