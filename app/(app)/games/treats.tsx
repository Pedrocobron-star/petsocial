import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';

import { GameLeaderboard } from '@/components/game-leaderboard';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { qkGames, submitGameScore } from '@/lib/games';
import { haptic } from '@/lib/haptics';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const BG = '#140E22';
const ROUND_SECONDS = 30;
const TICK_MS = 100;
const ITEM_TTL = 1300;
const ITEM_SIZE = 58;

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

function spawnInterval(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / (ROUND_SECONDS * 1000));
  return Math.round(820 - t * 360);
}

export default function TreatsGameScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const treat = (activePet && TREAT_BY_SPECIES[activePet.species]) || '🍪';

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [best, setBest] = useState(0);
  const [items, setItems] = useState<GameItem[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const phaseRef = useRef<Phase>('idle');
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

  const petId = activePet?.id ?? null;
  const bestKey = petId ? `petsocial:game-best:${petId}` : null;
  useEffect(() => {
    if (!bestKey) return;
    AsyncStorage.getItem(bestKey)
      .then((v) => {
        const n = v ? parseInt(v, 10) : 0;
        if (Number.isFinite(n)) setBest(n);
      })
      .catch(() => {});
  }, [bestKey]);

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
      if (a.w > 60 && a.h > 60 && elapsed - lastSpawnRef.current >= spawnInterval(elapsed)) {
        lastSpawnRef.current = elapsed;
        const r = Math.random();
        const kind: Kind = r < 0.16 ? 'bad' : r < 0.27 ? 'gold' : 'treat';
        const emoji = kind === 'bad' ? BAD_EMOJI : kind === 'gold' ? GOLD_EMOJI : treatRef.current;
        itemsRef.current = [
          ...itemsRef.current,
          {
            id: idRef.current++,
            x: Math.random() * (a.w - ITEM_SIZE),
            y: Math.random() * (a.h - ITEM_SIZE),
            kind,
            emoji,
            expiresAt: elapsed + ITEM_TTL,
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
          submitGameScore({ game: 'treats', score: finalScore, petId, userId })
            .then(() => qc.invalidateQueries({ queryKey: qkGames.leaderboard('treats') }))
            .catch(() => {});
        }
      }
    }, TICK_MS);
    return () => clearInterval(loop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bestKey, userId, petId]);

  const start = () => {
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
      scoreRef.current = Math.max(0, scoreRef.current - 3);
      setScore(scoreRef.current);
      addPopup(item.x, item.y, '-3', '#F87171');
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
                      ? `Novo recorde d${activePet && activePet.name.endsWith('a') ? 'a' : 'o'} ${activePet?.name ?? 'pet'}! 🎉`
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
                    Toque nos {treat} pra {activePet?.name ?? 'seu pet'} comer. Encadeie pra fazer 🔥 combo, pegue a {GOLD_EMOJI} dourada (vale mais) e fuja da abelha {BAD_EMOJI} (−3). {ROUND_SECONDS}s!
                  </Text>
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
