import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, ScrollView, Text, View } from 'react-native';

import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { GameResultShareButton } from '@/components/game-result-share-button';
import { PetAvatar } from '@/components/pet-avatar';
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
const ROUND_SECONDS = 30;
const TICK_MS = 50; // 20 ticks/s — queda suave dos itens
const ITEM_SIZE = 46;
const BASKET_H = 30;
const MAGNET_MS = 3800;
const DIFF_KEY = 'petsocial:game-diff:treats';

/**
 * "Cesta do Mozart" — arcade de captura. O jogador ARRASTA a cesta na base da
 * tela pra pegar os petiscos que caem, desviando das abelhas (penalidade) e
 * pegando a estrela (vale mais) e o ímã (frenesi de ouro). Combos multiplicam.
 * Reusa o slot 'treats' (rodada fixa 30s) → ZERO mudança de backend; herda
 * ranking, dificuldade, torneio, streak e o anti-cheat de sessão (piso 20s).
 */
interface CatchTier {
  spawnStart: number; // intervalo de spawn no início (ms)
  spawnEnd: number; // intervalo de spawn no fim (ms)
  fallTime: number; // tempo de queda do topo até a base (s) — quanto menor, mais rápido
  basketW: number; // largura da cesta (px) — menor = mais difícil
  badProb: number; // probabilidade da abelha
  goldProb: number; // probabilidade da estrela
  magnetProb: number; // probabilidade do ímã
  badPenalty: number; // penalidade ao pegar abelha (negativo)
}

