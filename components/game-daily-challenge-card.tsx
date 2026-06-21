import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Confetti } from '@/components/confetti';
import { pickChest, todayChallenge, type ChestReward } from '@/lib/daily-challenge';
import { FONTS } from '@/lib/fonts';
import {
  DIFF_META,
  GAME_META,
  fetchDailyLeaderboard,
  fetchDailyMyResult,
  qkGames,
  type GameKey,
} from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { gamesUrl, sharePost } from '@/lib/share';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const GAME_ROUTE: Record<GameKey, string> = {
  treats: '/(app)/games/treats',
  quiz: '/(app)/games/quiz',
  caminho: '/(app)/games/caminho',
  runner: '/(app)/games/runner',
};
const MEDALS = ['🥇', '🥈', '🥉'];
const PINK = '#F472B6';

function isUrl(u: string | null): u is string {
  return !!u && /^https?:\/\//.test(u);
}

/**
 * Card do Desafio Diário no hub dos jogos (Arena Pet). Mostra o
 * jogo+dificuldade do dia (iguais pra todo mundo), detecta se o tutor já
 * completou (via game_scores), abre um baú surpresa cosmético com confete,
 * exibe o placar do dia (top 3) e deixa compartilhar o resultado. É o gancho
 * de retorno-diário (estilo Wordle/Duolingo) que costura streak, placar e
 * níveis num lugar só.
 *
 * NB: distinto do `DailyChallengeCard` do feed (prompt de postagem).
 */
export function GameDailyChallengeCard() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const userId = session?.user.id;
  const router = useRouter();

  const today = useMemo(() => todayChallenge(), []);
  const meta = GAME_META[today.game];
  const diff = DIFF_META[today.difficulty];

  const myResult = useQuery({
    queryKey: qkGames.dailyMyResult(today.game, today.difficulty),
    queryFn: () => fetchDailyMyResult(today.game, today.difficulty),
    enabled: !!userId,
  });
  const board = useQuery({
    queryKey: qkGames.daily(today.game, today.difficulty),
    queryFn: () => fetchDailyLeaderboard(today.game, today.difficulty, 5),
  });

  const played = !!myResult.data?.played;
  const myBest = myResult.data?.best_score ?? null;
  const myRank = myResult.data?.rank ?? null;
  const totalPlayers = myResult.data?.total ?? board.data?.length ?? 0;
  const topRows = (board.data ?? []).slice(0, 3);

  // Baú surpresa: revela ao completar; confete só na 1ª vez do dia.
  const [celebrate, setCelebrate] = useState(0);
  const [reward, setReward] = useState<ChestReward | null>(null);
  useEffect(() => {
    if (!played || !userId) return;
    let cancelled = false;
    const key = `petsocial:daily-chest-claimed:${today.dateStr}`;
    AsyncStorage.getItem(key)
      .then((v) => {
        if (cancelled) return;
        setReward(pickChest(today.dateStr, userId));
        if (!v) {
          AsyncStorage.setItem(key, '1').catch(() => {});
          setCelebrate((c) => c + 1);
          haptic.success();
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [played, userId, today.dateStr]);

  const onPlay = async () => {
    haptic.light();
    // pré-seleciona a dificuldade do dia (o jogo lê essa key no mount)
    await AsyncStorage.setItem(`petsocial:game-diff:${today.game}`, String(today.difficulty)).catch(() => {});
    router.push(GAME_ROUTE[today.game] as never);
  };

  const onShare = async () => {
    haptic.light();
    const who = activePet?.name?.trim();
    const txt =
      `🎯 Desafio de hoje da Arena Pet · ${meta.emoji} ${meta.label} (${diff.emoji} ${diff.label})\n` +
      `${who ? `Eu e ${who} fizemos` : 'Fiz'} ${myBest} ${meta.scoreLabel}! Cadê o seu? Me supera 👇`;
    await sharePost({ title: 'Desafio Diário · Arena Pet', message: txt, url: gamesUrl() });
  };

  return (
    <View
      style={{
        backgroundColor: 'rgba(244,114,182,0.14)',
        borderRadius: 20,
        padding: 16,
        gap: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(244,114,182,0.45)',
      }}
    >
      {/* Cabeçalho */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: '#fff' }}>🎯 Desafio de Hoje</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>renova à meia-noite</Text>
      </View>

      {/* Jogo + dificuldade do dia */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            backgroundColor: 'rgba(244,114,182,0.22)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 25 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15.5, color: '#fff' }}>{meta.label}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            Dificuldade do dia: {diff.emoji} {diff.label}
          </Text>
        </View>
        {played ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 9.5, color: 'rgba(255,255,255,0.5)' }}>seu placar</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: PINK }}>{myBest}</Text>
          </View>
        ) : null}
      </View>

      {/* Estado: concluído x pendente */}
      {played ? (
        <>
          <View
            style={{
              backgroundColor: 'rgba(34,197,94,0.16)',
              borderRadius: 12,
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: 'rgba(34,197,94,0.4)',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#86EFAC', textAlign: 'center' }}>
              ✅ Desafio concluído!{myRank ? ` Você está em #${myRank} de ${totalPlayers} hoje` : ''}
            </Text>
          </View>

          {/* Baú aberto */}
          {reward ? (
            <View
              style={{
                backgroundColor: 'rgba(251,191,36,0.14)',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: 'rgba(251,191,36,0.4)',
              }}
            >
              <Text style={{ fontSize: 30 }}>{reward.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>
                  🎁 Baú de hoje: {reward.label}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', lineHeight: 16 }}>
                  {reward.copy}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel="Compartilhar resultado do desafio de hoje"
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.25)',
                borderRadius: 12,
                paddingVertical: 11,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>📤 Compartilhar</Text>
            </Pressable>
            <Pressable
              onPress={onPlay}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: PINK,
                borderRadius: 12,
                paddingVertical: 11,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410' }}>🔁 Jogar de novo</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 18 }}>
            Complete o desafio de hoje pra abrir o baú surpresa 🎁 e disputar o placar do dia!
          </Text>
          {totalPlayers > 0 ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: PINK }}>
              🔥 {totalPlayers} {totalPlayers === 1 ? 'tutor já topou' : 'tutores já toparam'} hoje
            </Text>
          ) : null}
          <Pressable
            onPress={onPlay}
            accessibilityRole="button"
            accessibilityLabel="Jogar o desafio de hoje"
            style={({ pressed }) => ({
              backgroundColor: PINK,
              borderRadius: 14,
              paddingVertical: 13,
              alignItems: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14.5, color: '#1A1410' }}>🎮 Jogar agora</Text>
          </Pressable>
        </>
      )}

      {/* Placar do dia (top 3) */}
      {topRows.length > 0 ? (
        <View style={{ gap: 6, marginTop: 2 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
            🏆 Placar de hoje
          </Text>
          {topRows.map((r, i) => (
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
                {!!userId && r.user_id === userId ? ' · você' : ''}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>{r.score}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {celebrate ? <Confetti trigger={celebrate} count={60} /> : null}
    </View>
  );
}
