import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GameLeaderboard } from '@/components/game-leaderboard';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { qkGames, submitGameScore } from '@/lib/games';
import { pickQuizQuestions, type QuizQuestion } from '@/lib/pet-quiz';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const BG = '#140E22';
const N = 10;

type Phase = 'idle' | 'playing' | 'over';

export default function PetQuizScreen() {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const [phase, setPhase] = useState<Phase>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const startRef = useRef(0);

  const start = () => {
    setQuestions(pickQuizQuestions(N));
    setIndex(0);
    setScore(0);
    setPicked(null);
    setPhase('playing');
    startRef.current = Date.now();
    haptic.light();
  };

  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === questions[index].answer;
    if (correct) {
      const secs = (Date.now() - startRef.current) / 1000;
      const bonus = Math.max(0, Math.round(6 - secs));
      setScore((s) => s + 10 + bonus);
      haptic.light();
    } else {
      haptic.light();
    }
  };

  const next = () => {
    if (index + 1 >= questions.length) {
      setPhase('over');
      const finalScore = score; // já acumulado
      if (userId && finalScore > 0) {
        submitGameScore({ game: 'quiz', score: finalScore, petId: activePet?.id ?? null, userId })
          .then(() => qc.invalidateQueries({ queryKey: qkGames.leaderboard('quiz') }))
          .catch(() => {});
      }
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
      startRef.current = Date.now();
    }
  };

  const q = questions[index];

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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        {phase === 'idle' ? (
          <>
            <Card>
              <Text style={{ fontSize: 48, textAlign: 'center' }}>🧠</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: '#fff', textAlign: 'center' }}>Quiz Pet</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 20 }}>
                {N} perguntas de conhecimentos gerais sobre cães, gatos e companhia. Acerte rápido pra ganhar bônus de tempo e subir no ranking! 🏆
              </Text>
              <Button title="Começar" onPress={start} fullWidth />
            </Card>
            <SectionTitle>🏆 Ranking · Quiz Pet</SectionTitle>
            <GameLeaderboard game="quiz" limit={20} currentUserId={userId} />
          </>
        ) : null}

        {phase === 'playing' && q ? (
          <>
            {/* progresso */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                Pergunta {index + 1}/{questions.length}
              </Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FBBF24' }}>{score} pts</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
              <View style={{ width: `${((index) / questions.length) * 100}%`, height: 6, backgroundColor: '#FBBF24' }} />
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
                  {picked === q.answer ? 'Acertou! 🎉' : 'Quase! A resposta certa está em verde.'}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>
                  {q.explain}
                </Text>
                <Button title={index + 1 >= questions.length ? 'Ver resultado' : 'Próxima'} onPress={next} fullWidth />
              </Card>
            ) : null}
          </>
        ) : null}

        {phase === 'over' ? (
          <>
            <Card>
              <Text style={{ fontSize: 48, textAlign: 'center' }}>{score >= N * 12 ? '🏆' : score >= N * 8 ? '🎉' : '🐾'}</Text>
              <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: '#FBBF24', textAlign: 'center' }}>{score} pts</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', textAlign: 'center' }}>
                {score >= N * 12 ? 'Fera dos pets! 🧠✨' : score >= N * 8 ? 'Muito bem! Bora pro topo do ranking.' : 'Joga de novo pra subir no ranking!'}
              </Text>
              <Button title="Jogar de novo" onPress={start} fullWidth />
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
  return (
    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>{children}</Text>
  );
}
