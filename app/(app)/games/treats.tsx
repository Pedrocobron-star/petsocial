import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';

import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { DIFF_META, submitGameScore, type GameDifficulty } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const BG = '#140E22';
const ROUND_SECONDS = 30;
const TICK_MS = 100;
const ITEM_SIZE = 58;
const DIFF_KEY = 'petsocial:game-diff:treats';

/**
 * Parâmetros por tier de dificuldade. Médio (2) reproduz exatamente a
 * experiência original hardcoded (spawn 820→460, TTL 1300, bad 0.16, gold 0.11
 * acumulado sobre bad, penalidade −3). Só os parâmetros mudam por tier — a
 * mecânica do jogo é idêntica nos três.
 */
interface TreatsTier {
  spawnStart: number; // intervalo de spawn no início da rodada (ms)
  spawnEnd: number; // intervalo de spawn no fim da rodada (ms)
  itemTtl: number; // tempo do item na tela / TTL (ms)
  badProb: number; // probabilidade da abelha (bad)
  goldProb: number; // probabilidade da dourada (gold)
  badPenalty: number; // penalidade ao tocar a abelha (negativo)
}

const TREATS_TUNING: Record<GameDifficulty, TreatsTier> = {
  1: { spawnStart: 950, spawnEnd: 600, itemTtl: 1600, badProb: 0.1, goldProb: 0.22, badPenalty: -2 },
  2: { spawnStart: 820, spawnEnd: 460, itemTtl: 1300, badProb: 0.16, goldProb: 0.11, badPenalty: -3 },
  3: { spawnStart: 680, spawnEnd: 320, itemTtl: 1000, badProb: 0.24, goldProb: 0.12, badPenalty: -4 },
};

const TREAT_BY_SPECIES: Record<string, string> = {
  dog: '🦴',
  cat: '🐟',
  rabbit: '🥕',
  bird: '🌻',
  hamster: '🌰',
  fish: '🪱',
  turtle: '🥬',
  reptile: '🦗',
  horse: '🍎',
};
const GOLD_EMOJI = '⭐';
const BAD_EMOJI = '🐝';

type Phase = 'idle' | 'playing' | 'over';
type Kind = 'treat' | 'gold' | 'bad';
interface GameItem {
  id: number;
  x: number;
  y: number;
  kind: Kind;
  emoji: string;
  expiresAt: number;
}
interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

function spawnInterval(elapsedMs: number, difficulty: GameDifficulty): number {
  const { spawnStart, spawnEnd } = TREATS_TUNING[difficulty];
  const t = Math.min(1, elapsedMs / (ROUND_SECONDS * 1000));
  return Math.round(spawnStart - t * (spawnStart - spawnEnd));
}

