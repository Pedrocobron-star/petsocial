import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg';

import { PetAvatar } from '@/components/pet-avatar';
import { FONTS } from '@/lib/fonts';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

/** Papéis de parede estilo iPhone (gradiente vertical). Texto sempre branco + sombra. */
const WALLPAPERS = [
  { id: 'gold', from: '#FBC687', to: '#F58A6F' },
  { id: 'coral', from: '#FF9A9E', to: '#F6416C' },
  { id: 'sunset', from: '#FA709A', to: '#FEC163' },
  { id: 'ocean', from: '#4FACFE', to: '#1D63EA' },
  { id: 'grape', from: '#A18CD1', to: '#C86DD7' },
  { id: 'mint', from: '#43E97B', to: '#1BAE8E' },
  { id: 'sky', from: '#5EE7DF', to: '#7873F5' },
  { id: 'night', from: '#3A6073', to: '#16222A' },
  { id: 'peach', from: '#FFD3A5', to: '#FD6585' },
  { id: 'mono', from: '#43464B', to: '#1C1C1E' },
];

const LABEL_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 3,
} as const;

interface PhoneApp {
  label: string;
  emoji: string;
  bg: string;
  href: string;
}

function AppIcon({
  app,
  iconSize,
  cellWidth,
  hideLabel,
}: {
  app: PhoneApp;
  iconSize: number;
  cellWidth?: number;
  hideLabel?: boolean;
}) {
  const w = cellWidth ?? iconSize;
  return (
    <Link href={app.href as never} asChild>
      <Pressable style={{ width: w, alignItems: 'center' }}>
        <View
          style={{
            width: iconSize,
            height: iconSize,
            borderRadius: iconSize * 0.2237, // squircle aproximado (iOS)
            backgroundColor: app.bg,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: iconSize * 0.46 }}>{app.emoji}</Text>
        </View>
        {!hideLabel ? (
          <Text
            numberOfLines={1}
            style={[
              {
                fontFamily: FONTS.bodyMedium,
                fontSize: 11.5,
                color: '#fff',
                marginTop: 6,
                maxWidth: w - 2,
                textAlign: 'center',
              },
              LABEL_SHADOW,
            ]}
          >
            {app.label}
          </Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

function GradientSwatch({
  wp,
  selected,
  onPress,
}: {
  wp: (typeof WALLPAPERS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`Papel de parede ${wp.id}`}
      style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        overflow: 'hidden',
        borderWidth: selected ? 3 : 1,
        borderColor: selected ? '#fff' : 'rgba(255,255,255,0.4)',
      }}
    >
      <Svg width={46} height={46}>
        <Defs>
          <SvgGradient id={`sw-${wp.id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={wp.from} />
            <Stop offset="1" stopColor={wp.to} />
          </SvgGradient>
        </Defs>
        <Rect width={46} height={46} fill={`url(#sw-${wp.id})`} />
      </Svg>
    </Pressable>
  );
}

export default function PetPhoneScreen() {
  const { pets, activePet, setActivePet, loading } = useActivePet();
  const { session } = useSession();
  const { width, height } = useWindowDimensions();
  const userId = session?.user.id;

  const wallpaperKey = userId ? `petsocial:phone-wallpaper:${userId}` : null;
  const [wallpaperId, setWallpaperId] = useState('gold');
  const [showWallpapers, setShowWallpapers] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!wallpaperKey) return;
    AsyncStorage.getItem(wallpaperKey)
      .then((v) => {
        if (v && WALLPAPERS.some((w) => w.id === v)) setWallpaperId(v);
      })
      .catch(() => {});
  }, [wallpaperKey]);

  const pickWallpaper = (id: string) => {
    setWallpaperId(id);
    if (wallpaperKey) AsyncStorage.setItem(wallpaperKey, id).catch(() => {});
  };

  const wp = WALLPAPERS.find((w) => w.id === wallpaperId) ?? WALLPAPERS[0];
  const pid = activePet?.id ?? '';

  const dockApps: PhoneApp[] = useMemo(
    () => [
      { label: 'Feed', emoji: '🐾', bg: '#FB923C', href: '/(app)/(tabs)' },
      { label: 'Saúde', emoji: '🩺', bg: '#34D399', href: `/(app)/pet/${pid}/health` },
      { label: 'Chat', emoji: '💬', bg: '#4ADE80', href: '/(app)/messages' },
      { label: 'Perfil', emoji: '🐶', bg: '#60A5FA', href: `/(app)/pet/${pid}` },
    ],
    [pid],
  );

  const gridApps: PhoneApp[] = useMemo(
    () => [
      { label: 'Descobrir', emoji: '🔍', bg: '#38BDF8', href: '/(app)/(tabs)/explore' },
      { label: 'Postar', emoji: '📸', bg: '#F472B6', href: '/(app)/(tabs)/create' },
      { label: 'Rolês', emoji: '🎉', bg: '#A78BFA', href: '/(app)/(tabs)/meetups' },
      { label: 'Carteirinha', emoji: '🪪', bg: '#22D3EE', href: `/(app)/pet/${pid}/id-card` },
      { label: 'Galeria', emoji: '🖼️', bg: '#FBBF24', href: `/(app)/pet/${pid}/gallery` },
      { label: 'Diário', emoji: '📔', bg: '#C084FC', href: `/(app)/pet/${pid}/diary` },
      { label: 'Lugares', emoji: '📍', bg: '#FB7185', href: '/(app)/places' },
      { label: 'Agenda', emoji: '🗓️', bg: '#2DD4BF', href: '/(app)/agenda' },
      { label: 'Conquistas', emoji: '🏆', bg: '#F59E0B', href: '/(app)/achievements' },
      { label: 'Atividade', emoji: '🔔', bg: '#F87171', href: '/(app)/notifications' },
      { label: 'Achados', emoji: '🦴', bg: '#FCD34D', href: '/(app)/lost-found' },
      { label: 'Pet Pro', emoji: '⭐', bg: '#FBBF24', href: '/(app)/pro' },
    ],
    [pid],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: wp.to, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (pets.length === 0) return <Redirect href="/(app)/onboarding" />;
  if (!activePet) return null;

  const phoneW = Math.min(width, 420);
  const iconSize = Math.round(phoneW * 0.155);
  const cellW = Math.floor((phoneW - 36) / 4); // 4 colunas (igual iOS)

  return (
    <View style={{ flex: 1, backgroundColor: wp.to }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Papel de parede em gradiente (tela inteira) */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="wp-bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={wp.from} />
            <Stop offset="1" stopColor={wp.to} />
          </SvgGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#wp-bg)" />
      </Svg>

      {/* Coluna largura-de-telefone, centralizada */}
      <View style={{ flex: 1, width: phoneW, alignSelf: 'center' }}>
        {/* STATUS BAR */}
        <View
          style={{
            height: 46,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingBottom: 6,
          }}
        >
          <Text style={[{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }, LABEL_SHADOW]}>
            {format(now, 'HH:mm')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="cellular" size={16} color="#fff" />
            <Ionicons name="wifi" size={16} color="#fff" />
            <Ionicons name="battery-full" size={26} color="#fff" />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {/* WIDGET do pet */}
          <Link href={`/(app)/pet/${pid}` as never} asChild>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderColor: 'rgba(255,255,255,0.28)',
                borderWidth: 1,
                borderRadius: 22,
                padding: 14,
                marginBottom: 14,
              }}
            >
              <PetAvatar pet={activePet} size={54} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[{ fontFamily: FONTS.bodyBold, fontSize: 18, color: '#fff' }, LABEL_SHADOW]}>
                  {activePet.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.88)' }, LABEL_SHADOW]}
                >
                  {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </Link>

          {/* Troca de pet (se +1) — rolagem horizontal */}
          {pets.length > 1 ? (
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.14)',
                borderRadius: 18,
                paddingVertical: 10,
                marginBottom: 16,
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 12, alignItems: 'center' }}
              >
                {pets.map((p) => (
                  <Pressable key={p.id} onPress={() => setActivePet(p.id)} accessibilityLabel={`Trocar pra ${p.name}`}>
                    <PetAvatar pet={p} size={36} ring={p.id === activePet.id} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* GRADE de apps — 4 colunas */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 20 }}>
            {gridApps.map((app) => (
              <AppIcon key={app.label} app={app} iconSize={iconSize} cellWidth={cellW} />
            ))}
          </View>

          <View style={{ flex: 1, minHeight: 12 }} />

          {/* Pílula de busca (Spotlight) */}
          <Link href={'/(app)/(tabs)/explore' as never} asChild>
            <Pressable
              style={{
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'rgba(255,255,255,0.22)',
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 8,
                marginTop: 12,
              }}
            >
              <Ionicons name="search" size={15} color="#fff" />
              <Text style={[{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#fff' }, LABEL_SHADOW]}>Buscar</Text>
            </Pressable>
          </Link>
        </ScrollView>

        {/* DOCK */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 16, paddingTop: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-around',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.20)',
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 1,
              borderRadius: 34,
              paddingVertical: 12,
              paddingHorizontal: 6,
            }}
          >
            {dockApps.map((app) => (
              <AppIcon key={app.label} app={app} iconSize={iconSize} hideLabel />
            ))}
          </View>
        </View>
      </View>

      {/* Botão papel de parede */}
      <Pressable
        onPress={() => setShowWallpapers((s) => !s)}
        accessibilityLabel="Trocar papel de parede"
        style={{
          position: 'absolute',
          top: 52,
          right: 14,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: 'rgba(0,0,0,0.22)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 16 }}>🎨</Text>
      </Pressable>

      {/* Seletor de papel de parede */}
      {showWallpapers ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            paddingBottom: 24,
          }}
        >
          <View
            style={{
              width: phoneW - 24,
              backgroundColor: 'rgba(20,20,22,0.82)',
              borderRadius: 24,
              padding: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>Papel de parede</Text>
              <Pressable onPress={() => setShowWallpapers(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {WALLPAPERS.map((w) => (
                <GradientSwatch key={w.id} wp={w} selected={w.id === wallpaperId} onPress={() => pickWallpaper(w.id)} />
              ))}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
