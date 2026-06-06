import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Redirect, Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
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
import { haptic } from '@/lib/haptics';
import { computeHealthScore } from '@/lib/health-score';
import {
  fetchHealthSummary,
  fetchParasiteSummary,
  fetchUnreadMessageCount,
  fetchUnreadNotificationCount,
  qk,
} from '@/lib/queries';
import type { Pet } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

/** Só mostra a tela de bloqueio uma vez por sessão (não re-trava ao voltar dos apps). */
let sessionUnlocked = false;

/** Papéis de parede estilo iPhone (gradiente vertical). Texto sempre branco + sombra. */
const WALLPAPERS = [
  { id: 'gold', from: '#FBC687', to: '#F58A6F' },
  { id: 'coral', from: '#FF9A9E', to: '#F6416C' },
  { id: 'sunset', from: '#FA709A', to: '#FEC163' },
  { id: 'ocean', from: '#4FACFE', to: '#1D63EA' },
  { id: 'grape', from: '#A18CD1', to: '#C86DD7' },
  { id: 'mint', from: '#43E97B', to: '#1BAE8E' },
  { id: 'sky', from: '#5EE7DF', to: '#7873F5' },
  { id: 'rose', from: '#F4C4F3', to: '#FC67FA' },
  { id: 'forest', from: '#2AF598', to: '#009EFD' },
  { id: 'cosmos', from: '#7028E4', to: '#0B0B45' },
  { id: 'peach', from: '#FFD3A5', to: '#FD6585' },
  { id: 'night', from: '#3A6073', to: '#16222A' },
  { id: 'noir', from: '#41444B', to: '#101114' },
  { id: 'mono', from: '#43464B', to: '#1C1C1E' },
];
const DEFAULT_WP = WALLPAPERS[0];

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

type WallpaperDef = { id: string; from: string; to: string };

interface OpeningTile {
  x: number;
  y: number;
  size: number;
  bg: string;
  emoji: string;
  href: string;
}

function isPhoto(uri: string | null | undefined): uri is string {
  return !!uri && /^https?:\/\//.test(uri);
}

/** Fundo: gradiente (svg) ou foto do pet (com escurecida pra legibilidade). */
function Wallpaper({
  wp,
  width,
  height,
  photoUri,
  idSuffix,
}: {
  wp: WallpaperDef;
  width: number;
  height: number;
  photoUri?: string | null;
  idSuffix: string;
}) {
  if (wp.id === 'pet-photo' && isPhoto(photoUri)) {
    return (
      <View style={StyleSheet.absoluteFill}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={`scrim-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity={0.5} />
              <Stop offset="0.45" stopColor="#000" stopOpacity={0.12} />
              <Stop offset="1" stopColor="#000" stopOpacity={0.55} />
            </SvgGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#scrim-${idSuffix})`} />
        </Svg>
      </View>
    );
  }
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgGradient id={`wp-${idSuffix}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={wp.from} />
          <Stop offset="1" stopColor={wp.to} />
        </SvgGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#wp-${idSuffix})`} />
    </Svg>
  );
}

