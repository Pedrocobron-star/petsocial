import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useToast } from '@/providers/toast-provider';

/**
 * Editor de foto (recorte + proporção) — estilo Instagram, MVP.
 *
 * Escolhe 1:1 / 4:5 / 1.91:1, arrasta e dá zoom pra enquadrar, e o
 * expo-image-manipulator recorta de verdade (web + native, custo ZERO).
 * Sem filtros nesta versão (próxima leva). A imagem SEMPRE cobre o quadro
 * (clamp), então nunca aparece fundo vazio.
 */

const RATIOS = [
  { key: 'square', label: 'Quadrado', wh: 1 },
  { key: 'portrait', label: 'Retrato', wh: 4 / 5 },
  { key: 'landscape', label: 'Paisagem', wh: 1.91 },
] as const;

const MAX_OUT_WIDTH = 1080; // teto de saída pra não pesar no upload
const MAX_ZOOM = 4;

function getImageSize(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      (e) => reject(e),
    );
  });
}

export function PhotoEditor({
  uri,
  visible,
  onCancel,
  onDone,
}: {
  uri: string | null;
  visible: boolean;
  onCancel: () => void;
  onDone: (newUri: string) => void;
}) {
  const toast = useToast();
  const { width: winW, height: winH } = useWindowDimensions();
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [ratioWH, setRatioWH] = useState<number>(1);
  const [saving, setSaving] = useState(false);

  // Quadro de recorte: cabe na largura e numa fração da altura.
  const maxFrameW = Math.min(winW - 32, 400);
  const maxFrameH = winH * 0.52;
  let fw = maxFrameW;
  let fh = fw / ratioWH;
  if (fh > maxFrameH) {
    fh = maxFrameH;
    fw = fh * ratioWH;
  }

  // Escala-base que faz a imagem COBRIR o quadro.
  const base = imgSize ? Math.max(fw / imgSize.w, fh / imgSize.h) : 1;
  const coverW = imgSize ? imgSize.w * base : fw;
  const coverH = imgSize ? imgSize.h * base : fh;

  // Shared values (animação) — userScale ≥ 1; tx/ty em px de tela.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTy = useSharedValue(0);
  // Espelhos pro worklet de clamp (sempre atuais).
  const coverWSV = useSharedValue(0);
  const coverHSV = useSharedValue(0);
  const fwSV = useSharedValue(0);
  const fhSV = useSharedValue(0);

  // Carrega o tamanho natural quando abre/troca de imagem.
  useEffect(() => {
    if (!visible || !uri) return;
    let alive = true;
    getImageSize(uri)
      .then((s) => {
        if (alive) setImgSize(s);
      })
      .catch(() => {
        if (alive) setImgSize(null);
      });
    return () => {
      alive = false;
    };
  }, [uri, visible]);

  // Sempre que imagem/quadro mudam: atualiza espelhos e RESETA o enquadramento.
  useEffect(() => {
    coverWSV.value = coverW;
    coverHSV.value = coverH;
    fwSV.value = fw;
    fhSV.value = fh;
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    savedTx.value = 0;
    ty.value = 0;
    savedTy.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverW, coverH, fw, fh]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      const s = scale.value;
      const maxTx = Math.max(0, (coverWSV.value * s - fwSV.value) / 2);
      const maxTy = Math.max(0, (coverHSV.value * s - fhSV.value) / 2);
      tx.value = Math.min(Math.max(savedTx.value + e.translationX, -maxTx), maxTx);
      ty.value = Math.min(Math.max(savedTy.value + e.translationY, -maxTy), maxTy);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const s = Math.min(Math.max(savedScale.value * e.scale, 1), MAX_ZOOM);
      scale.value = s;
      const maxTx = Math.max(0, (coverWSV.value * s - fwSV.value) / 2);
      const maxTy = Math.max(0, (coverHSV.value * s - fhSV.value) / 2);
      tx.value = Math.min(Math.max(tx.value, -maxTx), maxTx);
      ty.value = Math.min(Math.max(ty.value, -maxTy), maxTy);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const gesture = Gesture.Simultaneous(pan, pinch);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // Zoom por botão (desktop/mouse, sem pinça).
  const bumpZoom = (delta: number) => {
    const s = Math.min(Math.max(savedScale.value + delta, 1), MAX_ZOOM);
    scale.value = s;
    savedScale.value = s;
    const maxTx = Math.max(0, (coverW * s - fw) / 2);
    const maxTy = Math.max(0, (coverH * s - fh) / 2);
    const nx = Math.min(Math.max(tx.value, -maxTx), maxTx);
    const ny = Math.min(Math.max(ty.value, -maxTy), maxTy);
    tx.value = nx;
    savedTx.value = nx;
    ty.value = ny;
    savedTy.value = ny;
  };

  const apply = async () => {
    if (!uri || !imgSize || saving) return;
    setSaving(true);
    try {
      const s = scale.value;
      const S = base * s; // escala total display→original
      // Canto do quadro em px da imagem original.
      let cx = imgSize.w / 2 - (fw / 2 + tx.value) / S;
      let cy = imgSize.h / 2 - (fh / 2 + ty.value) / S;
      let cw = fw / S;
      let ch = fh / S;
      // Clamp defensivo nos limites da imagem.
      cx = Math.min(Math.max(cx, 0), Math.max(0, imgSize.w - cw));
      cy = Math.min(Math.max(cy, 0), Math.max(0, imgSize.h - ch));
      cw = Math.min(cw, imgSize.w - cx);
      ch = Math.min(ch, imgSize.h - cy);

      const actions: Parameters<typeof manipulateAsync>[1] = [
        {
          crop: {
            originX: Math.round(cx),
            originY: Math.round(cy),
            width: Math.round(cw),
            height: Math.round(ch),
          },
        },
      ];
      if (Math.round(cw) > MAX_OUT_WIDTH) {
        actions.push({ resize: { width: MAX_OUT_WIDTH } });
      }
      const result = await manipulateAsync(uri, actions, {
        compress: 0.9,
        format: SaveFormat.JPEG,
      });
      onDone(result.uri);
    } catch (e) {
      toast.error('Não consegui recortar', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
        {/* Topo: cancelar / título / aplicar */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 44,
            paddingBottom: 12,
          }}
        >
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>Cancelar</Text>
          </Pressable>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>Editar foto</Text>
          <Pressable onPress={apply} hitSlop={10} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#FB923C" />
            ) : (
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#FB923C' }}>Aplicar</Text>
            )}
          </Pressable>
        </View>

        {/* Quadro de recorte */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {!imgSize || !uri ? (
            <View style={{ width: fw, height: fh, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <GestureDetector gesture={gesture}>
              <View
                style={{
                  width: fw,
                  height: fh,
                  overflow: 'hidden',
                  borderRadius: 6,
                  backgroundColor: '#000',
                }}
              >
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: (fw - coverW) / 2,
                      top: (fh - coverH) / 2,
                      width: coverW,
                      height: coverH,
                    },
                    animStyle,
                  ]}
                >
                  <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="fill" />
                </Animated.View>
                {/* Grade de terços (sutil) */}
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                >
                  {[1, 2].map((i) => (
                    <View
                      key={`v${i}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: (fw / 3) * i,
                        width: 1,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    />
                  ))}
                  {[1, 2].map((i) => (
                    <View
                      key={`h${i}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: (fh / 3) * i,
                        height: 1,
                        backgroundColor: 'rgba(255,255,255,0.25)',
                      }}
                    />
                  ))}
                </View>
              </View>
            </GestureDetector>
          )}
        </View>

        {/* Controles: zoom (mouse) + proporções */}
        <View style={{ position: 'absolute', bottom: 36, left: 0, right: 0, gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
            <Pressable
              onPress={() => bumpZoom(-0.25)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Diminuir zoom"
            >
              <Ionicons name="remove" size={22} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => bumpZoom(0.25)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="Aumentar zoom"
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
            {RATIOS.map((r) => {
              const active = Math.abs(r.wh - ratioWH) < 0.001;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setRatioWH(r.wh)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? '#FB923C' : 'rgba(255,255,255,0.14)',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: active ? '#1A1410' : '#fff',
                    }}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
            }}
          >
            Arraste pra reposicionar · pinça ou +/− pra dar zoom
          </Text>
        </View>
      </View>
    </Modal>
  );
}