export default function TreatsGameScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const treat = (activePet && TREAT_BY_SPECIES[activePet.species]) || '🍪';

  const [phase, setPhase] = useState<Phase>('idle');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(2);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [best, setBest] = useState(0);
  const [items, setItems] = useState<GameItem[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const phaseRef = useRef<Phase>('idle');
  const difficultyRef = useRef<GameDifficulty>(2);
  const elapsedRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const idRef = useRef(0);
  const popupIdRef = useRef(0);
  const areaRef = useRef({ w: 0, h: 0 });
  const treatRef = useRef('🍪');
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestRef = useRef(0);
  const itemsRef = useRef<GameItem[]>([]);
  treatRef.current = treat;
  areaRef.current = area;
  bestRef.current = best;
  difficultyRef.current = difficulty;

  const petId = activePet?.id ?? null;
  const bestKey = userId ? `petsocial:game-best:${userId}` : null;
  useEffect(() => {
    if (!bestKey) return;
    AsyncStorage.getItem(bestKey)
      .then((v) => {
        const n = v ? parseInt(v, 10) : 0;
        if (Number.isFinite(n)) setBest(n);
      })
      .catch(() => {});
  }, [bestKey]);

  // dificuldade escolhida persiste por jogo (default = 2 / Médio = experiência original)
  useEffect(() => {
    AsyncStorage.getItem(DIFF_KEY)
      .then((v) => {
        const n = v ? parseInt(v, 10) : NaN;
        if (n === 1 || n === 2 || n === 3) setDifficulty(n);
      })
      .catch(() => {});
  }, []);

  const changeDifficulty = (d: GameDifficulty) => {
    setDifficulty(d);
    AsyncStorage.setItem(DIFF_KEY, String(d)).catch(() => {});
  };

  const addPopup = (x: number, y: number, text: string, color: string) => {
    const id = popupIdRef.current++;
    setPopups((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 750);
  };

  useEffect(() => {
    const loop = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      elapsedRef.current += TICK_MS;
      const elapsed = elapsedRef.current;

      const remaining = Math.max(0, ROUND_SECONDS - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      // expira itens; perder petisco/ouro zera o combo
      const survivors: GameItem[] = [];
      let missed = false;
      for (const it of itemsRef.current) {
        if (it.expiresAt > elapsed) survivors.push(it);
        else if (it.kind !== 'bad') missed = true;
      }
      if (missed && comboRef.current > 0) {
        comboRef.current = 0;
        setCombo(0);
      }
      itemsRef.current = survivors;

      // spawn
      const a = areaRef.current;
      const tier = TREATS_TUNING[difficultyRef.current];
      if (a.w > 60 && a.h > 60 && elapsed - lastSpawnRef.current >= spawnInterval(elapsed, difficultyRef.current)) {
        lastSpawnRef.current = elapsed;
        const r = Math.random();
        const kind: Kind = r < tier.badProb ? 'bad' : r < tier.badProb + tier.goldProb ? 'gold' : 'treat';
        const emoji = kind === 'bad' ? BAD_EMOJI : kind === 'gold' ? GOLD_EMOJI : treatRef.current;
        itemsRef.current = [
          ...itemsRef.current,
          {
            id: idRef.current++,
            x: Math.random() * (a.w - ITEM_SIZE),
            y: Math.random() * (a.h - ITEM_SIZE),
            kind,
            emoji,
            expiresAt: elapsed + tier.itemTtl,
          },
        ];
      }
      setItems(itemsRef.current.slice());

      if (remaining <= 0) {
        phaseRef.current = 'over';
        setPhase('over');
        itemsRef.current = [];
        setItems([]);
        const finalScore = scoreRef.current;
        if (finalScore > bestRef.current) {
          setBest(finalScore);
          if (bestKey) AsyncStorage.setItem(bestKey, String(finalScore)).catch(() => {});
        }
        if (userId && finalScore > 0) {
          submitGameScore({ game: 'treats', score: finalScore, petId, userId, difficulty: difficultyRef.current })
            .then(() => {
              qc.invalidateQueries({ queryKey: ['game-leaderboard', 'treats'] });
              qc.invalidateQueries({ queryKey: ['game-my-rank', 'treats'] });
            })
            .catch(() => {});
        }
      }
    }, TICK_MS);
    return () => clearInterval(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, userId, petId]);

  const start = () => {
    difficultyRef.current = difficulty; // trava a dificuldade escolhida pra rodada
    elapsedRef.current = 0;
    lastSpawnRef.current = 0;
    scoreRef.current = 0;
    comboRef.current = 0;
    itemsRef.current = [];
    setScore(0);
    setCombo(0);
    setTimeLeft(ROUND_SECONDS);
    setItems([]);
    setPopups([]);
    setPhase('playing');
    phaseRef.current = 'playing';
    haptic.light();
  };

  const tap = (item: GameItem) => {
    itemsRef.current = itemsRef.current.filter((it) => it.id !== item.id);
    setItems(itemsRef.current.slice());
    haptic.light();
    if (item.kind === 'bad') {
      comboRef.current = 0;
      setCombo(0);
      const penalty = TREATS_TUNING[difficultyRef.current].badPenalty;
      scoreRef.current = Math.max(0, scoreRef.current + penalty);
      setScore(scoreRef.current);
      addPopup(item.x, item.y, String(penalty), '#F87171');
    } else {
      comboRef.current += 1;
      setCombo(comboRef.current);
      const gain = (item.kind === 'gold' ? 5 : 0) + comboRef.current;
      scoreRef.current += gain;
      setScore(scoreRef.current);
      addPopup(item.x, item.y, `+${gain}`, item.kind === 'gold' ? '#FBBF24' : '#4ADE80');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🦴 Pega o Petisco',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff', fontFamily: FONTS.display },
        }}
      />

      {/* Placar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
      >
        {activePet ? <PetAvatar pet={activePet} size={42} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' }}>{score} pts</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            Recorde: {best}
            {combo > 1 && phase === 'playing' ? `  ·  🔥 combo x${combo}` : ''}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 22,
            color: timeLeft <= 5 && phase === 'playing' ? '#EF4444' : '#FBBF24',
            minWidth: 50,
            textAlign: 'right',
          }}
        >
          {timeLeft}s
        </Text>
      </View>

      {/* Campo */}
      <View
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, margin: 12, borderRadius: 20, backgroundColor: '#D1FAE5', overflow: 'hidden' }}
      >
        {items.map((item) => (
          <TreatItem key={item.id} item={item} onTap={tap} />
        ))}
        {popups.map((p) => (
          <PopupText key={p.id} popup={p} />
        ))}

        {phase !== 'playing' ? (
          <ScrollView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 18, gap: 14, backgroundColor: 'rgba(20,14,34,0.78)' }}
          >
            <View
              style={{
                backgroundColor: '#1E1733',
                borderRadius: 22,
                padding: 22,
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
              }}
            >
              {phase === 'over' ? (
                <>
                  <Text style={{ fontSize: 44 }}>{score >= best && score > 0 ? '🏆' : treat}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FBBF24' }}>{score} pts</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                    {score >= best && score > 0
                      ? 'Seu novo recorde! 🎉'
                      : `Recorde: ${best}. Bora bater e subir no ranking?`}
                  </Text>
                  <Button title="Jogar de novo" onPress={start} fullWidth />
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 44 }}>{treat}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>
                    Pega o Petisco
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 19 }}>
                    Toque nos {treat} pra {activePet?.name ?? 'seu pet'} comer. Encadeie pra fazer 🔥 combo, pegue a {GOLD_EMOJI} dourada (vale mais) e fuja da abelha {BAD_EMOJI} ({TREATS_TUNING[difficulty].badPenalty}). {ROUND_SECONDS}s!
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Dificuldade {DIFF_META[difficulty].emoji} {DIFF_META[difficulty].label} · score ×{DIFF_META[difficulty].mult}
                  </Text>
                  <GameGradeBadge game="treats" variant="idle" />
                  {/* só renderiza na tela idle/over — durante a partida o picker some, então nunca fica editável jogando */}
                  <GameDifficultyPicker value={difficulty} onChange={changeDifficulty} disabled={false} />
                  <Button title="Jogar" onPress={start} fullWidth />
                </>
              )}
            </View>

            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              🏆 Ranking · Pega o Petisco
            </Text>
            <GameLeaderboard game="treats" limit={20} currentUserId={userId} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function TreatItem({ item, onTap }: { item: GameItem; onTap: (item: GameItem) => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }).start();
  }, [scale]);
  const bg = item.kind === 'bad' ? '#FECACA' : item.kind === 'gold' ? '#FEF3C7' : '#FFFFFF';
  const border = item.kind === 'bad' ? '#F87171' : item.kind === 'gold' ? '#FBBF24' : '#FDE68A';
  return (
    <Animated.View style={{ position: 'absolute', left: item.x, top: item.y, transform: [{ scale }] }}>
      <Pressable
        onPress={() => onTap(item)}
        hitSlop={6}
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          borderRadius: ITEM_SIZE / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: item.kind === 'gold' ? 3 : 2,
          borderColor: border,
          shadowColor: item.kind === 'gold' ? '#F59E0B' : '#000',
          shadowOpacity: item.kind === 'gold' ? 0.5 : 0.18,
          shadowRadius: item.kind === 'gold' ? 6 : 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: ITEM_SIZE * 0.52 }}>{item.emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}

function PopupText({ popup }: { popup: Popup }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 720, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: popup.x,
        top: popup.y,
        width: ITEM_SIZE,
        textAlign: 'center',
        fontFamily: FONTS.display,
        fontSize: 20,
        color: popup.color,
        opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
        transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }],
      }}
    >
      {popup.text}
    </Animated.Text>
  );
}
