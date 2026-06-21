import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';

/**
 * Apps da tela inicial do "celular do pet" — espelham o springboard REAL do app
 * (app/(app)/phone.tsx): mesmos rótulos, emojis e cores. Quando o app mudar,
 * isto deve mudar junto pra a capa nunca mostrar um app que não existe.
 */
const APPS: { label: string; emoji: string; bg: string }[] = [
  { label: 'Feed', emoji: '🐾', bg: '#FB923C' },
  { label: 'Saúde', emoji: '🩺', bg: '#34D399' },
  { label: 'Chat', emoji: '💬', bg: '#4ADE80' },
  { label: 'Perfil', emoji: '🐶', bg: '#60A5FA' },
  { label: 'Carteirinha', emoji: '🪪', bg: '#22D3EE' },
  { label: 'Galeria', emoji: '🖼️', bg: '#FBBF24' },
  { label: 'Lugares', emoji: '📍', bg: '#FB7185' },
  { label: 'Agenda', emoji: '🗓️', bg: '#2DD4BF' },
  { label: 'Jogos', emoji: '🎮', bg: '#8B5CF6' },
  { label: 'Notícias', emoji: '📰', bg: '#EC4899' },
  { label: 'Conquistas', emoji: '🏆', bg: '#F59E0B' },
  { label: 'Achados', emoji: '🦴', bg: '#FCD34D' },
];

/** Sombra do texto sobre o wallpaper (igual ao LABEL_SHADOW do app). */
const TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.28)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

/** Notificações que entram deslizando no topo — dão a sensação de "app vivo". */
const NOTIFS: { emoji: string; title: string; body: string; tint: string }[] = [
  { emoji: '🔥', title: 'Arena Pet', body: 'Bidu, seu streak chegou a 3 dias!', tint: '#8B5CF6' },
  { emoji: '💉', title: 'Saúde', body: 'Vacina V10 vence em 7 dias', tint: '#34D399' },
  { emoji: '📰', title: 'Redação Maestro Pet', body: 'Nova matéria: petiscos saudáveis', tint: '#EC4899' },
  { emoji: '📍', title: 'Lugares', body: 'Novo café pet-friendly a 800m', tint: '#FB7185' },
  { emoji: '🏆', title: 'Conquista!', body: 'Você virou Mestre dos Pets', tint: '#F59E0B' },
];

function AppIcon({ emoji, bg, label, anim }: { emoji: string; bg: string; label?: string; anim: Animated.Value }) {
  return (
    <Animated.View style={{ alignItems: 'center', width: 64, opacity: anim, transform: [{ scale: anim }] }}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1A1410',
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </View>
      {label ? (
        <Text numberOfLines={1} style={[{ fontFamily: FONTS.bodyMedium, fontSize: 9.5, color: '#fff', marginTop: 5 }, TEXT_SHADOW]}>
          {label}
        </Text>
      ) : null}
    </Animated.View>
  );
}

/**
 * "Celular do pet" animado — centerpiece da capa. Reproduz a tela inicial REAL:
 * wallpaper dourado (gold), card glassy do pet, grade de apps coloridos e a
 * pílula de busca embaixo. Os ícones entram escalonados, uma notificação cicla
 * deslizando do topo e o aparelho flutua de leve. Feito à mão (RN Animated).
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

  // entrada escalonada: card do pet, depois ícones
  const widgetAnim = useRef(new Animated.Value(0)).current;
  const iconAnims = useRef(APPS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const all = [widgetAnim, ...iconAnims];
    Animated.stagger(
      55,
      all.map((a) => Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 })),
    ).start();
  }, [iconAnims, widgetAnim]);

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
    const startTimer = setTimeout(show, 1100);
    return () => {
      active = false;
      clearTimeout(startTimer);
    };
  }, [notifAnim]);

  const notif = NOTIFS[notifIdx];

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative', paddingVertical: 8 }}>
      {/* glow quente atrás */}
      <View
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: 160,
          backgroundColor: '#FDBA74',
          opacity: 0.4,
        }}
      />

      {/* aparelho */}
      <Animated.View
        style={{
          width: 286,
          height: 580,
          borderRadius: 46,
          backgroundColor: '#0F0D14',
          padding: 12,
          shadowColor: '#1A1410',
          shadowOpacity: 0.32,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 24 },
          transform: [
            { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [6, -10] }) },
            { rotateZ: float.interpolate({ inputRange: [0, 1], outputRange: ['-1.3deg', '1.3deg'] }) },
          ],
        }}
      >
        {/* tela */}
        <View style={{ flex: 1, borderRadius: 34, overflow: 'hidden', backgroundColor: '#F58A6F' }}>
          {/* wallpaper "gold" real (FBC687 -> F58A6F) */}
          <LinearGradient
            colors={['#FBC687', '#F58A6F']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          {/* status bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16 }}>
            <Text style={[{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }, TEXT_SHADOW]}>9:41</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Ionicons name="cellular" size={13} color="#fff" />
              <Ionicons name="wifi" size={14} color="#fff" />
              <Ionicons name="battery-full" size={16} color="#fff" />
            </View>
          </View>

          {/* card glassy do pet (igual ao widget do app) */}
          <Animated.View
            style={{
              marginHorizontal: 16,
              marginTop: 16,
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderColor: 'rgba(255,255,255,0.30)',
              borderWidth: 1,
              borderRadius: 20,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              opacity: widgetAnim,
              transform: [{ scale: widgetAnim }],
            }}
          >
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 26 }}>🐶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.92)' }, TEXT_SHADOW]}>Boa tarde 🐾</Text>
              <Text style={[{ fontFamily: FONTS.display, fontSize: 19, color: '#fff' }, TEXT_SHADOW]}>Bidu</Text>
              <Text numberOfLines={1} style={[{ fontFamily: FONTS.body, fontSize: 11, color: 'rgba(255,255,255,0.9)' }, TEXT_SHADOW]}>
                Score de saúde 87 · V10 em 7 dias
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" />
          </Animated.View>

          {/* grade de apps (cores/emojis reais do app) */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 18, rowGap: 14 }}>
            {APPS.map((a, i) => (
              <AppIcon key={a.label} emoji={a.emoji} bg={a.bg} label={a.label} anim={iconAnims[i]} />
            ))}
          </View>

          {/* pílula de busca (igual ao rodapé do app) */}
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.20)',
                borderColor: 'rgba(255,255,255,0.30)',
                borderWidth: 1,
                borderRadius: 999,
                paddingVertical: 11,
              }}
            >
              <Ionicons name="search" size={15} color="#fff" />
              <Text style={[{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#fff' }, TEXT_SHADOW]}>Buscar</Text>
            </View>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'rgba(255,255,255,0.20)',
                borderColor: 'rgba(255,255,255,0.30)',
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="color-palette-outline" size={18} color="#fff" />
            </View>
          </View>

          {/* notificação deslizante */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 46,
              left: 14,
              right: 14,
              backgroundColor: 'rgba(255,255,255,0.97)',
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
