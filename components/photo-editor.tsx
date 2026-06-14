import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useToast } from '@/providers/toast-provider';

/**
 * Editor de foto (recorte + proporção + filtros) — estilo Instagram.
 *
 * Recorte: escolhe 1:1 / 4:5 / 1.91:1, arrasta e dá zoom pra enquadrar, e o
 * expo-image-manipulator recorta de verdade (web + native, custo ZERO). A
 * imagem SEMPRE cobre o quadro (clamp), então nunca aparece fundo vazio.
 *
 * Filtros (SÓ WEB): brilho/contraste/saturação via CSS `filter` no preview e
 * via <canvas> na hora de salvar (mesma string → preview == resultado).
 * "Calor" (temperatura) = overlay com mixBlendMode soft-light. Presets prontos
 * só ajustam esses mesmos controles. Nada de efeito que distorça o pet.
 * No app nativo a aba de filtros some (só recorte) — sem custo, sem lib pesada.
 */

const isWeb = Platform.OS === 'web';

const RATIOS = [
  { key: 'square', label: 'Quadrado', wh: 1 },
  { key: 'portrait', label: 'Retrato', wh: 4 / 5 },
  { key: 'landscape', label: 'Paisagem', wh: 1.91 },
] as const;

const MAX_OUT_WIDTH = 1080; // teto de saída pra não pesar no upload
const MAX_ZOOM = 4;

// ---- Filtros -------------------------------------------------------------

type Adjust = { b: number; c: number; s: number; t: number; extra: string };
const NEUTRAL: Adjust = { b: 0, c: 0, s: 0, t: 0, extra: '' };

// Presets = ponto de partida dos 4 controles (b/c/s/t em -100..100) + sépia.
const PRESETS: { key: string; label: string; v: Adjust }[] = [
  { key: 'original', label: 'Original', v: { b: 0, c: 0, s: 0, t: 0, extra: '' } },
  { key: 'vivido', label: 'Vívido', v: { b: 6, c: 14, s: 38, t: 6, extra: '' } },
  { key: 'quente', label: 'Quente', v: { b: 5, c: 6, s: 12, t: 48, extra: '' } },
  { key: 'frio', label: 'Frio', v: { b: 3, c: 8, s: 6, t: -48, extra: '' } },
  { key: 'pb', label: 'P&B', v: { b: 3, c: 12, s: -100, t: 0, extra: '' } },
  { key: 'vintage', label: 'Vintage', v: { b: 6, c: -8, s: -16, t: 28, extra: 'sepia(0.28)' } },
];

const SLIDERS = [
  { key: 'b', label: 'Brilho' },
  { key: 'c', label: 'Contraste' },
  { key: 's', label: 'Saturação' },
  { key: 't', label: 'Calor' },
] as const;

function cssFromAdjust(a: Adjust): string {
  const brightness = (1 + (a.b / 100) * 0.6).toFixed(3);
  const contrast = (1 + (a.c / 100) * 0.5).toFixed(3);
  const saturate = Math.max(0, 1 + (a.s / 100) * 1).toFixed(3);
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})${
    a.extra ? ` ${a.extra}` : ''
  }`;
}

// "Calor" vira um overlay quente/frio com blend soft-light.
function overlayFromTemp(t: number): { color: string; alpha: number } | null {
  if (!t) return null;
  const alpha = Math.min(Math.abs(t) / 100, 1) * 0.35;
  const color = t > 0 ? '255,176,82' : '82,150,255'; // quente / frio
  return { color, alpha };
}

function isDirty(a: Adjust): boolean {
  return !!(a.b || a.c || a.s || a.t || a.extra);
}

// Aplica o MESMO filtro do preview num <canvas> e devolve um blob URL (web).
function bakeFilterWeb(
  srcUri: string,
  css: string,
  overlay: { color: string; alpha: number } | null,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const g = globalThis as any;
    const img = new g.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = g.document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.filter = css;
        ctx.drawImage(img, 0, 0);
        if (overlay) {
          ctx.filter = 'none';
          ctx.globalCompositeOperation = 'soft-light';
          ctx.globalAlpha = overlay.alpha;
          ctx.fillStyle = `rgb(${overlay.color})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        canvas.toBlob(
          (blob: any) => {
            if (!blob) {
              reject(new Error('toBlob falhou'));
              return;
            }
            resolve(g.URL.createObjectURL(blob));
          },
          'image/jpeg',
          0.9,
        );
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem pro filtro'));
    img.src = srcUri;
  });
}

function getImageSize(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ w, h }),
      (e) => reject(e),
    );
  });
}

// ---- Slider (PanResponder, sem worklet) ---------------------------------

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [w, setW] = useState(0);
  const wRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX;
          const width = wRef.current || 1;
          const f = Math.min(Math.max(x / width, 0), 1);
          onChangeRef.current(Math.round(f * 200 - 100));
        },
        onPanResponderMove: (e) => {
          const x = e.nativeEvent.locationX;
          const width = wRef.current || 1;
          const f = Math.min(Math.max(x / width, 0), 1);
          onChangeRef.current(Math.round(f * 200 - 100));
        },
      }),
    [],
  );

  const frac = (value + 100) / 200;
  const THUMB = 18;
  const thumbLeft = frac * Math.max(0, w - THUMB);

  return (
    <View style={{ paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' }}>{label}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
          {value > 0 ? `+${value}` : value}
        </Text>
      </View>
      <View
        {...responder.panHandlers}
        onLayout={(ev) => {
          const width = ev.nativeEvent.layout.width;
          setW(width);
          wRef.current = width;
        }}
        style={{ height: 28, justifyContent: 'center' }}
      >
        {/* trilho */}
        <View
          style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' }}
          pointerEvents="none"
        />
        {/* preenchimento do centro até o thumb */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            height: 4,
            borderRadius: 2,
            backgroundColor: '#FB923C',
            left: Math.min(frac, 0.5) * w,
            width: Math.abs(frac - 0.5) * w,
          }}
        />
        {/* thumb */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: thumbLeft,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: '#fff',
          }}
        />
      </View>
    </View>
  );
}

