import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Dimensions, Modal, Pressable, StatusBar, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  url: string;
}

/**
 * Modal fullscreen pra visualizar uma imagem (tap em foto do post).
 * Fundo preto, fade in suave, tap pra fechar.
 */
export function ImageViewer({ visible, onClose, url }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <StatusBar hidden />
      {visible ? (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(180)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
            hitSlop={20}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </Pressable>
          <Pressable onPress={onClose} style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View entering={ZoomIn.duration(250)}>
              <Image
                source={{ uri: url }}
                style={{ width: W, height: H * 0.8 }}
                contentFit="contain"
              />
            </Animated.View>
          </Pressable>
        </Animated.View>
      ) : null}
    </Modal>
  );
}
