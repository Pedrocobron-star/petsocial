import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { track } from '@/lib/analytics';
import { useSession } from '@/providers/session-provider';
import { useActivePet } from '@/providers/active-pet-provider';

const STORAGE_KEY = 'pet-social.tour-completed-v1';

interface Step {
  emoji: string;
  title: string;
  description: string;
  highlight?: string;
}

/**
 * Tour interativo na primeira vez que o user entra no app.
 *
 * Detecta first-time via AsyncStorage (dismiss persiste). Mostra 4 hints
 * sobre features chave numa carta central + dots de progresso.
 *
 * Reabrir manualmente: outro lugar pode chamar `resetTourFlag()` e
 * navegar pra index — o tour reaparece.
 */
export function OnboardingTour() {
  const router = useRouter();
  const { session } = useSession();
  const { activePet } = useActivePet();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(STORAGE_KEY);
        if (!done && !cancelled) {
          setOpen(true);
          track('tour_started');
        }
      } catch {
        // ignora
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const steps: Step[] = [
    {
      emoji: '🐾',
      title: 'Bem-vindo ao Maestro Pet!',
      description:
        'A rede social pros pets, mas com saúde de verdade. Vou te mostrar o essencial em 4 passos rápidos.',
    },
    {
      emoji: '📸',
      title: 'Compartilhe a fofura',
      description:
        'Tab Postar ou ícone da câmera no canto. Tag outros pets, adicione hashtags, e veja no Feed o que sua comunidade tá aprontando.',
      highlight: 'Feed + Postar',
    },
    {
      emoji: '🩺',
      title: 'Saúde no comando',
      description:
        'Toque no seu pet → Saúde. Vacinas, sintomas, peso, calendário, e a IA pra dúvidas. Lembretes inteligentes te avisam do que vence.',
      highlight: activePet ? `Saúde do ${activePet.name}` : 'Saúde dos pets',
    },
    {
      emoji: '⭐',
      title: 'Pet Pro quando quiser',
      description:
        'O essencial é de graça. O Pro libera histórico do Score de Saúde completo, IA ilimitada, PDFs sem marca d\'água e mais, quando fizer sentido pra você.',
    },
  ];

  const finish = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignora
    }
    track('tour_completed', { last_step: step });
    setOpen(false);
  };

  const skip = async () => {
    track('tour_skipped', { at_step: step });
    await finish();
  };

  const next = () => {
    if (step < steps.length - 1) {
      track('tour_step', { step: step + 1 });
      setStep(step + 1);
    } else {
      // Última: encerra + leva pro pet ativo (se tiver)
      finish().then(() => {
        if (activePet) {
          router.push(`/pet/${activePet.id}/health` as never);
        }
      });
    }
  };

  if (!open) return null;
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={skip}>
      <Animated.View
        entering={FadeIn.duration(200)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(26, 20, 16, 0.65)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Pressable
          onPress={skip}
          hitSlop={10}
          style={{
            position: 'absolute',
            top: 50,
            right: 20,
            padding: 8,
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 999,
          }}
          accessibilityLabel="Pular tour"
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>

        <Animated.View
          key={step}
          entering={FadeInUp.duration(280)}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 24,
            padding: 24,
            gap: 16,
            alignItems: 'center',
            maxWidth: 360,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              backgroundColor: '#FFF7ED',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 38 }}>{current.emoji}</Text>
          </View>

          <View style={{ gap: 8, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: '#1A1410',
                textAlign: 'center',
              }}
            >
              {current.title}
            </Text>
            {current.highlight ? (
              <View
                style={{
                  backgroundColor: '#FED7AA',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 10,
                    color: '#9A3412',
                    letterSpacing: 1,
                  }}
                >
                  {current.highlight.toUpperCase()}
                </Text>
              </View>
            ) : null}
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: '#525252',
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {current.description}
            </Text>
          </View>

          {/* Progress dots */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === step ? '#F97316' : '#E5E5E5',
                }}
              />
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 8, width: '100%', marginTop: 4 }}>
            {!isLast ? (
              <Pressable
                onPress={skip}
                accessibilityLabel="Pular tour"
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: '#F5F5F5',
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#525252' }}>
                  Pular
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={next}
              accessibilityLabel={isLast ? 'Começar a usar' : 'Próximo'}
              style={{
                flex: isLast ? 1 : 2,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: '#F97316',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
                {isLast ? 'Começar 🚀' : 'Próximo'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

/** Reseta a flag pra que o tour reapareça na próxima vez que index for visitado. */
export async function resetTourFlag(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
