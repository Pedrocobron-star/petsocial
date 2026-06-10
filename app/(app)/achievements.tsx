import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { Confetti } from '@/components/confetti';
import { copyToClipboard } from '@/lib/clipboard';
import {
  computeAchievements,
  tierColors,
  type AchievementUnlockState,
} from '@/lib/achievements';
import { FONTS } from '@/lib/fonts';
import { showLocalNotification } from '@/lib/local-notify';
import { fetchAchievementInput, qk } from '@/lib/queries';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type TierFilter = 'all' | 1 | 2 | 3;

const TIER_PILLS: { value: TierFilter; label: string; emoji: string }[] = [
  { value: 'all', label: 'Todas', emoji: '🏆' },
  { value: 1, label: 'Bronze', emoji: '🥉' },
  { value: 2, label: 'Prata', emoji: '🥈' },
  { value: 3, label: 'Ouro', emoji: '🥇' },
];

const SEEN_KEY = 'petsocial:achievements-seen';

export default function AchievementsScreen() {
  return (
    <AppThemeProvider app="achievements">
      <AchievementsInner />
    </AppThemeProvider>
  );
}

function AchievementsInner() {
  const { theme } = useTheme();
  const { session } = useSession();
  const userId = session?.user.id;
  const toast = useToast();

  const query = useQuery({
    queryKey: userId ? qk.achievements(userId) : ['achievements', 'anon'],
    queryFn: () => fetchAchievementInput(userId!),
    enabled: !!userId,
  });

  const achievements = useMemo(
    () => (query.data ? computeAchievements(query.data) : []),
    [query.data],
  );
  const unlocked = achievements.filter((a) => a.unlocked);
  const locked = achievements.filter((a) => !a.unlocked);

  // Conquista mais próxima de desbloquear (maior % de progresso)
  const nextUp = useMemo(() => {
    const withProgress = locked.filter((a) => a.progress && a.progress.target > 0);
    if (withProgress.length === 0) return null;
    return withProgress.reduce((best, curr) => {
      const bestPct = best.progress!.current / best.progress!.target;
      const currPct = curr.progress!.current / curr.progress!.target;
      return currPct > bestPct ? curr : best;
    });
  }, [locked]);

  // Filtro por tier
  const [tier, setTier] = useState<TierFilter>('all');
  const filterByTier = (list: AchievementUnlockState[]) =>
    tier === 'all' ? list : list.filter((a) => a.def.tier === tier);
  const filteredUnlocked = filterByTier(unlocked);
  const filteredLocked = filterByTier(locked);

  // Confetti só em NEW unlock — compara IDs visto antes vs agora
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  useEffect(() => {
    if (!userId || unlocked.length === 0) return;
    const currentIds = unlocked.map((a) => a.def.id).sort().join(',');
    const key = `${SEEN_KEY}:${userId}`;
    AsyncStorage.getItem(key).then((seen) => {
      if (seen !== currentIds) {
        // Tem ID novo (primeiro acesso ou desbloqueou) → celebra
        if (seen !== null) {
          // Não é primeiro acesso, então é unlock de fato
          setConfettiKey(Date.now());
          // Avisa as conquistas NOVAS (toast + notificação local)
          const seenSet = new Set(seen.split(',').filter(Boolean));
          const fresh = unlocked.filter((a) => !seenSet.has(a.def.id));
          if (fresh.length > 0) {
            const a = fresh[0];
            const extra = fresh.length > 1 ? ` +${fresh.length - 1}` : '';
            toast.success(`${a.def.emoji} Conquista desbloqueada!`, `${a.def.title}${extra}`);
            showLocalNotification(
              `${a.def.emoji} Conquista desbloqueada!`,
              `${a.def.title}${extra}`,
              '/achievements',
            );
          }
        }
        AsyncStorage.setItem(key, currentIds);
      }
    });
  }, [userId, unlocked, toast]);

  // Progresso geral
  const progressPct = achievements.length > 0
    ? Math.round((unlocked.length / achievements.length) * 100)
    : 0;

  return (
    <ScrollView className="flex-1 bg-neutral-50" contentContainerClassName="pb-12">
      <Stack.Screen options={{ title: 'Conquistas' }} />
      {confettiKey !== null ? <Confetti trigger={confettiKey} count={60} /> : null}

      <AreaHero area="achievements" />

      {/* Resumo — count + barra */}
      <View className="bg-white px-4 py-5">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: '#1A1410' }}>
              {unlocked.length} / {achievements.length}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#737373' }}>
              {progressPct === 100
                ? 'Tudo desbloqueado! Você é lenda 🎉'
                : unlocked.length === 0
                ? 'Use o app pra desbloquear conquistas'
                : `${progressPct}% completo · continua que tem mais`}
            </Text>
          </View>
        </View>

        {/* Barra de progresso geral */}
        <View
          style={{
            marginTop: 16,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#F5F5F5',
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${progressPct}%`,
              height: '100%',
              backgroundColor: theme.accent.color,
              borderRadius: 4,
            }}
          />
        </View>
      </View>

      {/* Próxima a desbloquear — destaque emocional */}
      {nextUp ? (
        <View className="mt-4 px-4">
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.accent.color,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Próxima a desbloquear
          </Text>
          <NextUpCard state={nextUp} />
        </View>
      ) : null}

      {/* Filtros de tier */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginTop: 18 }}>
        {TIER_PILLS.map((p) => {
          const active = tier === p.value;
          const count =
            p.value === 'all'
              ? achievements.length
              : achievements.filter((a) => a.def.tier === p.value).length;
          return (
            <Pressable
              key={String(p.value)}
              onPress={() => setTier(p.value)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: active ? theme.accent.color : '#FFFFFF',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 4,
                borderWidth: 1,
                borderColor: active ? theme.accent.color : '#E5E5E5',
              }}
            >
              <Text style={{ fontSize: 12 }}>{p.emoji}</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  color: active ? theme.accent.onAccent : '#404040',
                }}
              >
                {p.label} {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filteredUnlocked.length > 0 ? (
        <View className="mt-4 px-4">
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: '#16A34A',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            ✓ Desbloqueadas
          </Text>
          <View className="gap-2">
            {filteredUnlocked.map((a) => (
              <AchievementCard
                key={a.def.id}
                state={a}
                onShare={async () => {
                  const text = `🏆 Acabei de desbloquear "${a.def.title}" no Maestro Pet!\n${a.def.description}`;
                  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
                    try {
                      await navigator.share({ title: a.def.title, text });
                      return;
                    } catch {}
                  }
                  const ok = await copyToClipboard(text);
                  if (ok) toast.success('Copiado!', 'Cola onde quiser pra compartilhar.');
                }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {filteredLocked.length > 0 ? (
        <View className="mt-6 px-4">
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: '#737373',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            🔒 Em progresso
          </Text>
          <View className="gap-2">
            {filteredLocked.map((a) => (
              <AchievementCard key={a.def.id} state={a} />
            ))}
          </View>
        </View>
      ) : null}

      {filteredUnlocked.length === 0 && filteredLocked.length === 0 ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <Text style={{ fontSize: 40, marginBottom: 8 }}>🔍</Text>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#404040' }}>
            Nada nesse filtro
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Card especial pra "próxima a desbloquear" — visualmente destacado. */
function NextUpCard({ state }: { state: AchievementUnlockState }) {
  const colors = tierColors(state.def.tier);
  const pct = state.progress ? (state.progress.current / state.progress.target) * 100 : 0;
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1.5,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View
        style={{
          width: 60,
          height: 60,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 32 }}>{state.def.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: colors.text }}>
          {state.def.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: colors.text, opacity: 0.85, marginTop: 2 }}>
          {state.def.description}
        </Text>
        {state.progress ? (
          <View style={{ marginTop: 8 }}>
            <View
              style={{
                height: 6,
                backgroundColor: '#FFFFFF',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  backgroundColor: colors.border,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                color: colors.text,
                marginTop: 4,
              }}
            >
              {state.progress.current} / {state.progress.target} ·{' '}
              {Math.round(pct)}%
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function AchievementCard({
  state,
  onShare,
}: {
  state: AchievementUnlockState;
  onShare?: () => void;
}) {
  const { theme } = useTheme();
  const colors = tierColors(state.def.tier);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        opacity: state.unlocked ? 1 : 0.7,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: state.unlocked ? colors.bg : '#F5F5F5',
          borderWidth: state.unlocked ? 1.5 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 26, opacity: state.unlocked ? 1 : 0.45 }}>{state.def.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 14,
            color: state.unlocked ? '#1A1410' : '#525252',
          }}
        >
          {state.def.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373', marginTop: 2 }}>
          {state.def.description}
        </Text>
        {!state.unlocked && state.progress ? (
          <View style={{ marginTop: 6 }}>
            <View
              style={{
                height: 4,
                backgroundColor: '#F5F5F5',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(state.progress.current / state.progress.target) * 100}%`,
                  backgroundColor: theme.accent.color,
                }}
              />
            </View>
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 10, color: '#737373', marginTop: 2 }}>
              {state.progress.current} / {state.progress.target}
            </Text>
          </View>
        ) : null}
      </View>
      {state.unlocked ? (
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <View
            style={{
              backgroundColor: colors.bg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: colors.text }}>
              {state.def.tier === 3 ? 'OURO' : state.def.tier === 2 ? 'PRATA' : 'BRONZE'}
            </Text>
          </View>
          {onShare ? (
            <Pressable onPress={onShare} hitSlop={6}>
              <Ionicons name="share-outline" size={16} color="#737373" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
