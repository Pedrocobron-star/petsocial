import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { GameResultShareButton } from '@/components/game-result-share-button';
import { TournamentGameBanner } from '@/components/tournament-game-banner';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { beginGameSession, DIFF_META, invalidateGameQueries, submitGameScore, type GameDifficulty } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { MOZART } from '@/lib/mozart';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

const BG = '#140E22';
const TICK_MS = 33; // ~30fps
const DIFF_KEY = 'petsocial:game-diff:runner';
const BEST_KEY_PREFIX = 'petsocial:game-best-runner:';

// Mozart (corredor)
const MOZART_X = 46;
const MOZART_W = 50;
const MOZART_H = 52;
const GROUND_FROM_BOTTOM = 54; // altura da "pista" a partir da base

// pulo
const JUMP_V = 660; // velocidade inicial do pulo (px/s, pra cima)
const GRAVITY = 2100; // px/s²
const HOLD_GRAVITY = 1050; // gravidade reduzida enquanto segura (pulo mais alto)

const OBST_W = 32;
const OBST_H = 40;
const TREAT_SIZE = 34;

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
const OBSTACLE_EMOJIS = ['🌵', '🪨', '🔥', '🧱'];

interface RunnerTier {
  v0: number; // velocidade inicial (px/s)
  accel: number; // aceleração (px/s por segundo)
  vMax: number; // teto de velocidade
  gapMin: number; // espaço mínimo entre obstáculos (px)
  gapMax: number;
  treatChance: number; // chance de soltar um petisco junto
}

const RUNNER_TUNING: Record<GameDifficulty, RunnerTier> = {
  1: { v0: 230, accel: 7, vMax: 520, gapMin: 330, gapMax: 500, treatChance: 0.5 },
  2: { v0: 290, accel: 11, vMax: 660, gapMin: 280, gapMax: 430, treatChance: 0.42 },
  3: { v0: 350, accel: 15, vMax: 820, gapMin: 230, gapMax: 360, treatChance: 0.32 },
};

type Phase = 'idle' | 'playing' | 'over';
interface Obstacle {
  id: number;
  x: number;
  emoji: string;
}
interface Treat {
  id: number;
  x: number;
  th: number; // altura do centro acima da pista
  emoji: string;
}

