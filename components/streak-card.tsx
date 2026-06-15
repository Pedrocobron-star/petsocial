import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Confetti } from '@/components/confetti';
import { FONTS } from '@/lib/fonts';
import { fetchStreak, qkGames } from '@/lib/games';
import { useSession } from '@/providers/session-provider';

const SEEN_KEY = 'petsocial:streak-seen';

/**
 * Card de retenção estilo Duolingo no topo do hub de jogos:
 * streak diário 🔥 (com urgência quando ainda não jogou hoje) + meta do dia 🎯.
 * Quando o streak sobe (detectado comparando com o último valor visto), celebra
 * com confetti — o gancho de hábito.
 */
export function StreakCard() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { data } = useQuery({
    queryKey: qkGames.streak(),
    queryFn: fetchStreak,
    enabled: !!userId,
  });
  const [celebrate, setCelebrate] = useState(0);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY).then((v) => {
      if (cancelled) return;
      const parsed = v == null ? NaN : parseInt(v, 10);
      const seen = Number.isFinite(parsed) ? parsed : null;
      if (seen != null && data.current_streak > seen && data.played_today) {
        setCelebrate((c) => c + 1);
      }
      if (seen == null || seen !== data.current_streak) {
        AsyncStorage.setItem(SEEN_KEY, String(data.current_streak)).catch(() => {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data]);

  if (!userId || !data) return null;

  const { current_streak, played_today, best_streak, plays_today, daily_goal } = data;
  const goalPct = daily_goal > 0 ? Math.min(1, plays_today / daily_goal) : 0;
  const goalMet = plays_today >= daily_goal;
  const hasStreak = current_streak > 0;
  const urgent = hasStreak && !played_today; // sequência viva mas em risco

  return (
    <>
      <View
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 18,
          padding: 14,
          gap: 12,
          borderWidth: urgent ? 1.5 : 1,
          borderColor: urgent ? '#F97316' : 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Streak */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 34 }}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: '#fff' }}>
              {hasStreak
                ? `${current_streak} ${current_streak === 1 ? 'dia' : 'dias'} seguidos`
                : 'Comece sua sequência!'}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: urgent ? '#FDBA74' : 'rgba(255,255,255,0.6)',
              }}
            >
              {!hasStreak
                ? 'Jogue hoje e comece a contar 🔥'
                : played_today
                  ? `✅ Garantido hoje!${best_streak > current_streak ? ` · recorde: ${best_streak}` : ''}`
                  : 'Jogue hoje pra manter a sequência →'}
            </Text>
          </View>
        </View>

        {/* Meta do dia */}
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                color: goalMet ? '#FBBF24' : 'rgba(255,255,255,0.85)',
              }}
            >
              🎯 Meta de hoje{goalMet ? ' · completa! 🎉' : ''}
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              {Math.min(plays_today, daily_goal)}/{daily_goal} partidas
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              height: 8,
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.10)',
              overflow: 'hidden',
            }}
          >
            <View style={{ flex: goalPct, backgroundColor: goalMet ? '#FBBF24' : '#F97316' }} />
            <View style={{ flex: 1 - goalPct }} />
          </View>
        </View>
      </View>
      {celebrate ? <Confetti trigger={celebrate} count={50} /> : null}
    </>
  );
}
