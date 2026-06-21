import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GameDifficultyPicker } from '@/components/game-difficulty-picker';
import { GameGradeBadge } from '@/components/game-grade-badge';
import { GameLeaderboard } from '@/components/game-leaderboard';
import { GameResultShareButton } from '@/components/game-result-share-button';
import { TournamentGameBanner } from '@/components/tournament-game-banner';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { beginGameSession, invalidateGameQueries, submitGameScore, type GameDifficulty } from '@/lib/games';
import { pickQuizQuestions, type QuizQuestion } from '@/lib/pet-quiz';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

const BG = '#140E22';
const DIFF_KEY = 'petsocial:game-diff:quiz';
const REVEAL_MS = 1700; // tempo mostrando o resultado antes de auto-avançar

/** Parâmetros por tier: nº de perguntas + tempo por pergunta (ms). */
const DIFF_PARAMS: Record<GameDifficulty, { questions: number; qtime: number }> = {
  1: { questions: 8, qtime: 11000 },
  2: { questions: 10, qtime: 8500 },
  3: { questions: 12, qtime: 6500 },
};

const TIMEOUT = -1; // "picked" quando o tempo esgota

type Phase = 'idle' | 'playing' | 'over';

export default function PetQuizScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const [phase, setPhase] = useState<Phase>('idle');
  const [difficulty, setDifficulty] = useState<GameDifficulty>(2);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [flash, setFlash] = useState<'correct' | 'wrong' | null>(null);

  const phaseRef = useRef<Phase>('idle');
  const indexRef = useRef(0);
  const pickedRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const qtimeRef = useRef(DIFF_PARAMS[2].qtime);
  const comboRef = useRef(0);
  const bestComboRef = useRef(0);
  const scoreRef = useRef(0);
  const questionsRef = useRef<QuizQuestion[]>([]);
  const sessionRef = useRef<string | null>(null);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DIFF_KEY)
      .then((v) => {
        const n = v ? parseInt(v, 10) : NaN;
        if (n === 1 || n === 2 || n === 3) setDifficulty(n);
      })
      .catch(() => {});
  }, []);

  const onChangeDifficulty = (d: GameDifficulty) => {
    setDifficulty(d);
    AsyncStorage.setItem(DIFF_KEY, String(d)).catch(() => {});
  };

  const params = DIFF_PARAMS[difficulty];

  const doFlash = (kind: 'correct' | 'wrong') => {
    setFlash(kind);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlash(null), 420);
  };

  // cronômetro por pergunta (também dispara o "tempo esgotou")
  useEffect(() => {
    const iv = setInterval(() => {
      if (phaseRef.current !== 'playing') return;
      if (pickedRef.current !== null) return;
      const left = Math.max(0, qtimeRef.current - (Date.now() - startRef.current));
      setTimeLeft(left);
      if (left <= 0) handleAnswer(TIMEOUT);
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
      if (flashRef.current) clearTimeout(flashRef.current);
    };
  }, []);

  function handleAnswer(i: number) {
    if (pickedRef.current !== null) return;
    pickedRef.current = i;
    setPicked(i);
    const q = questionsRef.current[indexRef.current];
    const correct = i === q.answer;
    if (correct) {
      const secsLeft = Math.max(0, (qtimeRef.current - (Date.now() - startRef.current)) / 1000);
      const timeBonus = Math.round(Math.min(8, secsLeft));
      comboRef.current += 1;
      if (comboRef.current > bestComboRef.current) {
        bestComboRef.current = comboRef.current;
        setBestCombo(comboRef.current);
      }
      const streakBonus = Math.min(comboRef.current, 8);
      const gain = 10 + timeBonus + streakBonus;
      scoreRef.current += gain;
      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setLastGain(gain);
      doFlash('correct');
      haptic.success();
    } else {
      comboRef.current = 0;
      setCombo(0);
      setLastGain(0);
      doFlash('wrong');
      haptic.error();
    }
    advanceRef.current = setTimeout(advance, REVEAL_MS);
  }

  function advance() {
    if (advanceRef.current) clearTimeout(advanceRef.current);
    if (indexRef.current + 1 >= questionsRef.current.length) {
      phaseRef.current = 'over';
      setPhase('over');
      const finalScore = scoreRef.current;
      if (userId && finalScore > 0) {
        submitGameScore({ game: 'quiz', score: finalScore, petId: activePet?.id ?? null, userId, sessionId: sessionRef.current })
          .then(() => invalidateGameQueries(qc, 'quiz'))
          .catch(() => toast.error('Não consegui salvar seu score', 'Tenta de novo daqui a pouco.'));
      }
      return;
    }
    indexRef.current += 1;
    setIndex(indexRef.current);
    pickedRef.current = null;
    setPicked(null);
    startRef.current = Date.now();
    setTimeLeft(qtimeRef.current);
  }

  const start = () => {
    qtimeRef.current = DIFF_PARAMS[difficulty].qtime;
    sessionRef.current = null;
    beginGameSession('quiz', difficulty)
      .then((id) => {
        sessionRef.current = id;
      })
      .catch(() => {});
    const qs = pickQuizQuestions(DIFF_PARAMS[difficulty].questions);
    questionsRef.current = qs;
    setQuestions(qs);
    indexRef.current = 0;
    setIndex(0);
    scoreRef.current = 0;
    setScore(0);
    comboRef.current = 0;
    setCombo(0);
    bestComboRef.current = 0;
    setBestCombo(0);
    pickedRef.current = null;
    setPicked(null);
    setLastGain(0);
    setFlash(null);
    startRef.current = Date.now();
    setTimeLeft(qtimeRef.current);
    setPhase('playing');
    phaseRef.current = 'playing';
    haptic.light();
  };

  const choose = (i: number) => handleAnswer(i);

  const q = questions[index];
  const timeFrac = q && picked === null ? Math.max(0, Math.min(1, timeLeft / qtimeRef.current)) : picked === null ? 1 : 0;
  const lowTime = timeFrac < 0.3;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <Stack.Screen
        options={{
          title: '🧠 Quiz Pet',
          headerShown: true,
          headerStyle: { backgroundColor: BG },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff', fontFamily: FONTS.display },
        }}
      />
      {/* flash de acerto/erro */}
      {flash ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
            backgroundColor: flash === 'correct' ? 'rgba(34,197,94,0.18)' : 'rgba(239,68,68,0.18)',
          }}
        />
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        {phase === 'idle' ? (
          <>
            <Card>
              <Text style={{ fontSize: 48, textAlign: 'center' }}>🧠</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: '#fff', textAlign: 'center' }}>Quiz Pet</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 }}>
                {params.questions} perguntas sobre cães, gatos e companhia. Corra contra o relógio ⏱️ de cada pergunta e emende acertos pra acender o 🔥 combo (cada acerto seguido vale mais). Não dá pra vacilar!
              </Text>
              <GameGradeBadge game="quiz" variant="idle" />
              <GameDifficultyPicker value={difficulty} onChange={onChangeDifficulty} disabled={false} />
              <TournamentGameBanner game="quiz" difficulty={difficulty} onRaiseDifficulty={onChangeDifficulty} />
              <Button title="Começar" onPress={start} fullWidth />
            </Card>
            <SectionTitle>🏆 Ranking · Quiz Pet</SectionTitle>
            <GameLeaderboard game="quiz" limit={20} currentUserId={userId} />
          </>
        ) : null}

        {phase === 'playing' && q ? (
          <>
            {/* progresso + score + combo */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Pergunta {index + 1}/{questions.length}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {combo >= 2 ? (
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FB923C' }}>🔥 x{combo}</Text>
                ) : null}
                <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{score} pts</Text>
              </View>
            </View>
            {/* barra de progresso das perguntas */}
            <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <View style={{ width: `${((index + 1) / questions.length) * 100}%`, height: 5, backgroundColor: '#FBBF24' }} />
            </View>

            {/* cronômetro da pergunta */}
            <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
              <View
                style={{
                  width: `${timeFrac * 100}%`,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: lowTime ? '#EF4444' : timeFrac < 0.6 ? '#FBBF24' : '#22C55E',
                }}
              />
            </View>

            <Card>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 17, color: '#fff', lineHeight: 24 }}>{q.q}</Text>
            </Card>

            <View style={{ gap: 10 }}>
              {q.options.map((opt, i) => {
                const isAnswer = i === q.answer;
                const isPicked = picked === i;
                let bg = 'rgba(255,255,255,0.08)';
                let border = 'rgba(255,255,255,0.15)';
                if (picked !== null) {
                  if (isAnswer) {
                    bg = 'rgba(34,197,94,0.25)';
                    border = '#22C55E';
                  } else if (isPicked) {
                    bg = 'rgba(239,68,68,0.22)';
                    border = '#EF4444';
                  }
                }
                return (
                  <Pressable
                    key={i}
                    onPress={() => choose(i)}
                    disabled={picked !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Resposta: ${opt}`}
                    accessibilityState={{ disabled: picked !== null, selected: isPicked }}
                    style={{
                      backgroundColor: bg,
                      borderWidth: 1.5,
                      borderColor: border,
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Text style={{ flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14.5, color: '#fff' }}>{opt}</Text>
                    {picked !== null && isAnswer ? <Ionicons name="checkmark-circle" size={20} color="#22C55E" /> : null}
                    {picked !== null && isPicked && !isAnswer ? <Ionicons name="close-circle" size={20} color="#EF4444" /> : null}
                  </Pressable>
                );
              })}
            </View>

            {picked !== null ? (
              <Card>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: picked === q.answer ? '#4ADE80' : '#FCA5A5' }}>
                  {picked === q.answer
                    ? `Acertou! +${lastGain}${combo >= 2 ? `  ·  🔥 combo x${combo}` : ''}`
                    : picked === TIMEOUT
                      ? 'Tempo esgotado! A resposta certa está em verde.'
                      : 'Quase! A resposta certa está em verde.'}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>{q.explain}</Text>
                <Pressable onPress={advance} style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FBBF24' }}>
                    {index + 1 >= questions.length ? 'Ver resultado' : 'Próxima'}
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#FBBF24" />
                </Pressable>
              </Card>
            ) : null}
          </>
        ) : null}

        {phase === 'over' ? (
          <>
            <Card>
              <Text style={{ fontSize: 48, textAlign: 'center' }}>{score >= params.questions * 22 ? '🏆' : score >= params.questions * 15 ? '🎉' : '🐾'}</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: '#FBBF24', textAlign: 'center' }}>{score} pts</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                {bestCombo >= 2 ? `Melhor sequência: 🔥 x${bestCombo}. ` : ''}
                {score >= params.questions * 22 ? 'Fera dos pets! 🧠✨' : score >= params.questions * 15 ? 'Muito bem! Bora pro topo do ranking.' : 'Joga de novo pra subir no ranking!'}
              </Text>
              <Button title="Jogar de novo" onPress={start} fullWidth />
              {score > 0 ? <GameResultShareButton game="quiz" score={score} difficulty={difficulty} petName={activePet?.name} /> : null}
            </Card>
            <SectionTitle>🏆 Ranking · Quiz Pet</SectionTitle>
            <GameLeaderboard game="quiz" limit={20} currentUserId={userId} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: 18,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
      }}
    >
      {children}
    </View>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{children}</Text>;
}