// ---- Editor --------------------------------------------------------------

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
  const [tab, setTab] = useState<'crop' | 'filter'>('crop');
  const [presetKey, setPresetKey] = useState('original');
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL);

  // Quadro de recorte: tamanho FIXO (não depende da aba, pra trocar de aba
  // não resetar o enquadramento). Cabe na largura e numa fração da altura.
  const maxFrameW = Math.min(winW - 32, 380);
  const maxFrameH = winH * 0.4;
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

  // Ao abrir/trocar de imagem: reseta filtros e aba.
  useEffect(() => {
    if (!visible || !uri) return;
    setAdjust(NEUTRAL);
    setPresetKey('original');
    setTab('crop');
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

  // Zera o enquadramento (zoom/pan) de forma SÍNCRONA. Usado ao trocar de
  // proporção: como o novo fw/fh/cover só são calculados no próximo render
  // (e os mirrors do clamp só no effect, pós-commit), deixar o transform em
  // identidade já garante que a imagem cobre o quadro novo — sem flash de
  // borda preta nem pan contra valores antigos por 1 frame.
  const resetFraming = () => {
    scale.value = 1;
    savedScale.value = 1;
    tx.value = 0;
    savedTx.value = 0;
    ty.value = 0;
    savedTy.value = 0;
  };

  const setA = (patch: Partial<Adjust>) => setAdjust((p) => ({ ...p, ...patch }));

  const previewCss = cssFromAdjust(adjust);
  const overlay = overlayFromTemp(adjust.t);

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

      // Filtros: só web e só se algo foi mexido.
      let finalUri = result.uri;
      if (isWeb && isDirty(adjust)) {
        try {
          finalUri = await bakeFilterWeb(result.uri, cssFromAdjust(adjust), overlayFromTemp(adjust.t));
        } catch {
          // Se o filtro falhar, ao menos entrega o recorte.
          finalUri = result.uri;
        }
      }
      onDone(finalUri);
    } catch (e) {
      toast.error('Não consegui recortar', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        {/* Topo: cancelar / título / aplicar */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
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
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#FB923C' }}>
                Aplicar
              </Text>
            )}
          </Pressable>
        </View>

        {/* Área da imagem (centralizada, com espaço pro painel embaixo) */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 88,
            paddingBottom: isWeb ? 280 : 170,
          }}
        >
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
                  {/* filtro CSS num View comum (confiável no RN Web) */}
                  <View
                    style={[
                      { width: '100%', height: '100%' },
                      isWeb ? ({ filter: previewCss } as any) : null,
                    ]}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="fill"
                    />
                  </View>
                </Animated.View>

                {/* Overlay de "Calor" (temperatura) — só web */}
                {isWeb && overlay ? (
                  <View
                    pointerEvents="none"
                    style={
                      {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: `rgba(${overlay.color},${overlay.alpha})`,
                        mixBlendMode: 'soft-light',
                      } as any
                    }
                  />
                ) : null}

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

        {/* Painel de baixo: abas + controles */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingBottom: 24,
            paddingTop: 10,
            gap: 12,
          }}
        >
          {/* Abas (Recortar / Filtros) — Filtros só no web */}
          {isWeb ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
              {(['crop', 'filter'] as const).map((t) => {
                const active = tab === t;
                return (
                  <Pressable key={t} onPress={() => setTab(t)} hitSlop={8}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 14,
                        color: active ? '#FB923C' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {t === 'crop' ? 'Recortar' : 'Filtros'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {tab === 'crop' || !isWeb ? (
            <View style={{ gap: 14 }}>
              {/* Zoom (mouse) */}
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

              {/* Proporções */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                {RATIOS.map((r) => {
                  const active = Math.abs(r.wh - ratioWH) < 0.001;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => {
                        setRatioWH(r.wh);
                        resetFraming();
                      }}
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
          ) : (
            <View style={{ gap: 8, paddingHorizontal: 20 }}>
              {/* Presets */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 0 }}
              >
                {PRESETS.map((p) => {
                  const active = presetKey === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        setPresetKey(p.key);
                        setAdjust(p.v);
                      }}
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
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Sliders */}
              <View style={{ gap: 2 }}>
                {SLIDERS.map((sl) => (
                  <Slider
                    key={sl.key}
                    label={sl.label}
                    value={adjust[sl.key]}
                    onChange={(v) => setA({ [sl.key]: v })}
                  />
                ))}
              </View>

              <Pressable
                onPress={() => {
                  setAdjust(NEUTRAL);
                  setPresetKey('original');
                }}
                hitSlop={8}
                style={{ alignSelf: 'center' }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  Resetar ajustes
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
