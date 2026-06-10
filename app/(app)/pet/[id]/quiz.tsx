import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight } from 'react-native-reanimated';

import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { calculateResult, QUIZ_QUESTIONS } from '@/lib/personality-quiz';
import { fetchPet, qk, savePersonality } from '@/lib/queries';
import { petUrl } from '@/lib/share';
import { PERSONALITIES, type PersonalityType } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function QuizScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PersonalityType | null>(null);

  const saveMut = useMutation({
    mutationFn: (type: PersonalityType) => savePersonality(id, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.pet(id) });
    },
  });

  const pet = petQuery.data;
  const totalSteps = QUIZ_QUESTIONS.length;

  const onAnswer = (optionIdx: number) => {
    const q = QUIZ_QUESTIONS[step];
    const newAnswers = { ...answers, [q.id]: optionIdx };
    setAnswers(newAnswers);
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      const winner = calculateResult(newAnswers);
      setResult(winner);
      saveMut.mutate(winner);
    }
  };

  if (!pet) return null;

  // Resultado
  if (result) {
    const info = PERSONALITIES[result];
    const onShare = async () => {
      try {
        await Share.share({
          title: `${pet.name} é ${info.title}!`,
          message: `${info.emoji} ${pet.name} é um pet ${info.title}!\n"${info.description}"\n\nDescubra a personalidade do seu pet no Maestro Pet:\n${petUrl(pet.id)}`,
        });
      } catch (e) {
        toast.error('Não foi possível compartilhar', e instanceof Error ? e.message : '');
      }
    };

    const onRetake = () => {
      setResult(null);
      setAnswers({});
      setStep(0);
    };

    return (
      <View style={{ flex: 1, backgroundColor: info.bgColor }}>
        <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: info.color }} />
        <ScrollView contentContainerStyle={{ flex: 1, padding: 22, paddingTop: 80, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', gap: 16 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.6,
                color: info.color,
                textTransform: 'uppercase',
                opacity: 0.6,
              }}
            >
              Personalidade descoberta
            </Text>
            <Text style={{ fontSize: 96 }}>{info.emoji}</Text>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 36,
                  color: info.color,
                  textAlign: 'center',
                }}
              >
                {pet.name} é
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 42,
                  color: info.color,
                  textAlign: 'center',
                }}
              >
                {info.title}!
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 18,
                maxWidth: 340,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 15,
                  color: '#1A1410',
                  textAlign: 'center',
                  lineHeight: 22,
                }}
              >
                &ldquo;{info.description}&rdquo;
              </Text>
            </View>

            <View style={{ marginTop: 12, alignItems: 'center', gap: 6 }}>
              <PetAvatar pet={pet} size={88} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: info.color }}>
                {pet.name}
              </Text>
            </View>

            <View style={{ width: 280, marginTop: 16, gap: 8 }}>
              <Pressable
                onPress={onShare}
                style={{
                  backgroundColor: info.color,
                  borderRadius: 999,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="share-outline" size={18} color="#fff" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                  Compartilhar resultado
                </Text>
              </Pressable>
              <Pressable
                onPress={onRetake}
                style={{
                  paddingVertical: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="refresh" size={14} color={info.color} />
                <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: info.color }}>
                  Refazer quiz
                </Text>
              </Pressable>
              <Button title="Voltar pro perfil" variant="secondary" onPress={() => router.back()} fullWidth />
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // Tela inicial
  if (!started) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFF7ED' }}>
        <Stack.Screen options={{ title: 'Quiz de personalidade', headerShown: true }} />
        <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 30 }}>
          <View style={{ alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <Text style={{ fontSize: 72 }}>🧠</Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 28,
                color: '#9A3412',
                textAlign: 'center',
              }}
            >
              Quem é {pet.name}?
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: '#9A3412',
                textAlign: 'center',
                opacity: 0.85,
                lineHeight: 20,
              }}
            >
              10 perguntas rápidas pra descobrir a personalidade verdadeira do seu pet.
              No final, você ganha um card pra compartilhar!
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {(Object.values(PERSONALITIES) as { type: PersonalityType; emoji: string; title: string }[]).map(
              (p) => (
                <View
                  key={p.type}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    backgroundColor: '#fff',
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{p.emoji}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
                    {p.title}
                  </Text>
                </View>
              ),
            )}
          </View>

          <View style={{ marginTop: 22 }}>
            <Button
              title="Começar quiz 🚀"
              onPress={() => {
                setStep(0);
                setAnswers({});
                setResult(null);
                setStarted(true);
              }}
              fullWidth
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  // Pergunta atual
  const q = QUIZ_QUESTIONS[step];
  return (
    <View style={{ flex: 1, backgroundColor: '#FFF7ED' }}>
      <Stack.Screen options={{ title: `${step + 1} / ${totalSteps}`, headerShown: true }} />

      {/* Progress bar */}
      <View style={{ height: 6, backgroundColor: '#FED7AA' }}>
        <View
          style={{
            height: '100%',
            width: `${((step + 1) / totalSteps) * 100}%`,
            backgroundColor: '#F97316',
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: 30 }}>
        <Animated.View key={q.id} entering={SlideInRight.duration(250)} exiting={FadeOut.duration(150)}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 12,
              letterSpacing: 1.4,
              color: '#F97316',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Pergunta {step + 1}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 26,
              color: '#1A1410',
              lineHeight: 32,
              marginBottom: 24,
            }}
          >
            {q.question}
          </Text>

          <View style={{ gap: 10 }}>
            {q.options.map((opt, idx) => (
              <Pressable
                key={idx}
                onPress={() => onAnswer(idx)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  backgroundColor: '#fff',
                  padding: 16,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: 'transparent',
                }}
              >
                <Text style={{ fontSize: 28 }}>{opt.emoji}</Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: FONTS.bodyBold,
                    fontSize: 15,
                    color: '#1A1410',
                  }}
                >
                  {opt.label}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#737373" />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