const TREATS_TUNING: Record<GameDifficulty, CatchTier> = {
  1: { spawnStart: 1100, spawnEnd: 780, fallTime: 4.2, basketW: 132, badProb: 0.12, goldProb: 0.12, magnetProb: 0.05, badPenalty: -2 },
  2: { spawnStart: 850, spawnEnd: 560, fallTime: 3.3, basketW: 106, badProb: 0.18, goldProb: 0.11, magnetProb: 0.04, badPenalty: -3 },
  3: { spawnStart: 620, spawnEnd: 340, fallTime: 2.3, basketW: 84, badProb: 0.26, goldProb: 0.1, magnetProb: 0.03, badPenalty: -4 },
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
const MAGNET_EMOJI = '🧲';

type Phase = 'idle' | 'playing' | 'over';
type Kind = 'treat' | 'gold' | 'bad' | 'magnet';
interface GameItem {
  id: number;
  x: number;
  y: number;
  vy: number; // px por segundo
  kind: Kind;
  emoji: string;
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
  const toast = useToast();
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
  const [magnetOn, setMagnetOn] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const difficultyRef = useRef<GameDifficulty>(2);
  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const sessionRef = useRef<string | null>(null);
  const idRef = useRef(0);
  const popupIdRef = useRef(0);
  const areaRef = useRef({ w: 0, h: 0 });
  const treatRef = useRef('🍪');
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const bestRef = useRef(0);
  const itemsRef = useRef<GameItem[]>([]);
  const magnetUntilRef = useRef(0);
  const basketXRef = useRef(0); // canto esquerdo da cesta
  const basketAnim = useRef(new Animated.Value(0)).current;
  const petBounce = useRef(new Animated.Value(0)).current;
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
    setPopups((prev) => [...prev.slice(-8), { id, x, y, text, color }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 720);
  };

  const bumpPet = () => {
    petBounce.setValue(0);
    Animated.timing(petBounce, { toValue: 1, duration: 220, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
  };

  // arrasto da cesta — controla o X. box-only garante que o locationX é relativo
  // ao campo (os filhos não capturam o toque), então o arrasto nunca "trava".
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => moveBasket(e.nativeEvent.locationX),
      onPanResponderMove: (e) => moveBasket(e.nativeEvent.locationX),
    }),
  ).current;

  function moveBasket(localX: number) {
    const w = areaRef.current.w;
    const bw = TREATS_TUNING[difficultyRef.current].basketW;
    if (!w) return;
    const x = Math.max(0, Math.min(localX - bw / 2, w - bw));
    basketXRef.current = x;
    basketAnim.setValue(x);
  }

  useEffect(() => {
    const loop = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      if (pausedAtRef.current) return;
      const elapsed = Date.now() - startedAtRef.current;
      const now = Date.now();

      const remaining = Math.max(0, ROUND_SECONDS - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      const a = areaRef.current;
      const tier = TREATS_TUNING[difficultyRef.current];
      const dt = TICK_MS / 1000;
      const magActive = now < magnetUntilRef.current;
      const bw = tier.basketW;
      const basketCx = basketXRef.current + bw / 2;
      const catchPad = magActive ? 34 : 6; // ímã "atrai" (área de captura maior)

      const survivors: GameItem[] = [];
      let missed = false;
      for (const it of itemsRef.current) {
        const ny = it.y + it.vy * dt;
        const cx = it.x + ITEM_SIZE / 2;
        const cy = ny + ITEM_SIZE / 2;
        const inCatchBand = cy >= a.h - 64 && cy <= a.h - 24;
        const xHit = cx >= basketXRef.current - catchPad && cx <= basketXRef.current + bw + catchPad;
        if (inCatchBand && xHit) {
          resolveCatch({ ...it, y: ny }, magActive, now);
          continue;
        }
        if (ny > a.h) {
          if (it.kind === 'treat' || it.kind === 'gold') missed = true; // perdeu um bom = zera combo
          continue;
        }
        survivors.push({ ...it, y: ny });
      }
      if (missed && comboRef.current > 0) {
        comboRef.current = 0;
        setCombo(0);
      }
      itemsRef.current = survivors;
      setMagnetOn(magActive);

      // spawn
      if (a.w > 60 && a.h > 60 && elapsed - lastSpawnRef.current >= spawnInterval(elapsed, difficultyRef.current)) {
        lastSpawnRef.current = elapsed;
        const r = Math.random();
        let kind: Kind = 'treat';
        if (r < tier.badProb) kind = 'bad';
        else if (r < tier.badProb + tier.goldProb) kind = 'gold';
        else if (r < tier.badProb + tier.goldProb + tier.magnetProb) kind = 'magnet';
        const emoji = kind === 'bad' ? BAD_EMOJI : kind === 'gold' ? GOLD_EMOJI : kind === 'magnet' ? MAGNET_EMOJI : treatRef.current;
        itemsRef.current = [
          ...itemsRef.current,
          { id: idRef.current++, x: Math.random() * (a.w - ITEM_SIZE), y: -ITEM_SIZE, vy: a.h / tier.fallTime, kind, emoji },
        ];
      }
      setItems(itemsRef.current.slice());

      if (remaining <= 0) {
        phaseRef.current = 'over';
        setPhase('over');
        itemsRef.current = [];
        setItems([]);
        magnetUntilRef.current = 0;
        setMagnetOn(false);
        const finalScore = scoreRef.current;
        if (finalScore > bestRef.current) {
          setBest(finalScore);
          if (bestKey) AsyncStorage.setItem(bestKey, String(finalScore)).catch(() => {});
        }
        if (userId && finalScore > 0) {
          submitGameScore({ game: 'treats', score: finalScore, petId, userId, sessionId: sessionRef.current })
            .then(() => invalidateGameQueries(qc, 'treats'))
            .catch(() => toast.error('Não consegui salvar seu score', 'Tenta de novo daqui a pouco.'));
        }
      }
    }, TICK_MS);
    return () => clearInterval(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, userId, petId]);

  function resolveCatch(item: GameItem, magActive: boolean, now: number) {
    haptic.light();
    if (item.kind === 'bad') {
      comboRef.current = 0;
      setCombo(0);
      const penalty = TREATS_TUNING[difficultyRef.current].badPenalty;
      scoreRef.current = Math.max(0, scoreRef.current + penalty);
      setScore(scoreRef.current);
      addPopup(item.x, item.y, String(penalty), '#F87171');
      return;
    }
    comboRef.current += 1;
    setCombo(comboRef.current);
    if (item.kind === 'magnet') {
      magnetUntilRef.current = now + MAGNET_MS;
      addPopup(item.x, item.y, 'Ímã! 🧲', '#C4B5FD');
      bumpPet();
      return;
    }
    const isGoldValue = item.kind === 'gold' || magActive;
    const base = isGoldValue ? 5 : 1;
    const mult = 1 + 0.5 * Math.min(comboRef.current, 10);
    const gain = Math.round(base * mult);
    scoreRef.current += gain;
    setScore(scoreRef.current);
    addPopup(item.x, item.y, `+${gain}`, isGoldValue ? '#FBBF24' : '#4ADE80');
    if (comboRef.current >= 3) bumpPet();
    if (comboRef.current > 0 && comboRef.current % 5 === 0) haptic.success();
  }

  const start = () => {
    difficultyRef.current = difficulty;
    sessionRef.current = null;
    beginGameSession('treats', difficulty)
      .then((id) => {
        sessionRef.current = id;
      })
      .catch(() => {});
    startedAtRef.current = Date.now();
    pausedAtRef.current = 0;
    lastSpawnRef.current = 0;
    scoreRef.current = 0;
    comboRef.current = 0;
    itemsRef.current = [];
    magnetUntilRef.current = 0;
    const center = Math.max(0, (areaRef.current.w - TREATS_TUNING[difficulty].basketW) / 2);
    basketXRef.current = center;
    basketAnim.setValue(center);
    setScore(0);
    setCombo(0);
    setMagnetOn(false);
    setTimeLeft(ROUND_SECONDS);
    setItems([]);
    setPopups([]);
    setPhase('playing');
    phaseRef.current = 'playing';
    haptic.light();
  };

  // pausa a rodada quando a aba vai pro background (não queima o cronômetro)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVis = () => {
      if (document.hidden) {
        if (phaseRef.current === 'playing' && !pausedAtRef.current) pausedAtRef.current = Date.now();
      } else if (pausedAtRef.current) {
        const delta = Date.now() - pausedAtRef.current;
        startedAtRef.current += delta;
        if (magnetUntilRef.current) magnetUntilRef.current += delta;
        pausedAtRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const fieldBg = combo >= 8 ? '#EDE9FE' : combo >= 3 ? '#FEF3C7' : '#D1FAE5';
  const basketW = TREATS_TUNING[difficulty].basketW;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🧺 Cesta do Mozart',
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
            {magnetOn && phase === 'playing' ? '  ·  🧲 ímã!' : ''}
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
        {...(phase === 'playing' ? pan.panHandlers : {})}
        pointerEvents={phase === 'playing' ? 'box-only' : 'auto'}
        style={{ flex: 1, margin: 12, borderRadius: 20, backgroundColor: fieldBg, overflow: 'hidden' }}
      >
        {items.map((item) => (
          <CatchItem key={item.id} item={item} />
        ))}
        {popups.map((p) => (
          <PopupText key={p.id} popup={p} />
        ))}

        {/* cesta (só durante a partida) */}
        {phase === 'playing' ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 0,
              width: basketW,
              alignItems: 'center',
              transform: [{ translateX: basketAnim }],
            }}
          >
            <Animated.Image
              source={{ uri: MOZART.rosto }}
              resizeMode="contain"
              accessibilityLabel="Mozart"
              style={{
                width: 46,
                height: 46,
                marginBottom: -6,
                transform: [
                  { translateY: petBounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }) },
                  { scale: petBounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) },
                ],
              }}
            />
            <View
              style={{
                width: basketW,
                height: BASKET_H,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                backgroundColor: magnetOn ? '#C4B5FD' : '#F59E0B',
                borderWidth: 3,
                borderColor: magnetOn ? '#8B5CF6' : '#B45309',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16 }}>{magnetOn ? '🧲' : '🧺'}</Text>
            </View>
          </Animated.View>
        ) : null}

        {phase !== 'playing' ? (
          <ScrollView
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 18, gap: 14, backgroundColor: 'rgba(20,14,34,0.80)' }}
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
                  <Text style={{ fontSize: 44 }}>{score >= best && score > 0 ? '🏆' : '🧺'}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: '#FBBF24' }}>{score} pts</Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                    {score >= best && score > 0
                      ? 'Seu novo recorde! 🎉'
                      : `Recorde: ${best}. Bora bater e subir no ranking?`}
                  </Text>
                  <Button title="Jogar de novo" onPress={start} fullWidth />
                  {score > 0 ? (
                    <GameResultShareButton game="treats" score={score} difficulty={difficulty} petName={activePet?.name} />
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 44 }}>🧺</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff', textAlign: 'center' }}>
                    Cesta do Mozart
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 19 }}>
                    Arraste a cesta na base pra {activePet?.name ?? 'seu pet'} pegar os {treat} que caem. Emende capturas pra fazer 🔥 combo (multiplica os pontos), pegue a {GOLD_EMOJI} (vale mais) e o {MAGNET_EMOJI} (tudo vira ouro!), e fuja da abelha {BAD_EMOJI}. {ROUND_SECONDS}s!
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                    Dificuldade {DIFF_META[difficulty].emoji} {DIFF_META[difficulty].label} · cesta {difficulty === 1 ? 'larga' : difficulty === 3 ? 'estreita' : 'média'}
                  </Text>
                  <GameGradeBadge game="treats" variant="idle" />
                  <GameDifficultyPicker value={difficulty} onChange={changeDifficulty} disabled={false} />
                  <TournamentGameBanner game="treats" difficulty={difficulty} onRaiseDifficulty={changeDifficulty} />
                  <Button title="Jogar" onPress={start} fullWidth />
                </>
              )}
            </View>

            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              🏆 Ranking · Cesta do Mozart
            </Text>
            <GameLeaderboard game="treats" limit={20} currentUserId={userId} />
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

function CatchItem({ item }: { item: GameItem }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [scale]);
  const bg = item.kind === 'bad' ? '#FECACA' : item.kind === 'gold' ? '#FEF3C7' : item.kind === 'magnet' ? '#EDE9FE' : '#FFFFFF';
  const border = item.kind === 'bad' ? '#F87171' : item.kind === 'gold' ? '#FBBF24' : item.kind === 'magnet' ? '#A78BFA' : '#FDE68A';
  const glow = item.kind === 'gold' || item.kind === 'magnet';
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: item.x, top: item.y, transform: [{ scale }] }}>
      <View
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          borderRadius: ITEM_SIZE / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: glow ? 3 : 2,
          borderColor: border,
          shadowColor: glow ? border : '#000',
          shadowOpacity: glow ? 0.55 : 0.18,
          shadowRadius: glow ? 7 : 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: ITEM_SIZE * 0.54 }}>{item.emoji}</Text>
      </View>
    </Animated.View>
  );
}

function PopupText({ popup }: { popup: Popup }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [t]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: popup.x,
        top: popup.y,
        width: 80,
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
