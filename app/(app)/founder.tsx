import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { fetchMyFounderStatus, qkFounder } from '@/lib/founder';
import { FONTS } from '@/lib/fonts';

/**
 * Tela de parabéns dos "Membros Fundadores" (promo dos 100 primeiros).
 * Aparece logo após o cadastro quando o usuário está entre os 100 primeiros.
 * Voz do Mozart: cachorro fofo, SEM travessão.
 */
export default function FounderScreen() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: qkFounder.me, queryFn: fetchMyFounderStatus });

  const go = () => router.replace('/(app)/phone');

  // Defesa: se por algum motivo não for fundador, não prende o usuário aqui.
  useEffect(() => {
    if (!isLoading && data && !data.is_founder) go();
  }, [isLoading, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !data || !data.is_founder) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBF5' }}>
        <ActivityIndicator color="#F97316" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#FFF1E0', '#FFFBF5']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Animated.Text entering={FadeIn.duration(400)} style={{ fontSize: 40, marginBottom: 4 }}>
            🎉
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(100).duration(450)} style={{ alignItems: 'center' }}>
            <Image
              source={{ uri: '/mozart/rosto.png' }}
              style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: '#FB923C' }}
              contentFit="cover"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(200).duration(450)}
            style={{
              marginTop: 18,
              backgroundColor: '#F97316',
              paddingHorizontal: 22,
              paddingVertical: 10,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#fff' }}>
              Membro Fundador nº {data.display_number}
            </Text>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(300).duration(450)}
            style={{
              fontFamily: FONTS.display,
              fontSize: 26,
              color: '#1A1410',
              textAlign: 'center',
              marginTop: 22,
              lineHeight: 32,
            }}
          >
            Você é um dos 100 primeiros do Maestro Pet! 🐾
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(400).duration(450)}
            style={{
              marginTop: 18,
              backgroundColor: '#FFFFFF',
              borderRadius: 18,
              padding: 18,
              borderWidth: 1,
              borderColor: '#FCE7D2',
              maxWidth: 420,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 15,
                color: '#525252',
                lineHeight: 22,
                textAlign: 'center',
              }}
            >
              Auau! Que alegria te ver aqui tão cedo. Por ser um dos primeiros da matilha, você
              ganhou <Text style={{ fontFamily: FONTS.bodyBold, color: '#C2410C' }}>3 meses de Pet
              Pro de presente</Text>. Obrigado por confiar no Maestro Pet desde o comecinho. Vou
              cuidar bem de você e do seu pet, prometo!
            </Text>
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 12,
                color: '#A8A29E',
                textAlign: 'center',
                marginTop: 10,
              }}
            >
              com carinho, Mozart 🐶
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(500).duration(450)} style={{ marginTop: 26, width: '100%', maxWidth: 420 }}>
            <Button title="Começar 🐾" onPress={go} fullWidth />
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
