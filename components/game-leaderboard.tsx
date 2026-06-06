import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchLeaderboard, qkGames, type GameKey, type LeaderboardEntry } from '@/lib/games';

function isUrl(u: string | null): u is string {
  return !!u && /^https?:\/\//.test(u);
}
const MEDALS = ['🥇', '🥈', '🥉'];

export function GameLeaderboard({
  game,
  limit = 20,
  currentUserId,
}: {
  game: GameKey;
  limit?: number;
  currentUserId?: string;
}) {
  const q = useQuery({ queryKey: qkGames.leaderboard(game), queryFn: () => fetchLeaderboard(game, limit) });
  const rows = q.data ?? [];

  if (q.isLoading) return <ActivityIndicator color="#FBBF24" style={{ padding: 24 }} />;

  if (rows.length === 0) {
    return (
      <View style={{ padding: 22, alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 30 }}>🏆</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyMedium,
            fontSize: 12.5,
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
          }}
        >
          Ninguém pontuou ainda. Jogue e seja o nº 1 do ranking!
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

function Row({ entry, rank, me }: { entry: LeaderboardEntry; rank: number; me: boolean }) {
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
      {isUrl(entry.pet_avatar) ? (
        <Image source={{ uri: entry.pet_avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} contentFit="cover" />
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
          <Text style={{ fontSize: 17 }}>🐾</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: '#fff' }}>
          {entry.pet_name || entry.display_name}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
          {entry.pet_name ? `tutor ${entry.display_name}` : 'Tutor'}
          {me ? ' · você' : ''}
        </Text>
      </View>
      <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{entry.score}</Text>
    </View>
  );
}
