import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { fetchPet, qk } from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

const ROUND_SECONDS = 30;
const TICK_MS = 100;
const ITEM_TTL = 1300;
const ITEM_SIZE = 58;

/** Petisco favorito por espécie (personalização). */
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
const BAD_EMOJI = '🐝'; // não toque na abelha!

type Phase = 'idle' | 'playing' | 'over';
interface GameItem {
  id: number;
  x: number;
  y: number;
  kind: 'treat' | 'bad';
  emoji: string;
  expiresAt: number;
}

function spawnInterval(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / (ROUND_SECONDS * 1000));
  return Math.round(820 - t * 360); // 820ms → 460ms (acelera)
}

export default function PetGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const pet = petQuery.data;
  const treat = (pet && TREAT_BY_SPECIES[pet.species]) || '🍪';

  const [phase, setPhase] = useState<Phase>('idle');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [best, setBest] = useState(0);
  const [items, setItems] = useState<GameItem[]>([]);
  const [area, setArea] = useState({ w: 0, h: 0 });

  // refs do "motor" (evita stale closures no loop)
  const phaseRef = useRef<Phase>('idle');
  const elapsedRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const idRef = useRef(0);
  const areaRef = useRef({ w: 0, h: 0 });
  const treatRef = useRef('🍪');
  const scoreRef = useRef(0);
  const bestRef = useRef(0);
  treatRef.current = treat;
  areaRef.current = area;
  scoreRef.current = score;
  bestRef.current = best;

  const bestKey = id ? `petsocial:game-best:${id}` : null;
  useEffect(() => {
    if (!bestKey) return;
    AsyncStorage.getItem(bestKey)
      .then((v) => {
        const n = v ? parseInt(v, 10) : 0;
        if (Number.isFinite(n)) setBest(n);
      })
      .catch(() => {});
  }, [bestKey]);

  // Loop principal
  useEffect(() => {
    const loop = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      elapsedRef.current += TICK_MS;
      const elapsed = elapsedRef.current;

      // tempo
      const remaining = Math.max(0, ROUND_SECONDS - Math.floor(elapsed / 1000));
      setTimeLeft(remaining);

      // expira itens não pegos
      setItems((prev) => prev.filter((it) => it.expiresAt > elapsed));

      // spawn
      const a = areaRef.current;
      if (a.w > 60 && a.h > 60 && elapsed - lastSpawnRef.current >= spawnInterval(elapsed)) {
        lastSpawnRef.current = elapsed;
        const isBad = Math.random() < 0.18;
        const item: GameItem = {
          id: idRef.current++,
          x: Math.random() * (a.w - ITEM_SIZE),
          y: Math.random() * (a.h - ITEM_SIZE),
          kind: isBad ? 'bad' : 'treat',
          emoji: isBad ? BAD_EMOJI : treatRef.current,
          expiresAt: elapsed + ITEM_TTL,
        };
        setItems((prev) => [...prev, item]);
      }

      // fim
      if (remaining <= 0) {
        phaseRef.current = 'over';
        setPhase('over');
        setItems([]);
        const finalScore = scoreRef.current;
        if (finalScore > bestRef.current) {
          setBest(finalScore);
          if (bestKey) AsyncStorage.setItem(bestKey, String(finalScore)).catch(() => {});
        }
      }
    }, TICK_MS);
    return () => clearInterval(loop);
  }, [bestKey]);

  const start = () => {
    elapsedRef.current = 0;
    lastSpawnRef.current = 0;
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setItems([]);
    setPhase('playing');
    phaseRef.current = 'playing';
    haptic.light();
  };

  const tapItem = (item: GameItem) => {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (item.kind === 'bad') {
      haptic.light();
      setScore((s) => Math.max(0, s - 2));
    } else {
      haptic.light();
      setScore((s) => s + 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: pet ? `Pega o Petisco — ${pet.name}` : 'Joguinho', headerShown: true }} />

      {/* Placar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
        }}
      >
        {pet ? <PetAvatar pet={pet} size={42} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
            {treat} {score} {score === 1 ? 'petisco' : 'petiscos'}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            Recorde: {best}
          </Text>
        </View>
        <View style={{ alignItems: 'center', minWidth: 54 }}>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 22,
              color: timeLeft <= 5 && phase === 'playing' ? '#EF4444' : theme.brand,
            }}
          >
            {timeLeft}s
          </Text>
        </View>
      </View>

      {/* Campo de jogo */}
      <View
        onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        style={{ flex: 1, margin: 12, borderRadius: 20, backgroundColor: '#D1FAE5', overflow: 'hidden' }}
      >
        {items.map((item) => (
          <TreatItem key={item.id} item={item} onTap={tapItem} />
        ))}

        {/* Overlay idle / over */}
        {phase !== 'playing' ? (
          <View
            style={{
              ...StyleSheetAbsolute,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 28,
              backgroundColor: 'rgba(255,255,255,0.55)',
            }}
          >
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 24,
                padding: 24,
                alignItems: 'center',
                gap: 10,
                maxWidth: 320,
                width: '100%',
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              {phase === 'over' ? (
                <>
                  <Text style={{ fontSize: 44 }}>{score > best || score === best ? '🏆' : treat}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: theme.text }}>
                    {score} {score === 1 ? 'petisco' : 'petiscos'}!
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, textAlign: 'center' }}>
                    {score >= best && score > 0
                      ? `Novo recorde d${pet && pet.name.endsWith('a') ? 'a' : 'o'} ${pet?.name ?? 'pet'}! 🎉`
                      : `Recorde: ${best}. Bora bater?`}
                  </Text>
                  <Button title="Jogar de novo" onPress={start} fullWidth />
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 44 }}>{treat}</Text>
                  <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.text, textAlign: 'center' }}>
                    Pega o Petisco
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, textAlign: 'center', lineHeight: 19 }}>
                    Toque nos {treat} pra {pet?.name ?? 'seu pet'} comer. Cuidado com a abelha {BAD_EMOJI} (–2)! Você tem {ROUND_SECONDS}s.
                  </Text>
                  <Button title="Jogar" onPress={start} fullWidth />
                </>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const StyleSheetAbsolute = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

function TreatItem({ item, onTap }: { item: GameItem; onTap: (item: GameItem) => void }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }).start();
  }, [scale]);
  const bad = item.kind === 'bad';
  return (
    <Animated.View style={{ position: 'absolute', left: item.x, top: item.y, transform: [{ scale }] }}>
      <Pressable
        onPress={() => onTap(item)}
        hitSlop={6}
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          borderRadius: ITEM_SIZE / 2,
          backgroundColor: bad ? '#FECACA' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: bad ? '#F87171' : '#FDE68A',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        <Text style={{ fontSize: ITEM_SIZE * 0.52 }}>{item.emoji}</Text>
      </Pressable>
    </Animated.View>
  );
}
