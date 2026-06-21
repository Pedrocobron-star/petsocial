import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { UserInitialAvatar } from '@/components/user-initial-avatar';
import { FONTS } from '@/lib/fonts';
import { DIFF_META, GAME_META, type GameDifficulty } from '@/lib/games';
import {
  fetchActiveTournament,
  fetchLastFinishedTournament,
  fetchMyTournamentRank,
  fetchTournamentLeaderboard,
  fetchTournamentPodium,
  formatCountdown,
  qkTournament,
} from '@/lib/tournaments';
import { useSession } from '@/providers/session-provider';

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_DISMISS_KEY = 'petsocial:tourney-podium-dismissed';
const PODIUM_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // mostra o pódio por até 3 dias

/**
 * Card do Torneio da Arena ativo — evento temporizado de 1 jogo. Mostra
 * contagem regressiva, pódio top-3 e seu rank, com CTA pra jogar. Some quando
 * não há torneio ativo.
 */
export function TournamentCard() {
  const activeQuery = useQuery({
    queryKey: qkTournament.active(),
    queryFn: fetchActiveTournament,
    staleTime: 60_000,
  });
  const t = activeQuery.data ?? null;

  const lbQuery = useQuery({
    queryKey: t ? qkTournament.leaderboard(t.id) : ['tournament-lb', 'none'],
    queryFn: () => fetchTournamentLeaderboard(t!.id, 3),
    enabled: !!t,
    staleTime: 30_000,
  });
  const myRankQuery = useQuery({
    queryKey: t ? qkTournament.myRank(t.id) : ['tournament-rank', 'none'],
    queryFn: () => fetchMyTournamentRank(t!.id),
    enabled: !!t,
    staleTime: 30_000,
  });

  // contagem regressiva viva (atualiza a cada 30s)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Sem torneio ativo → mostra o pódio do último (em vez de sumir de vez).
  if (!t) return <LastTournamentPodium />;

  const meta = GAME_META[t.game] ?? { emoji: '🎮', label: t.title, scoreLabel: 'pts' };
  const diff = DIFF_META[t.min_difficulty as GameDifficulty] ?? DIFF_META[2];
  const remaining = formatCountdown(new Date(t.ends_at).getTime() - nowMs);
  const top = lbQuery.data ?? [];
  const myRank = myRankQuery.data;

  return (
    <View
      style={{
        backgroundColor: '#2E1065',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#7C3AED',
        gap: 12,
      }}
    >
      {/* header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>🏆</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: '#FBBF24',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Torneio da Arena
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: 'rgba(251,191,36,0.18)',
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
          }}
        >
          <Ionicons name="time-outline" size={13} color="#FBBF24" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FBBF24' }}>{remaining}</Text>
        </View>
      </View>

      {/* título + jogo */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: 'rgba(255,255,255,0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 26 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF' }}>{t.title}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#C4B5FD', marginTop: 1 }}>
            {meta.label} · {diff.emoji} {diff.label}+ · top 10 levam troféu
          </Text>
        </View>
      </View>

      {/* pódio top 3 */}
      {top.length > 0 ? (
        <View style={{ gap: 6 }}>
          {top.map((row, i) => (
            <View key={row.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <Text style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{MEDALS[i] ?? `${i + 1}`}</Text>
              <UserInitialAvatar
                avatarUrl={row.tutor_avatar}
                displayName={row.display_name}
                userId={row.user_id}
                size={26}
              />
              <Text
                numberOfLines={1}
                style={{ flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: '#EDE9FE' }}
              >
                {row.display_name}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>
                {Math.round(row.score)}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: '#C4B5FD' }}>
          Ninguém pontuou ainda. Seja o primeiro do pódio! 🚀
        </Text>
      )}

      {/* seu rank */}
      {myRank ? (
        <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: '#A78BFA' }}>
          Você está em {myRank.rank}º · {Math.round(myRank.score)} pts
        </Text>
      ) : null}

      {/* CTA */}
      <Link href={`/(app)/games/${t.game}` as never} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Jogar ${meta.label} no torneio`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#FBBF24',
            paddingVertical: 12,
            borderRadius: 14,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons name="game-controller" size={18} color="#1A1410" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#1A1410' }}>
            Jogar agora e disputar
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

/**
 * Pódio do último torneio finalizado — preenche o vazio quando não há torneio
 * ativo (antes o card sumia e a vitória ficava invisível; o push "veja onde
 * você ficou" caía num hub sem nada). Some sozinho 3 dias após o fim, ou ao
 * fechar. Destaca a linha do próprio tutor.
 */
function LastTournamentPodium() {
  const { session } = useSession();
  const myId = session?.user.id ?? null;
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [loadedDismiss, setLoadedDismiss] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PODIUM_DISMISS_KEY)
      .then((v) => setDismissedId(v))
      .catch(() => {})
      .finally(() => setLoadedDismiss(true));
  }, []);

  const lastQuery = useQuery({
    queryKey: qkTournament.lastFinished(),
    queryFn: fetchLastFinishedTournament,
    staleTime: 5 * 60_000,
  });
  const t = lastQuery.data ?? null;

  const podiumQuery = useQuery({
    queryKey: t ? qkTournament.podium(t.id) : ['tournament-podium', 'none'],
    queryFn: () => fetchTournamentPodium(t!.id),
    enabled: !!t,
    staleTime: 5 * 60_000,
  });
  const podium = podiumQuery.data ?? [];

  if (!loadedDismiss || !t || podium.length === 0) return null;
  const ageMs = t.finalized_at ? Date.now() - new Date(t.finalized_at).getTime() : Infinity;
  if (ageMs > PODIUM_MAX_AGE_MS || dismissedId === t.id) return null;

  const meta = GAME_META[t.game] ?? { emoji: '🏁', label: t.title, scoreLabel: 'pts' };
  const dismiss = () => {
    setDismissedId(t.id);
    AsyncStorage.setItem(PODIUM_DISMISS_KEY, t.id).catch(() => {});
  };

  return (
    <View
      style={{
        backgroundColor: '#1E1B3A',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#4C1D95',
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>🏁</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            letterSpacing: 1.4,
            color: '#C4B5FD',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Resultado do último torneio
        </Text>
        <Pressable onPress={dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar resultado">
          <Ionicons name="close" size={18} color="#A78BFA" />
        </Pressable>
      </View>

      <View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>{t.title}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A78BFA', marginTop: 1 }}>
          {meta.emoji} {meta.label} · encerrado
        </Text>
      </View>

      <View style={{ gap: 6, marginTop: 2 }}>
        {podium.slice(0, 5).map((row, i) => {
          const isMe = !!myId && row.user_id === myId;
          return (
            <View
              key={row.user_id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 9,
                backgroundColor: isMe ? 'rgba(251,191,36,0.14)' : 'transparent',
                borderRadius: 8,
                paddingVertical: 2,
                paddingHorizontal: isMe ? 6 : 0,
              }}
            >
              <Text style={{ fontSize: 15, width: 22, textAlign: 'center' }}>{MEDALS[i] ?? `${row.rank}`}</Text>
              <UserInitialAvatar
                avatarUrl={row.tutor_avatar}
                displayName={row.display_name}
                userId={row.user_id}
                size={26}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: isMe ? FONTS.bodyBold : FONTS.bodySemibold,
                  fontSize: 13,
                  color: isMe ? '#FBBF24' : '#EDE9FE',
                }}
              >
                {row.display_name}
                {isMe ? ' (você)' : ''}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>
                {Math.round(row.score)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