export default function RunnerGameScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const treatEmoji = (activePet && TREAT_BY_SPECIES[activePet.species]) || '🦴';

  const [phase, setPhase] = useState<Phase>('idle');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(2);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [treats, setTreats] = useState<Treat[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const phaseRef = useRef<Phase>('idle');
  const difficultyRef = useRef<GameDifficulty>(2);
  const sessionRef = useRef<string | null>(null);
  const areaRef = useRef({ w: 0, h: 0 });
  const treatEmojiRef = useRef('🦴');
  const idRef = useRef(0);

  const scoreRef = useRef(0);
  const distRef = useRef(0);
  const speedRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const treatPointsRef = useRef(0); // pontos de petisco (separados da distância)
  const obstaclesRef = useRef<Obstacle[]>([]);
  const treatsRef = useRef<Treat[]>([]);

  const mozartHRef = useRef(0); // altura acima da pista
  const vyRef = useRef(0); // velocidade vertical (pra cima = +)
  const groundedRef = useRef(true);
  const holdingRef = useRef(false);
  const pausedAtRef = useRef(0);
  const tickClockRef = useRef(0);

  const mozartTY = useRef(new Animated.Value(0)).current; // translateY (negativo = no ar)

  treatEmojiRef.current = treatEmoji;
  areaRef.current = area;
  difficultyRef.current = difficulty;
  const bestKey = userId ? BEST_KEY_PREFIX + userId : null;

  useEffect(() => {
    if (!bestKey) return;
    AsyncStorage.getItem(bestKey)
      .then((v) => {
        const n = v ? parseInt(v, 10) : 0;
        if (Number.isFinite(n)) setBest(n);
      })
      .catch(() => {});
  }, [bestKey]);

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

  const groundY = () => areaRef.current.h - GROUND_FROM_BOTTOM;

  const endGame = () => {
    phaseRef.current = 'over';
    setPhase('over');
    haptic.error();
    const finalScore = scoreRef.current;
    if (finalScore > best) {
      setBest(finalScore);
      if (bestKey) AsyncStorage.setItem(bestKey, String(finalScore)).catch(() => {});
    }
    if (userId && finalScore > 0) {
      submitGameScore({ game: 'runner', score: finalScore, petId: activePet?.id ?? null, userId, sessionId: sessionRef.current })
        .then(() => invalidateGameQueries(qc, 'runner'))
        .catch(() => toast.error('Não consegui salvar seu score', 'Tenta de novo daqui a pouco.'));
    }
  };

  useEffect(() => {
    const loop = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      if (pausedAtRef.current) return;
      const a = areaRef.current;
      if (a.w < 60 || a.h < 60) return;
      const dt = TICK_MS / 1000;
      const tier = RUNNER_TUNING[difficultyRef.current];
      tickClockRef.current += TICK_MS;

      // velocidade cresce
      speedRef.current = Math.min(tier.vMax, speedRef.current + tier.accel * dt);
      const v = speedRef.current;

      // física do pulo
      const g = holdingRef.current && vyRef.current > 0 ? HOLD_GRAVITY : GRAVITY;
      vyRef.current -= g * dt;
      mozartHRef.current += vyRef.current * dt;
      if (mozartHRef.current <= 0) {
        mozartHRef.current = 0;
        vyRef.current = 0;
        groundedRef.current = true;
      } else {
        groundedRef.current = false;
      }
      const bob = groundedRef.current ? Math.sin(tickClockRef.current / 90) * 3 : 0;
      mozartTY.setValue(-(mozartHRef.current + bob));

      // move obstáculos/petiscos
      const mh = mozartHRef.current;
      const mozTop = -(mh) - MOZART_H; // relativo à pista (negativo = acima)
      const mozBottom = -(mh);
      let dead = false;
      const obsSurvivors: Obstacle[] = [];
      for (const o of obstaclesRef.current) {
        const nx = o.x - v * dt;
        if (nx + OBST_W < -10) continue;
        // colisão AABB (x e y) — obstáculo fica na pista (top = -OBST_H, bottom = 0)
        const xOver = nx < MOZART_X + MOZART_W - 6 && nx + OBST_W > MOZART_X + 6;
        const yOver = mozBottom > -OBST_H + 4; // pés abaixo do topo do obstáculo
        if (xOver && yOver) dead = true;
        obsSurvivors.push({ ...o, x: nx });
      }
      const trSurvivors: Treat[] = [];
      let gotTreat = 0;
      for (const t of treatsRef.current) {
        const nx = t.x - v * dt;
        if (nx + TREAT_SIZE < -10) continue;
        const xOver = nx < MOZART_X + MOZART_W && nx + TREAT_SIZE > MOZART_X;
        const treatBottom = -(t.th) + TREAT_SIZE / 2;
        const treatTop = -(t.th) - TREAT_SIZE / 2;
        const yOver = treatBottom > mozTop && treatTop < mozBottom;
        if (xOver && yOver) {
          gotTreat += 1;
          continue;
        }
        trSurvivors.push({ ...t, x: nx });
      }

      // spawn por gap espacial (independe do framerate)
      spawnTimerRef.current -= v * dt;
      if (spawnTimerRef.current <= 0) {
        const gap = tier.gapMin + Math.random() * (tier.gapMax - tier.gapMin);
        spawnTimerRef.current = gap;
        const emoji = OBSTACLE_EMOJIS[Math.floor(Math.random() * OBSTACLE_EMOJIS.length)];
        obsSurvivors.push({ id: idRef.current++, x: a.w + 10, emoji });
        if (Math.random() < tier.treatChance) {
          // petisco numa altura alcançável pelo pulo, perto do obstáculo
          const th = 58 + Math.random() * 54;
          trSurvivors.push({ id: idRef.current++, x: a.w + 10 + OBST_W + 40 + Math.random() * 60, th, emoji: treatEmojiRef.current });
        }
      }

      obstaclesRef.current = obsSurvivors;
      treatsRef.current = trSurvivors;
      setObstacles(obsSurvivors.slice());
      setTreats(trSurvivors.slice());

      // pontuação: distância (1 pt a cada 28px) + petiscos (+8 cada)
      distRef.current += v * dt;
      if (gotTreat) {
        treatPointsRef.current += gotTreat * 8;
        haptic.light();
      }
      scoreRef.current = Math.floor(distRef.current / 28) + treatPointsRef.current;
      setScore(scoreRef.current);

      if (dead) {
        endGame();
      }
    }, TICK_MS);
    return () => clearInterval(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, userId, best]);

  const jump = () => {
    if (phaseRef.current !== 'playing') return;
    if (!groundedRef.current) return;
    vyRef.current = JUMP_V;
    groundedRef.current = false;
    holdingRef.current = true;
    haptic.light();
  };

  const start = () => {
    difficultyRef.current = difficulty;
    sessionRef.current = null;
    beginGameSession('runner', difficulty)
      .then((id) => {
        sessionRef.current = id;
      })
      .catch(() => {});
    const tier = RUNNER_TUNING[difficulty];
    speedRef.current = tier.v0;
    distRef.current = 0;
    scoreRef.current = 0;
    treatPointsRef.current = 0;
    spawnTimerRef.current = 260;
    obstaclesRef.current = [];
    treatsRef.current = [];
    mozartHRef.current = 0;
    vyRef.current = 0;
    groundedRef.current = true;
    holdingRef.current = false;
    pausedAtRef.current = 0;
    tickClockRef.current = 0;
    mozartTY.setValue(0);
    setObstacles([]);
    setTreats([]);
    setScore(0);
    setPhase('playing');
    phaseRef.current = 'playing';
    haptic.light();
  };

  // pausa quando a aba some (não trava obstáculos no retorno)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.hidden) {
        if (phaseRef.current === 'playing' && !pausedAtRef.current) pausedAtRef.current = Date.now();
      } else if (pausedAtRef.current) {
        pausedAtRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const gy = area.h - GROUND_FROM_BOTTOM;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🏃 Mozart Corre',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff', fontFamily: FONTS.display },
        }}
      />

      {/* Placar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.05)' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' }}>{score} pts</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Recorde: {best}</Text>
        </View>
        {phase === 'playing' ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Toque pra pular 🐾</Text>
        ) : null}
      </View>

      {/* Pista */}
      <View
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, margin: 12, borderRadius: 20, backgroundColor: '#BAE6FD', overflow: 'hidden' }}
      >
        {/* chão */}
        {area.h > 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: gy, bottom: 0, backgroundColor: '#86C06C' }} />
        ) : null}
        {area.h > 0 ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: gy, height: 4, backgroundColor: '#4D7C0F' }} />
        ) : null}

        {/* Mozart */}
        {area.h > 0 && phase !== 'idle' ? (
          <Animated.Image
            source={{ uri: MOZART.corpo }}
            resizeMode="contain"
            accessibilityLabel="Mozart correndo"
            style={{
              position: 'absolute',
              left: MOZART_X,
              top: gy - MOZART_H,
              width: MOZART_W,
              height: MOZART_H,
              transform: [{ translateY: mozartTY }],
            }}
          />
        ) : null}

        {/* obstáculos */}
        {obstacles.map((o) => (
          <View key={o.id} pointerEvents="none" style={{ position: 'absolute', left: o.x, top: gy - OBST_H, width: OBST_W, height: OBST_H, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: OBST_H * 0.82 }}>{o.emoji}</Text>
          </View>
        ))}
        {/* petiscos */}
        {treats.map((t) => (
          <View key={t.id} pointerEvents="none" style={{ position: 'absolute', left: t.x, top: gy - t.th - TREAT_SIZE / 2, width: TREAT_SIZE, height: TREAT_SIZE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: TREAT_SIZE * 0.8 }}>{t.emoji}</Text>
          </View>
        ))}

        {/* camada de toque (pular) */}
        {phase === 'playing' ? (
          <Pressable
            onPressIn={jump}
            onPressOut={() => {
              holdingRef.current = false;
            }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        ) : null}

        {/* telas idle / over */}
        {phase !== 'playing' ? (
          <ScrollView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 18, gap: 14, backgroundColor: 'rgba(20,14,34,0.80)' }}
          >
            <View style={{ backgroundColor: '#1E1733', borderRadius: 22, padding: 22, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
              {phase === 'over' ? (
                <>
                  <Text style={{ fontSize: 44 }}>{score >= best && score > 0 ? '🏆' : '🏃'}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FBBF24' }}>{score} pts</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                    {score >= best && score > 0 ? 'Seu novo recorde! 🎉' : `Recorde: ${best}. Corre mais e ultrapassa!`}
                  </Text>
                  <Button title="Correr de novo" onPress={start} fullWidth />
                  {score > 0 ? <GameResultShareButton game="runner" score={score} difficulty={difficulty} petName={activePet?.name} /> : null}
                </>
              ) : (
                <>
                  <Animated.Image source={{ uri: MOZART.corpo }} resizeMode="contain" style={{ width: 64, height: 64 }} accessibilityLabel="Mozart" />
                  <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>Mozart Corre</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 19 }}>
                    O Mozart corre sozinho. Toque pra pular os obstáculos {OBSTACLE_EMOJIS[0]} e pegue os {treatEmoji} no ar. Segure o toque pra pular mais alto. A velocidade só aumenta. Até onde você chega?
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Dificuldade {DIFF_META[difficulty].emoji} {DIFF_META[difficulty].label}
                  </Text>
                  <GameGradeBadge game="runner" variant="idle" />
                  <GameDifficultyPicker value={difficulty} onChange={changeDifficulty} disabled={false} />
                  <TournamentGameBanner game="runner" difficulty={difficulty} onRaiseDifficulty={changeDifficulty} />
                  <Button title="Jogar" onPress={start} fullWidth />
                </>
              )}
            </View>

            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>🏆 Ranking · Mozart Corre</Text>
            <GameLeaderboard game="runner" limit={20} currentUserId={userId} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}
