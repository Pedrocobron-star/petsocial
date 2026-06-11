import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { UserInitialAvatar } from '@/components/user-initial-avatar';
import {
  fetchMissionMonthlyLeaderboard,
  fetchMyMonthlyMissionRank,
  qkMissionLeaderboard,
  qkMyMonthlyMission,
  type MissionLeaderboardEntry,
} from '@/lib/daily-missions';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

function rankLabel(pos: number): string {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `${pos}º`;
}

export default function MissionRankingScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const myId = session?.user.id;

  const listQuery = useQuery({
    queryKey: qkMissionLeaderboard,
    queryFn: () => fetchMissionMonthlyLeaderboard(50),
    staleTime: 60_000,
  });
  const myQuery = useQuery({
    queryKey: qkMyMonthlyMission,
    queryFn: fetchMyMonthlyMissionRank,
    staleTime: 60_000,
    enabled: !!myId,
  });

  const entries = listQuery.data ?? [];
  const mine = myQuery.data;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Ranking do mês' }} />
      <FlatList
        data={entries}
        keyExtractor={(it) => it.user_id}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <CenteredColumn maxWidth={540}>
            {/* Banner do prêmio */}
            <View
              style={{
                backgroundColor: '#1A1410',
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              <Text style={{ position: 'absolute', right: -8, bottom: -14, fontSize: 90, opacity: 0.08 }}>
                🏆
              </Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: '#FBBF24' }}>
                🏆 Ranking do Mês
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#E5E5E5', marginTop: 4, lineHeight: 19 }}>
                Quem fizer mais pontos na Missão do Dia ganha{' '}
                <Text style={{ fontFamily: FONTS.bodyBold, color: '#FBBF24' }}>1 mês de Pet Pro grátis</Text>.
                O ranking zera todo dia 1º — toda hora é hora de uma volta por cima.
              </Text>
            </View>

            {/* Minha posição */}
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 16,
                padding: 14,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <UserInitialAvatar userId={myId} size={40} />
              <View style={{ flex: 1 }}>
                {mine ? (
                  <>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                      Você está em {rankLabel(mine.rank)} lugar
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 1 }}>
                      {mine.points} pts · de {mine.total_tutors} tutores no mês
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                      Você ainda não pontuou este mês
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 1 }}>
                      Cumpra a Missão do Dia pra entrar na disputa.
                    </Text>
                  </>
                )}
              </View>
            </View>
          </CenteredColumn>
        }
        renderItem={({ item }) => <RankRow entry={item} isMe={item.user_id === myId} />}
        ListEmptyComponent={
          listQuery.isLoading ? (
            <View style={{ paddingTop: 40 }}>
              <ActivityIndicator color={theme.brand} />
            </View>
          ) : (
            <EmptyState
              emoji="📸"
              title="Ninguém pontuou ainda este mês"
              description="Seja o primeiro: cumpra a Missão do Dia e assuma a liderança."
            />
          )
        }
      />
    </View>
  );
}

function RankRow({ entry, isMe }: { entry: MissionLeaderboardEntry; isMe: boolean }) {
  const { theme } = useTheme();
  const top3 = entry.rank_position <= 3;
  return (
    <CenteredColumn maxWidth={540}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 6,
          borderRadius: 14,
          backgroundColor: isMe ? '#FFF7ED' : theme.surface,
          borderWidth: 1,
          borderColor: isMe ? '#FED7AA' : theme.borderLight,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: top3 ? 20 : 14,
            color: top3 ? '#C2410C' : theme.textDim,
            width: 34,
            textAlign: 'center',
          }}
        >
          {rankLabel(entry.rank_position)}
        </Text>
        <UserInitialAvatar avatarUrl={entry.tutor_avatar} displayName={entry.display_name} userId={entry.user_id} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={1}>
            {entry.display_name}
            {isMe ? ' · você' : ''}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}>
            {entry.completions} {entry.completions === 1 ? 'missão' : 'missões'} no mês
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#C2410C' }}>{entry.points} pts</Text>
      </View>
    </CenteredColumn>
  );
}