/** Bateria da barra de status = score de saúde do pet (gracinha). */
function BatteryGlyph({ score }: { score: number | null }) {
  const pct = score == null ? 1 : Math.max(0.06, Math.min(1, score / 100));
  const fill = score == null ? '#fff' : score >= 70 ? '#34C759' : score >= 40 ? '#FFD60A' : '#FF453A';
  const innerW = 17;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {score != null ? (
        <Text style={[{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }, LABEL_SHADOW]}>{score}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 24,
            height: 12,
            borderRadius: 3,
            borderWidth: 1.5,
            borderColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 1.5,
            justifyContent: 'center',
          }}
        >
          <View style={{ width: innerW * pct, height: 6, borderRadius: 1.5, backgroundColor: fill }} />
        </View>
        <View
          style={{ width: 2, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.9)', marginLeft: 1 }}
        />
      </View>
    </View>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        top: -5,
        right: -5,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 5,
        borderRadius: 10,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.92)',
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff' }}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

function AppIcon({
  app,
  iconSize,
  cellWidth,
  badge,
  hideLabel,
  onActivate,
}: {
  app: PhoneApp;
  iconSize: number;
  cellWidth?: number;
  badge?: number;
  hideLabel?: boolean;
  onActivate: (info: OpeningTile | null, app: PhoneApp) => void;
}) {
  const ref = useRef<View>(null);
  const [pressed, setPressed] = useState(false);
  const w = cellWidth ?? iconSize;

  const activate = () => {
    haptic.light();
    const node = ref.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, mw) => {
        if (mw > 0) onActivate({ x, y, size: mw, bg: app.bg, emoji: app.emoji, href: app.href }, app);
        else onActivate(null, app);
      });
    } else {
      onActivate(null, app);
    }
  };

  return (
    <Pressable
      onPress={activate}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={app.label}
      style={{ width: w, alignItems: 'center' }}
    >
      <View
        ref={ref}
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: iconSize * 0.2237,
          backgroundColor: app.bg,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.88 : 1 }],
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        }}
      >
        <Text style={{ fontSize: iconSize * 0.46 }}>{app.emoji}</Text>
        {badge && badge > 0 ? <Badge count={badge} /> : null}
      </View>
      {!hideLabel ? (
        <Text
          numberOfLines={1}
          style={[
            { fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: '#fff', marginTop: 6, maxWidth: w - 2, textAlign: 'center' },
            LABEL_SHADOW,
          ]}
        >
          {app.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Tela de bloqueio: deslize pra cima (ou toque na seta) pra abrir a home. */
function LockScreen({
  wp,
  width,
  height,
  photoUri,
  pet,
  notice,
  onUnlock,
}: {
  wp: WallpaperDef;
  width: number;
  height: number;
  photoUri?: string | null;
  pet: Pet;
  notice: string | null;
  onUnlock: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const translateY = useRef(new Animated.Value(0)).current;
  const triggerUnlock = () =>
    Animated.timing(translateY, { toValue: -height, duration: 240, useNativeDriver: false }).start(() => onUnlock());

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -80 || g.vy < -0.4) triggerUnlock();
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: false, bounciness: 6 }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      {...pan.panHandlers}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        transform: [{ translateY }],
        userSelect: 'none',
      }}
    >
      <Wallpaper wp={wp} width={width} height={height} photoUri={photoUri} idSuffix="lock" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.12)' }]} pointerEvents="none" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingTop: 64, paddingBottom: 40 }}>
        {/* topo: cadeado + relógio */}
        <View style={{ alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.9)" style={{ marginBottom: 8 }} />
          <Text style={[{ fontFamily: FONTS.display, fontSize: 76, color: '#fff', lineHeight: 82 }, LABEL_SHADOW]}>
            {format(now, 'HH:mm')}
          </Text>
          <Text style={[{ fontFamily: FONTS.bodyMedium, fontSize: 16, color: '#fff' }, LABEL_SHADOW]}>
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </Text>
        </View>

        {/* meio: pet + notificação */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <PetAvatar pet={pet} size={96} ring />
          <Text style={[{ fontFamily: FONTS.display, fontSize: 26, color: '#fff' }, LABEL_SHADOW]}>{pet.name}</Text>
          {notice ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 16,
              }}
            >
              <Text style={[{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: '#fff' }, LABEL_SHADOW]}>{notice}</Text>
            </View>
          ) : null}
        </View>

        {/* base: deslizar pra abrir */}
        <Pressable onPress={triggerUnlock} accessibilityLabel="Abrir" style={{ alignItems: 'center', gap: 10 }}>
          <Ionicons name="chevron-up" size={24} color="rgba(255,255,255,0.9)" />
          <Text style={[{ fontFamily: FONTS.bodyMedium, fontSize: 14, color: 'rgba(255,255,255,0.92)' }, LABEL_SHADOW]}>
            deslize para abrir
          </Text>
          <View style={{ width: 130, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.7)' }} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function PetPhoneScreen() {
  const { pets, activePet, setActivePet, loading } = useActivePet();
  const { session } = useSession();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const userId = session?.user.id;
  const pid = activePet?.id ?? '';
  const photoUri = activePet?.avatar_url ?? null;

  const wallpaperKey = userId ? `petsocial:phone-wallpaper:${userId}` : null;
  const [wallpaperId, setWallpaperId] = useState('gold');
  const [showWallpapers, setShowWallpapers] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [locked, setLocked] = useState(() => !sessionUnlocked);
  const [openingTile, setOpeningTile] = useState<OpeningTile | null>(null);
  const tileAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!wallpaperKey) return;
    AsyncStorage.getItem(wallpaperKey)
      .then((v) => {
        if (v && (v === 'pet-photo' || WALLPAPERS.some((w) => w.id === v))) setWallpaperId(v);
      })
      .catch(() => {});
  }, [wallpaperKey]);

  // Badges + score (cache compartilhado com o resto do app)
  const unreadMsgQuery = useQuery({
    queryKey: userId ? qk.unreadMessages(userId) : ['unread-messages', 'anon'],
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
  const unreadNotifQuery = useQuery({
    queryKey: userId ? qk.unreadCount(userId) : ['unread-count', 'anon'],
    queryFn: () => fetchUnreadNotificationCount(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  });
  const summaryQuery = useQuery({
    queryKey: qk.healthSummary(pid),
    queryFn: () => fetchHealthSummary(pid),
    enabled: !!pid,
  });
  const parasiteQuery = useQuery({
    queryKey: qk.parasiteSummary(pid),
    queryFn: () => fetchParasiteSummary(pid),
    enabled: !!pid,
  });

  const pickWallpaper = (id: string) => {
    setWallpaperId(id);
    if (wallpaperKey) AsyncStorage.setItem(wallpaperKey, id).catch(() => {});
  };

  const handleActivate = (info: OpeningTile | null, app: PhoneApp) => {
    if (!info) {
      router.push(app.href as never);
      return;
    }
    setOpeningTile(info);
    tileAnim.setValue(0);
    Animated.timing(tileAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(() => {
      router.push(app.href as never);
      setTimeout(() => setOpeningTile(null), 80);
    });
  };

  const wp: WallpaperDef =
    wallpaperId === 'pet-photo'
      ? { id: 'pet-photo', from: DEFAULT_WP.from, to: DEFAULT_WP.to }
      : WALLPAPERS.find((w) => w.id === wallpaperId) ?? DEFAULT_WP;

  const summary = summaryQuery.data;
  const parasite = parasiteQuery.data;
  const computedScore = summary ? computeHealthScore(summary, parasite) : null;
  const hasHealthData = computedScore?.components.some((c) => c.status !== 'na') ?? false;
  const batteryScore = hasHealthData && computedScore ? computedScore.score : null;
  const healthAlerts = computedScore
    ? computedScore.components.filter((c) => c.status === 'warn' || c.status === 'bad').length
    : 0;
  const unreadMsg = unreadMsgQuery.data ?? 0;
  const unreadNotif = unreadNotifQuery.data ?? 0;

  const badges: Record<string, number> = {
    Chat: unreadMsg,
    Atividade: unreadNotif,
    Saúde: healthAlerts,
  };

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const greetEmoji = hour < 12 ? '🌤️' : hour < 18 ? '☀️' : '🌙';

  const notice =
    healthAlerts > 0
      ? `🩺 ${healthAlerts} lembrete${healthAlerts > 1 ? 's' : ''} de saúde`
      : unreadMsg > 0
        ? `💬 ${unreadMsg} mensagem${unreadMsg > 1 ? 'ns' : ''} nova${unreadMsg > 1 ? 's' : ''}`
        : unreadNotif > 0
          ? `🔔 ${unreadNotif} novidade${unreadNotif > 1 ? 's' : ''}`
          : null;
  const widgetLine = notice ?? format(now, "EEEE, d 'de' MMMM", { locale: ptBR });

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
  const cellW = Math.floor((phoneW - 36) / 4);
  const hasPetPhoto = isPhoto(photoUri);

  const unlock = () => {
    sessionUnlocked = true;
    setLocked(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: wp.to }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Papel de parede */}
      <Wallpaper wp={wp} width={width} height={height} photoUri={photoUri} idSuffix="home" />

      {/* Coluna largura-de-telefone */}
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
            <BatteryGlyph score={batteryScore} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {/* WIDGET do pet */}
          <Pressable
            onPress={() => router.push(`/(app)/pet/${pid}` as never)}
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
            <PetAvatar pet={activePet} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={[{ fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }, LABEL_SHADOW]}>
                {greeting} {greetEmoji}
              </Text>
              <Text numberOfLines={1} style={[{ fontFamily: FONTS.bodyBold, fontSize: 19, color: '#fff' }, LABEL_SHADOW]}>
                {activePet.name}
              </Text>
              <Text numberOfLines={1} style={[{ fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.88)' }, LABEL_SHADOW]}>
                {widgetLine}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
          </Pressable>

          {/* Troca de pet (rolagem horizontal) */}
          {pets.length > 1 ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, paddingVertical: 10, marginBottom: 16 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingHorizontal: 12, alignItems: 'center' }}
              >
                {pets.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      haptic.light();
                      setActivePet(p.id);
                    }}
                    accessibilityLabel={`Trocar pra ${p.name}`}
                  >
                    <PetAvatar pet={p} size={36} ring={p.id === activePet.id} />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* GRADE — 4 colunas */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 20 }}>
            {gridApps.map((app) => (
              <AppIcon
                key={app.label}
                app={app}
                iconSize={iconSize}
                cellWidth={cellW}
                badge={badges[app.label]}
                onActivate={handleActivate}
              />
            ))}
          </View>

          <View style={{ flex: 1, minHeight: 12 }} />

          {/* Pílula de busca */}
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/explore' as never)}
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
              <AppIcon key={app.label} app={app} iconSize={iconSize} badge={badges[app.label]} hideLabel onActivate={handleActivate} />
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

      {/* Animação de abrir app (zoom do ícone) */}
      {openingTile ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: tileAnim.interpolate({ inputRange: [0, 1], outputRange: [openingTile.x, 0] }),
            top: tileAnim.interpolate({ inputRange: [0, 1], outputRange: [openingTile.y, 0] }),
            width: tileAnim.interpolate({ inputRange: [0, 1], outputRange: [openingTile.size, width] }),
            height: tileAnim.interpolate({ inputRange: [0, 1], outputRange: [openingTile.size, height] }),
            borderRadius: tileAnim.interpolate({ inputRange: [0, 1], outputRange: [openingTile.size * 0.2237, 0] }),
            backgroundColor: openingTile.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.Text
            style={{
              fontSize: openingTile.size * 0.46,
              opacity: tileAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] }),
            }}
          >
            {openingTile.emoji}
          </Animated.Text>
        </Animated.View>
      ) : null}

      {/* Seletor de papel de parede */}
      {showWallpapers ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: 24 }}>
          <View style={{ width: phoneW - 24, backgroundColor: 'rgba(18,18,20,0.92)', borderRadius: 24, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>Papel de parede</Text>
              <Pressable onPress={() => setShowWallpapers(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
              {/* Foto do pet */}
              {hasPetPhoto ? (
                <Pressable
                  onPress={() => pickWallpaper('pet-photo')}
                  accessibilityLabel="Foto do pet"
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    overflow: 'hidden',
                    borderWidth: wallpaperId === 'pet-photo' ? 3 : 1,
                    borderColor: wallpaperId === 'pet-photo' ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <Image source={{ uri: photoUri! }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                </Pressable>
              ) : null}
              {WALLPAPERS.map((w) => (
                <Pressable
                  key={w.id}
                  onPress={() => pickWallpaper(w.id)}
                  accessibilityLabel={`Papel ${w.id}`}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    overflow: 'hidden',
                    borderWidth: w.id === wallpaperId ? 3 : 1,
                    borderColor: w.id === wallpaperId ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  <Svg width={46} height={46}>
                    <Defs>
                      <SvgGradient id={`sw-${w.id}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={w.from} />
                        <Stop offset="1" stopColor={w.to} />
                      </SvgGradient>
                    </Defs>
                    <Rect width={46} height={46} fill={`url(#sw-${w.id})`} />
                  </Svg>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {/* TELA DE BLOQUEIO (por cima de tudo) */}
      {locked ? (
        <LockScreen
          wp={wp}
          width={width}
          height={height}
          photoUri={photoUri}
          pet={activePet}
          notice={notice}
          onUnlock={unlock}
        />
      ) : null}
    </View>
  );
}
