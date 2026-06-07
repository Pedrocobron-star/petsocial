import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { GlobalLeaderboard } from '@/components/global-leaderboard';
import { PlayerLevelCard } from '@/components/player-level-card';
import { StreakCard } from '@/components/streak-card';
import { FONTS } from '@/lib/fonts';
import { fetchGlobalMyRank, fetchMyRank, qkGames, type GameKey, type GamePeriod } from '@/lib/games';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const BG = '#140E22';
const NEON = {
  textShadowColor: 'rgba(244,114,182,0.8)',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 14,
} as const;

interface GameDef {
  key: GameKey;
  href: string;
  emoji: string;
  title: string;
  desc: string;
  c1: string;
  c2: string;
}

const GAMES: GameDef[] = [
  {
    key: 'treats',
    href: '/(app)/games/treats',
    emoji: '🦴',
    title: 'Pega o Petisco',
    desc: 'Pegue os petiscos voando em 30s. Reflexo + combo!',
    c1: '#F97316',
    c2: '#DB2777',
  },
  {
    key: 'quiz',
    href: '/(app)/games/quiz',
    emoji: '🧠',
    title: 'Quiz Pet',
    desc: 'Conhecimentos gerais sobre cães, gatos e cia.',
    c1: '#7C3AED',
    c2: '#2563EB',
  },
  {
    key: 'caminho',
    href: '/(app)/games/caminho',
    emoji: '🐕',
    title: 'Caminho do Au-Au',
    desc: 'Monte o caminho com setas e leve o pet até o petisco. Puzzle de lógica!',
    c1: '#0EA5E9',
    c2: '#22C55E',
  },
];

export default function GamesHubScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const userId = session?.user.id;
  const [rankGame, setRankGame] = useState<GameKey>('treats');
  const [period, setPeriod] = useState<GamePeriod>('week');
  const [scope, setScope] = useState<'game' | 'global'>('game');

  const myRankQuery = useQuery({
    queryKey: qkGames.myRank(rankGame, period),
    queryFn: () => fetchMyRank(rankGame, period),
    enabled: !!userId && scope === 'game',
  });

  const globalRankQuery = useQuery({
    queryKey: qkGames.globalMyRank(),
    queryFn: () => fetchGlobalMyRank(),
    enabled: !!userId && scope === 'global',
  });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🎰 Cassino Pet',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff', fontFamily: FONTS.display },
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 18 }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', gap: 4, paddingTop: 6 }}>
          <Text style={[{ fontFamily: FONTS.display, fontSize: 30, color: '#FBBF24' }, NEON]}>
            🎰 Cassino Pet 🐾
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
            {activePet ? `Você joga, ${activePet.name} torce — ` : ''}dispute o ranking e seja o nº 1! 🏆
          </Text>
        </View>

        <StreakCard />
        <PlayerLevelCard />

        {/* Game cards */}
        <View style={{ gap: 12 }}>
          {GAMES.map((g) => (
            <Link key={g.key} href={g.href as never} asChild>
              <Pressable
                style={{
                  backgroundColor: g.c1,
                  borderRadius: 22,
                  padding: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                  shadowColor: g.c2,
                  shadowOpacity: 0.6,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.18)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 34 }}>{g.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: '#fff' }}>{g.title}</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
                    {g.desc}
                  </Text>
                  <GameGradeBadge game={g.key} variant="card" />
                </View>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="play" size={14} color={g.c1} />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: g.c1 }}>Jogar</Text>
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        {/* Ranking */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 22,
            padding: 14,
            gap: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <Text style={[{ fontFamily: FONTS.display, fontSize: 20, color: '#FBBF24', textAlign: 'center' }, NEON]}>
            🏆 Ranking
          </Text>

          {/* escopo: por jogo OU placar geral combinado (soma dos 3 jogos) */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 999, padding: 4 }}>
            {(['game', 'global'] as const).map((s) => {
              const active = scope === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setScope(s)}
                  style={{
                    flex: 1,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? '#F472B6' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: active ? '#1A1410' : 'rgba(255,255,255,0.7)' }}>
                    {s === 'game' ? '🎮 Por jogo' : '🌍 Geral'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {scope === 'global' ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
              Soma do seu melhor placar em cada um dos 3 jogos. Mande bem em todos pra liderar! 🐾
            </Text>
          ) : null}

          {/* período + jogo + sua posição + leaderboard — só no modo por-jogo */}
          {scope === 'game' ? (
          <>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 999, padding: 4 }}>
            {(['week', 'all'] as GamePeriod[]).map((p) => {
              const active = period === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setPeriod(p)}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: active ? 'rgba(251,191,36,0.9)' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? '#1A1410' : 'rgba(255,255,255,0.6)' }}>
                    {p === 'week' ? '🔥 Esta semana' : '🏅 Geral'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 999, padding: 4 }}>
            {GAMES.map((g) => {
              const active = rankGame === g.key;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setRankGame(g.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? '#FBBF24' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: active ? '#1A1410' : 'rgba(255,255,255,0.7)' }}>
                    {g.emoji} {g.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Sua posição (mesmo fora do top-20) */}
          {userId ? (
            <View
              style={{
                backgroundColor: 'rgba(251,191,36,0.12)',
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: 'center',
              }}
            >
              {myRankQuery.data ? (
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24', textAlign: 'center' }}>
                  🎯 Sua posição: #{myRankQuery.data.rank} de {myRankQuery.data.total} · melhor {myRankQuery.data.score}
                </Text>
              ) : (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                  Você ainda não pontuou{period === 'week' ? ' esta semana' : ''} — jogue pra entrar no ranking! 🎮
                </Text>
              )}
            </View>
          ) : null}

          <GameLeaderboard game={rankGame} limit={20} currentUserId={userId} period={period} />
          </>
          ) : (
          <>
          {userId ? (
            <View
              style={{
                backgroundColor: 'rgba(251,191,36,0.12)',
                borderRadius: 14,
                paddingVertical: 10,
                paddingHorizontal: 14,
                alignItems: 'center',
              }}
            >
              {globalRankQuery.data ? (
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24', textAlign: 'center' }}>
                  🎯 Sua posição geral: #{globalRankQuery.data.rank} de {globalRankQuery.data.total} · {globalRankQuery.data.total_score} pts
                </Text>
              ) : (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                  Você ainda não pontuou — jogue os 3 jogos pra entrar no placar geral! 🎮
                </Text>
              )}
            </View>
          ) : null}
          <GlobalLeaderboard limit={30} currentUserId={userId} />
          </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
