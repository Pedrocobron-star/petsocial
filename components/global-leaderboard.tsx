import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchGlobalLeaderboard, qkGames, type GlobalLeaderboardEntry } from '@/lib/games';

function isUrl(u: string | null): u is string {
  return !!u && /^https?:\/\//.test(u);
}
const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Placar geral combinado: ranking dos tutores somando o melhor score de cada
 * um dos 3 jogos (score efetivo já com multiplicador de dificuldade). Premia
 * quem é bom na Arena Pet inteiro, não só em um jogo.
 */
export function GlobalLeaderboard({ limit = 30, currentUserId }: { limit?: number; currentUserId?: string }) {
  const q = useQuery({
    queryKey: qkGames.global(),
    queryFn: () => fetchGlobalLeaderboard(limit),
  });
  const rows = q.data ?? [];

  if (q.isLoading) return <ActivityIndicator color="#FBBF24" style={{ padding: 24 }} />;

  if (q.isError) {
    return (
      <View style={{ padding: 22, alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 30 }}>⚠️</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyMedium,
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
          }}
        >
          Não foi possível carregar o placar geral. Verifica sua conexão.
        </Text>
        <Pressable
          onPress={() => q.refetch()}
          accessibilityRole="button"
          style={{ marginTop: 2, backgroundColor: 'rgba(251,191,36,0.18)', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: '#FBBF24' }}>Tentar de novo</Text>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={{ padding: 22, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 30 }}>🌍</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyMedium,
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
          }}
        >
          Ninguém pontuou ainda. Jogue os jogos e lidere o placar geral!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      {rows.map((r, i) => (
        <Row key={r.user_id} entry={r} rank={i + 1} me={!!currentUserId && r.user_id === currentUserId} />
      ))}
    </View>
  );
}

function Row({ entry, rank, me }: { entry: GlobalLeaderboardEntry; rank: number; me: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: me ? 'rgba(251,191,36,0.20)' : 'rgba(255,255,255,0.06)',
        borderWidth: me ? 1 : 0,
        borderColor: '#FBBF24',
      }}
    >
      <View style={{ width: 26, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: rank <= 3 ? 18 : 13, color: '#fff' }}>
          {rank <= 3 ? MEDALS[rank - 1] : rank}
        </Text>
      </View>
      {isUrl(entry.tutor_avatar) ? (
        <Image source={{ uri: entry.tutor_avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" />
      ) : (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: 'rgba(255,255,255,0.14)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
            {(entry.display_name?.trim()?.[0] ?? '🐾').toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: '#fff' }}>
          {entry.display_name}
          {me ? ' · você' : ''}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
          🎮 {entry.games_played} {entry.games_played === 1 ? 'jogo' : 'jogos'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FONTS.body, fontSize: 9.5, color: 'rgba(255,255,255,0.5)' }}>total</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{entry.total_score}</Text>
      </View>
    </View>
  );
}
