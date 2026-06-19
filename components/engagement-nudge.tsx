import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { todayChallenge } from '@/lib/daily-challenge';
import { FONTS } from '@/lib/fonts';
import { DIFF_META, GAME_META, fetchDailyMyResult, fetchStreak, qkGames } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { fetchArticles, qkNews } from '@/lib/news';
import { fetchHealthSummary, fetchPetStats, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const GAP_MS = 3 * 60 * 60 * 1000; // mostra no máx. 1 nudge a cada 3h
const LAST_KEY = 'petsocial:nudge-last';
const DISMISS_PREFIX = 'petsocial:nudge-dismiss:';

interface Nudge {
  key: string;
  emoji: string;
  text: string;
  cta: string;
  href: Href;
  color: string;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Aviso in-app "chamativo" que traz o tutor de volta — mas sempre com conteúdo
 * REAL e útil (streak em risco, desafio do dia, matéria nova), claramente parte
 * do site (card no topo do feed), nunca disfarçado de notificação do sistema.
 * Aparece com um leve atraso (como um aviso "pipocando"), no máximo 1 a cada 3h,
 * e respeita o "dispensar" por aviso. Toca → leva pra ação.
 */
export function EngagementNudge() {
  const { session } = useSession();
  const { theme } = useTheme();
  const { activePet } = useActivePet();
  const router = useRouter();
  const userId = session?.user.id;

  const today = useMemo(() => todayChallenge(), []);
  const [visible, setVisible] = useState(false);
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const anim = useRef(new Animated.Value(0)).current;

  const streakQ = useQuery({ queryKey: qkGames.streak(), queryFn: fetchStreak, enabled: !!userId });
  const dailyQ = useQuery({
    queryKey: qkGames.dailyMyResult(today.game, today.difficulty),
    queryFn: () => fetchDailyMyResult(today.game, today.difficulty),
    enabled: !!userId,
  });
  const newsQ = useQuery({ queryKey: qkNews.articles(), queryFn: () => fetchArticles({ limit: 1 }) });
  const healthQ = useQuery({
    queryKey: activePet ? qk.healthSummary(activePet.id) : ['health-summary', 'none'],
    queryFn: () => fetchHealthSummary(activePet!.id),
    enabled: !!userId && !!activePet,
    staleTime: 5 * 60_000,
  });
  const statsQ = useQuery({
    queryKey: activePet ? qk.petStats(activePet.id) : ['pet-stats', 'none'],
    queryFn: () => fetchPetStats(activePet!.id),
    enabled: !!userId && !!activePet,
    staleTime: 5 * 60_000,
  });

  // monta o nudge de maior prioridade a partir de dados reais
  const candidate = useMemo<Nudge | null>(() => {
    const ds = todayStr();
    const streak = streakQ.data;
    if (streak && streak.current_streak >= 1 && !streak.played_today) {
      return {
        key: `streak:${ds}`,
        emoji: '🔥',
        text: `Seu streak de ${streak.current_streak} ${streak.current_streak === 1 ? 'dia' : 'dias'} tá em risco! Jogue 1 partida hoje pra não zerar.`,
        cta: 'Manter streak',
        href: '/(app)/games',
        color: '#F97316',
      };
    }
    const daily = dailyQ.data;
    if (daily && !daily.played) {
      const m = GAME_META[today.game];
      const d = DIFF_META[today.difficulty];
      return {
        key: `daily:${today.dateStr}`,
        emoji: '🎯',
        text: `Desafio de hoje: ${m.emoji} ${m.label} no ${d.emoji} ${d.label}. Topa o desafio?`,
        cta: 'Jogar desafio',
        href: '/(app)/games',
        color: '#F472B6',
      };
    }
    const article = newsQ.data?.[0];
    if (article?.published_at) {
      const ageH = (Date.now() - new Date(article.published_at).getTime()) / 3_600_000;
      if (ageH <= 48) {
        return {
          key: `news:${article.id}`,
          emoji: '📰',
          text: `Nova na Redação: ${article.title}`,
          cta: 'Ler agora',
          href: { pathname: '/(app)/news/[slug]', params: { slug: article.slug } },
          color: '#EC4899',
        };
      }
    }
    // Nudges de estágio (onboarding) — só pra contas "vazias", baixa prioridade
    if (activePet && healthQ.data && healthQ.data.vaccinations_count === 0) {
      return {
        key: `health:${activePet.id}`,
        emoji: '💉',
        text: `${activePet.name} ainda não tem vacina registrada. Comece o histórico de saúde, leva 30s.`,
        cta: 'Registrar vacina',
        href: { pathname: '/(app)/pet/[id]/vaccinations', params: { id: activePet.id } },
        color: '#0F766E',
      };
    }
    if (activePet && statsQ.data && statsQ.data.followers_count === 0) {
      return {
        key: `followers:${ds}`,
        emoji: '👋',
        text: `${activePet.name} ainda não tem seguidores. Siga outros pets pra começar a interagir!`,
        cta: 'Descobrir pets',
        href: '/(app)/(tabs)/explore',
        color: '#6D28D9',
      };
    }
    return null;
  }, [streakQ.data, dailyQ.data, newsQ.data, healthQ.data, statsQ.data, activePet, today]);

  // decide se mostra (gap de 3h + não dispensado), com atraso pra "pipocar"
  useEffect(() => {
    if (!userId || !candidate || visible) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [lastRaw, dismissed] = await Promise.all([
          AsyncStorage.getItem(LAST_KEY),
          AsyncStorage.getItem(DISMISS_PREFIX + candidate.key),
        ]);
        if (cancelled || dismissed) return;
        const last = lastRaw ? parseInt(lastRaw, 10) : 0;
        if (Date.now() - last < GAP_MS) return;
        await AsyncStorage.setItem(LAST_KEY, String(Date.now()));
        if (cancelled) return;
        setNudge(candidate);
        setVisible(true);
        haptic.light();
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
      } catch {
        // silencioso
      }
    }, 1800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, candidate, visible, anim]);

  const close = (dismiss: boolean) => {
    if (dismiss && nudge) AsyncStorage.setItem(DISMISS_PREFIX + nudge.key, '1').catch(() => {});
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => setVisible(false));
  };

  if (!visible || !nudge) return null;

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
        marginHorizontal: 12,
        marginTop: 10,
      }}
    >
      <Pressable
        onPress={() => {
          haptic.light();
          close(true);
          router.push(nudge.href);
        }}
        accessibilityRole="button"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderLeftWidth: 4,
          borderLeftColor: nudge.color,
          borderWidth: 1,
          borderColor: theme.borderLight,
          paddingVertical: 12,
          paddingLeft: 12,
          paddingRight: 8,
          shadowColor: theme.shadow,
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: `${nudge.color}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22 }}>{nudge.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: theme.text, lineHeight: 18 }}>
            {nudge.text}
          </Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: nudge.color, marginTop: 2 }}>
            {nudge.cta} →
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            close(true);
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dispensar aviso"
          style={{ padding: 6 }}
        >
          <Ionicons name="close" size={18} color={theme.textDim} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
