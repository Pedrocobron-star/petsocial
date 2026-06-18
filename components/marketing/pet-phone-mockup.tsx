import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';

/** Apps que aparecem na tela inicial do "celular do pet" (cores da identidade real). */
const APPS: { label: string; emoji: string; bg: string }[] = [
  { label: 'Saúde', emoji: '🩺', bg: '#14B8A6' },
  { label: 'Jogos', emoji: '🎮', bg: '#8B5CF6' },
  { label: 'Notícias', emoji: '📰', bg: '#EC4899' },
  { label: 'Carteirinha', emoji: '🪪', bg: '#06B6D4' },
  { label: 'Lugares', emoji: '📍', bg: '#3B82F6' },
  { label: 'Rolês', emoji: '🎉', bg: '#A855F7' },
  { label: 'Conquistas', emoji: '🏆', bg: '#F59E0B' },
  { label: 'Achados', emoji: '🦴', bg: '#FBBF24' },
  { label: 'Vantagens', emoji: '🎁', bg: '#EC4899' },
];

const DOCK: { emoji: string; bg: string }[] = [
  { emoji: '🐾', bg: '#FB923C' },
  { emoji: '🩺', bg: '#34D399' },
  { emoji: '💬', bg: '#4ADE80' },
  { emoji: '🐶', bg: '#60A5FA' },
];

/** Notificações que entram deslizando no topo — dão a sensação de "app vivo". */
const NOTIFS: { emoji: string; title: string; body: string; tint: string }[] = [
  { emoji: '🔥', title: 'Arena Pet', body: 'Bidu, seu streak chegou a 3 dias!', tint: '#8B5CF6' },
  { emoji: '💉', title: 'Saúde', body: 'Vacina V10 vence em 7 dias', tint: '#14B8A6' },
  { emoji: '📰', title: 'Redação Maestro Pet', body: 'Nova matéria: petiscos saudáveis', tint: '#EC4899' },
  { emoji: '🎯', title: 'Desafio de hoje', body: 'Quiz Pet no 🟡 Médio. Topa?', tint: '#F472B6' },
  { emoji: '📍', title: 'Lugares', body: 'Novo café pet-friendly a 800m', tint: '#3B82F6' },
  { emoji: '🏆', title: 'Conquista!', body: 'Você virou Mestre dos Pets', tint: '#F59E0B' },
];

function AppIcon({ emoji, bg, label, anim }: { emoji: string; bg: string; label?: string; anim: Animated.Value }) {
  return (
    <Animated.View style={{ alignItems: 'center', width: 64, opacity: anim, transform: [{ scale: anim }] }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 13,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: bg,
          shadowOpacity: 0.5,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      {label ? (
        <Text numberOfLines={1} style={{ fontFamily: FONTS.bodyMedium, fontSize: 9.5, color: '#fff', marginTop: 4 }}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/** Mascote/ícone flutuante que orbita o celular (parallax). */
function FloatingSticker({
  emoji,
  bg,
  style,
  delay,
}: {
  emoji: string;
  bg: string;
  style: object;
  delay: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 2600, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: bg,
          shadowOpacity: 0.45,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) }],
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 28 }}>{emoji}</Text>
    </Animated.View>
  );
}

/**
 * "Celular do pet" animado — centerpiece da capa. A tela inicial mostra os apps
 * reais (Saúde, Jogos, Notícias, Carteirinha...), com entrada escalonada dos
 * ícones, uma notificação que entra deslizando e cicla, o aparelho flutuando
 * de leve e stickers orbitando. Feito à mão (RN Animated), nada genérico.
 */
