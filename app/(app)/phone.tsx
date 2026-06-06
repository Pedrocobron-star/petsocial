import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { PetPicker } from '@/components/pet-picker';
import { FONTS } from '@/lib/fonts';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const SCREEN_W = Dimensions.get('window').width;

/** Papéis de parede (presets). `dark` indica texto claro por cima. */
const WALLPAPERS: { color: string; dark: boolean }[] = [
  { color: '#FDE68A', dark: false },
  { color: '#FCA5A5', dark: false },
  { color: '#A7F3D0', dark: false },
  { color: '#BFDBFE', dark: false },
  { color: '#FBCFE8', dark: false },
  { color: '#DDD6FE', dark: false },
  { color: '#FED7AA', dark: false },
  { color: '#FB923C', dark: true },
  { color: '#1A1410', dark: true },
  { color: '#0F172A', dark: true },
];

interface PhoneApp {
  label: string;
  emoji: string;
  bg: string;
  href: string;
}

export default function PetPhoneScreen() {
  const { pets, activePet, setActivePet, loading } = useActivePet();
  const { session } = useSession();
  const userId = session?.user.id;

  const wallpaperKey = userId ? `petsocial:phone-wallpaper:${userId}` : null;
  const [wallpaper, setWallpaper] = useState('#FDE68A');
  const [showWallpapers, setShowWallpapers] = useState(false);

  // Relógio (estilo lock screen)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!wallpaperKey) return;
    AsyncStorage.getItem(wallpaperKey)
      .then((v) => {
        if (v) setWallpaper(v);
      })
      .catch(() => {});
  }, [wallpaperKey]);

  const pickWallpaper = (color: string) => {
    setWallpaper(color);
    if (wallpaperKey) AsyncStorage.setItem(wallpaperKey, color).catch(() => {});
  };

  const wpMeta = WALLPAPERS.find((w) => w.color === wallpaper);
  const onDark = wpMeta?.dark ?? false;
  const fg = onDark ? '#fff' : '#1A1410';
  const fgDim = onDark ? 'rgba(255,255,255,0.75)' : 'rgba(26,20,16,0.6)';

  const pid = activePet?.id ?? '';
  const apps: PhoneApp[] = useMemo(
    () => [
      { label: 'Feed', emoji: '🐾', bg: '#FB923C', href: '/(app)/(tabs)' },
      { label: 'Descobrir', emoji: '🔍', bg: '#60A5FA', href: '/(app)/(tabs)/explore' },
      { label: 'Postar', emoji: '📸', bg: '#F472B6', href: '/(app)/(tabs)/create' },
      { label: 'Rolês', emoji: '🎉', bg: '#A78BFA', href: '/(app)/(tabs)/meetups' },
      { label: 'Saúde', emoji: '🩺', bg: '#34D399', href: `/(app)/pet/${pid}/health` },
      { label: 'Carteirinha', emoji: '🪪', bg: '#38BDF8', href: `/(app)/pet/${pid}/id-card` },
      { label: 'Galeria', emoji: '🖼️', bg: '#FBBF24', href: `/(app)/pet/${pid}/gallery` },
      { label: 'Diário', emoji: '📔', bg: '#C084FC', href: `/(app)/pet/${pid}/diary` },
      { label: 'Lugares', emoji: '📍', bg: '#FB7185', href: '/(app)/places' },
      { label: 'Agenda', emoji: '🗓️', bg: '#2DD4BF', href: '/(app)/agenda' },
      { label: 'Conquistas', emoji: '🏆', bg: '#FBBF24', href: '/(app)/achievements' },
      { label: 'Chat', emoji: '💬', bg: '#4ADE80', href: '/(app)/messages' },
      { label: 'Atividade', emoji: '🔔', bg: '#F87171', href: '/(app)/notifications' },
      { label: 'Achados', emoji: '🦴', bg: '#FBBF24', href: '/(app)/lost-found' },
      { label: 'Perfil', emoji: '🐶', bg: '#94A3B8', href: `/(app)/pet/${pid}` },
      { label: 'Pet Pro', emoji: '⭐', bg: '#F59E0B', href: '/(app)/pro' },
    ],
    [pid],
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: wallpaper, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={onDark ? '#fff' : '#F97316'} />
      </View>
    );
  }
  if (pets.length === 0) return <Redirect href="/(app)/onboarding" />;
  if (!activePet) return null;

  const colGap = 14;
  const cols = 4;
  const iconSize = Math.min(72, (Math.min(SCREEN_W, 460) - 32 - colGap * (cols - 1)) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: wallpaper }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* "Lock screen": relógio + pet */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 52, color: fg, lineHeight: 56 }}>
            {format(now, 'HH:mm')}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: fgDim, marginBottom: 14 }}>
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </Text>
          <PetAvatar pet={activePet} size={64} />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 18, color: fg, marginTop: 8 }}>
            Celular d{activePet.name.endsWith('a') ? 'a' : 'o'} {activePet.name}
          </Text>
        </View>

        {/* Troca de pet (quando tem +1) */}
        {pets.length > 1 ? (
          <View style={{ marginHorizontal: -16, marginBottom: 10 }}>
            <PetPicker pets={pets} selectedId={activePet.id} onSelect={setActivePet} />
          </View>
        ) : null}

        {/* Grade de "apps" */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            rowGap: 18,
          }}
        >
          {apps.map((app) => (
            <Link key={app.label} href={app.href as never} asChild>
              <Pressable style={{ width: iconSize, alignItems: 'center' }}>
                <View
                  style={{
                    width: iconSize,
                    height: iconSize,
                    borderRadius: iconSize * 0.26,
                    backgroundColor: app.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.18,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 3,
                  }}
                >
                  <Text style={{ fontSize: iconSize * 0.42 }}>{app.emoji}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: FONTS.bodyMedium,
                    fontSize: 11,
                    color: fg,
                    marginTop: 5,
                    maxWidth: iconSize + 8,
                    textAlign: 'center',
                  }}
                >
                  {app.label}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>

      {/* Botão de papel de parede (canto) */}
      <Pressable
        onPress={() => setShowWallpapers((s) => !s)}
        accessibilityLabel="Trocar papel de parede"
        style={{
          position: 'absolute',
          top: 50,
          right: 16,
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: 'rgba(0,0,0,0.18)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>🎨</Text>
      </Pressable>

      {/* Picker de papel de parede */}
      {showWallpapers ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 28,
            backgroundColor: 'rgba(0,0,0,0.55)',
            borderRadius: 18,
            padding: 14,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff', marginBottom: 10 }}>
            Papel de parede
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {WALLPAPERS.map((w) => (
              <Pressable
                key={w.color}
                onPress={() => pickWallpaper(w.color)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: w.color,
                  borderWidth: wallpaper === w.color ? 3 : 1,
                  borderColor: wallpaper === w.color ? '#fff' : 'rgba(255,255,255,0.3)',
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
