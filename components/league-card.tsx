import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchWeeklyLeaderboard, fetchWeeklyRank, qkGames } from '@/lib/games';
import { computeLeague } from '@/lib/leagues';

function isUrl(u: string | null): u is string {
  return !!u && /^https?:\/\//.test(u);
}
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Card da Liga da Semana. Os pontos efetivos somados dos 3 jogos nesta semana
 * (BR) colocam o tutor numa liga (Bronze→Diamante) e a liga reseta toda
 * segunda — competição recorrente. Mostra a liga atual, progresso pra próxima,
 * sua posição e o top 3 da semana.
 */
export function LeagueCard({ currentUserId }: { currentUserId?: string }) {
  const rankQ = useQuery({
    queryKey: qkGames.weeklyRank(),
    queryFn: () => fetchWeeklyRank(),
    enabled: !!currentUserId,
  });
  const boardQ = useQuery({
    queryKey: qkGames.weeklyLeaderboard(),
    queryFn: () => fetchWeeklyLeaderboard(5),
  });

  const points = rankQ.data?.points ?? 0;
  const lg = computeLeague(points);
  const top = (boardQ.data ?? []).slice(0, 3);
  const pct = Math.round(lg.progress * 100);

  return (
    <View
      style={{
        backgroundColor: 'rgba(251,191,36,0.10)',
        borderRadius: 20,
        padding: 16,
        gap: 12,
        borderWidth: 1.5,
        borderColor: `${lg.current.color}66`,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#fff' }}>🏆 Liga da Semana</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>zera na segunda</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: `${lg.current.color}33`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 26 }}>{lg.current.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#fff' }}>Liga {lg.current.name}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
            {points > 0
              ? `${points} pts esta semana${rankQ.data ? ` · #${rankQ.data.rank} de ${rankQ.data.total}` : ''}`
              : 'Jogue esta semana pra pontuar e subir de liga!'}
          </Text>
        </View>
      </View>

      {/* progresso pra próxima liga */}
      {lg.next ? (
        <>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', flexDirection: 'row' }}>
            <View style={{ flex: Math.max(0.001, lg.progress), backgroundColor: lg.next.color }} />
            <View style={{ flex: Math.max(0.001, 1 - lg.progress) }} />
          </View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', textAlign: 'right' }}>
            faltam {lg.toNext} pts pra Liga {lg.next.name} {lg.next.emoji} ({pct}%)
          </Text>
        </>
      ) : (
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: lg.current.color, textAlign: 'center' }}>
          👑 Liga máxima! Você é elite da Arena Pet esta semana.
        </Text>
      )}

      {/* top 3 da semana */}
      {top.length > 0 ? (
        <View style={{ gap: 6, marginTop: 2 }}>
          {top.map((r, i) => (
            <View key={r.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Text style={{ width: 20, fontSize: 14, textAlign: 'center' }}>{MEDALS[i]}</Text>
              {isUrl(r.tutor_avatar) ? (
                <Image source={{ uri: r.tutor_avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} contentFit="cover" />
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff' }}>
                    {(r.display_name?.trim()?.[0] ?? '🐾').toUpperCase()}
                  </Text>
                </View>
              )}
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }}>
                {r.display_name}
                {!!currentUserId && r.user_id === currentUserId ? ' · você' : ''}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>{r.points}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