export function PetPhoneMockup() {
  // float + leve inclinação do aparelho
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // entrada escalonada dos ícones (+ widget de resumo por último)
  const iconAnims = useRef(APPS.map(() => new Animated.Value(0))).current;
  const dockAnims = useRef(DOCK.map(() => new Animated.Value(0))).current;
  const widgetAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const all = [...iconAnims, widgetAnim, ...dockAnims];
    Animated.stagger(
      70,
      all.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
      ),
    ).start();
  }, [iconAnims, dockAnims, widgetAnim]);

  // notificação que cicla
  const [notifIdx, setNotifIdx] = useState(0);
  const notifAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let idx = 0;
    let active = true;
    const show = () => {
      if (!active) return;
      setNotifIdx(idx);
      Animated.sequence([
        Animated.spring(notifAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
        Animated.delay(2600),
        Animated.timing(notifAnim, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && active) {
          idx = (idx + 1) % NOTIFS.length;
          setTimeout(show, 500);
        }
      });
    };
    const startTimer = setTimeout(show, 900);
    return () => {
      active = false;
      clearTimeout(startTimer);
    };
  }, [notifAnim]);

  const notif = NOTIFS[notifIdx];

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative', paddingVertical: 8 }}>
      {/* glow atrás */}
      <View
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: '#FDBA74',
          opacity: 0.45,
        }}
      />

      {/* stickers orbitando */}
      <FloatingSticker emoji="🦴" bg="#FBBF24" delay={0} style={{ top: 6, left: 0 }} />
      <FloatingSticker emoji="🎮" bg="#8B5CF6" delay={800} style={{ bottom: 40, left: -6 }} />
      <FloatingSticker emoji="🩺" bg="#14B8A6" delay={1400} style={{ top: 70, right: -4 }} />
      <FloatingSticker emoji="🏆" bg="#F59E0B" delay={500} style={{ bottom: 8, right: 6 }} />

      {/* aparelho */}
      <Animated.View
        style={{
          width: 286,
          height: 580,
          borderRadius: 44,
          backgroundColor: '#0F0D14',
          padding: 12,
          shadowColor: '#1A1410',
          shadowOpacity: 0.3,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 24 },
          transform: [
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [6, -10] }) },
            { rotateZ: float.interpolate({ inputRange: [0, 1], outputRange: ['-1.4deg', '1.4deg'] }) },
          ],
        }}
      >
        {/* tela */}
        <View style={{ flex: 1, borderRadius: 33, overflow: 'hidden', backgroundColor: '#F0A57E' }}>
          {/* fundo gradiente fake (camadas) */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#E8956B' }} />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 280, backgroundColor: '#F2B58E' }} />

          {/* status bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 16 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>9:41</Text>
            <Text style={{ fontSize: 12 }}>📶 🔋</Text>
          </View>

          {/* greeting */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              backgroundColor: 'rgba(255,255,255,0.25)',
              borderRadius: 18,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 22 }}>🐶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>Boa tarde 🐾</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>Bidu</Text>
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>dom, 7 jun</Text>
          </View>

          {/* grade de apps */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 18, rowGap: 14 }}>
            {APPS.map((a, i) => (
              <AppIcon key={a.label} emoji={a.emoji} bg={a.bg} label={a.label} anim={iconAnims[i]} />
            ))}
          </View>

          {/* widget de resumo (estilo widget de iOS) — preenche a tela e reforça o gancho de saúde */}
          <Animated.View
            style={{
              marginHorizontal: 16,
              marginTop: 18,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderRadius: 20,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              shadowColor: '#1A1410',
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 5 },
              opacity: widgetAnim,
              transform: [{ scale: widgetAnim }],
            }}
          >
            {/* anel de score */}
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                borderWidth: 4,
                borderColor: '#14B8A6',
                borderTopColor: '#E2E8F0',
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: '45deg' }],
              }}
            >
              <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#0F766E', transform: [{ rotate: '-45deg' }] }}>
                87
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#1A1410' }}>Resumo de hoje</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                <Text style={{ fontSize: 11 }}>💉</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#525252' }}>V10 em 7 dias</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Text style={{ fontSize: 11 }}>🔥</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#525252' }}>Streak de 3 dias nos jogos</Text>
              </View>
            </View>
          </Animated.View>

          {/* dock */}
          <View
            style={{
              position: 'absolute',
              bottom: 14,
              left: 16,
              right: 16,
              backgroundColor: 'rgba(255,255,255,0.22)',
              borderRadius: 24,
              paddingVertical: 10,
              flexDirection: 'row',
              justifyContent: 'space-around',
            }}
          >
            {DOCK.map((d, i) => (
              <AppIcon key={i} emoji={d.emoji} bg={d.bg} anim={dockAnims[i]} />
            ))}
          </View>

          {/* notificação deslizante */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 44,
              left: 14,
              right: 14,
              backgroundColor: 'rgba(255,255,255,0.96)',
              borderRadius: 16,
              padding: 11,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderLeftWidth: 4,
              borderLeftColor: notif.tint,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
              opacity: notifAnim,
              transform: [{ translateY: notifAnim.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }],
            }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: `${notif.tint}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>{notif.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: '#1A1410' }}>{notif.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 11, color: '#525252' }}>{notif.body}</Text>
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 9.5, color: '#A3A3A3' }}>agora</Text>
          </Animated.View>
        </View>

        {/* notch */}
        <View
          style={{
            position: 'absolute',
            top: 12,
            alignSelf: 'center',
            width: 110,
            height: 26,
            borderRadius: 16,
            backgroundColor: '#0F0D14',
          }}
        />
      </Animated.View>
    </View>
  );
}
