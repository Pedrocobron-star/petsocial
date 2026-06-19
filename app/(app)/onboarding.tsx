import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { PetForm } from '@/components/pet-form';
import { Screen } from '@/components/ui/screen';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { markOnboardingSkipped } from '@/lib/onboarding-state';
import { qk } from '@/lib/queries';
import { claimReferral, clearPendingRef, readPendingRef } from '@/lib/referral';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

export default function OnboardingScreen() {
  const router = useRouter();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;

  if (!userId) return null;

  const handleSkip = () => {
    Alert.alert(
      'Pular por agora?',
      'Você pode cadastrar pets depois na aba Perfil. O feed vai ficar mais legal quando tiver seu pet ✨',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pular',
          onPress: () => {
            markOnboardingSkipped();
            router.replace('/(app)/(tabs)');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Header motivacional com pets animados */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              marginBottom: 12,
            }}
          >
            <Image
              source={{ uri: MOZART.oi }}
              style={{ width: 96, height: 96 }}
              resizeMode="contain"
              accessibilityLabel="Mozart acenando, dando boas-vindas"
            />
          </View>

          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 32,
              color: '#1A1410',
              lineHeight: 38,
            }}
          >
            Quem é{'\n'}o protagonista? 🐾
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 15,
              color: '#525252',
              marginTop: 8,
              lineHeight: 22,
            }}
          >
            Bora cadastrar seu primeiro pet. Você pode adicionar mais depois, e
            cada um tem seu próprio perfil, feed e carteirinha.
          </Text>

          {/* Mini benefícios visuais */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            <Benefit emoji="📸" label="Compartilhar momentos" />
            <Benefit emoji="🩺" label="Cuidar da saúde" />
            <Benefit emoji="🆘" label="Pets perdidos" />
          </View>
        </View>

        {/* Pet form */}
        <View style={{ marginTop: 8 }}>
          <PetForm
            userId={userId}
            submitLabel="Continuar"
            onSubmit={async (data) => {
              try {
                // Convite: registra quem indicou ANTES de inserir o 1º pet
                // (o trigger concede a recompensa de Pro pra ambos). Sem isso,
                // quem cadastra o pet pela tela de onboarding perdia o bônus.
                const pendingRef = readPendingRef();
                if (pendingRef) await claimReferral(pendingRef).catch(() => false);
                const { error } = await supabase.from('pets').insert({
                  owner_id: userId,
                  name: data.name,
                  species: data.species,
                  breed: data.breed || null,
                  birthdate: data.birthdate || null,
                  bio: data.bio || null,
                  avatar_url: data.avatar_url || null,
                });
                if (error) throw error;
                clearPendingRef();
                await qc.invalidateQueries({ queryKey: qk.myPets(userId) });
                toast.success(`Bem-vindo, ${data.name}! 🐾`, 'Esse é o celular do seu pet 🐾📱');
                router.replace('/(app)/phone');
              } catch (e) {
                toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente de novo');
                throw e;
              }
            }}
          />
        </View>

        {/* Skip pro caso de cadastrar pet depois */}
        <Pressable
          onPress={handleSkip}
          style={{
            marginTop: 20,
            marginHorizontal: 20,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          accessibilityRole="button"
          accessibilityLabel="Pular cadastro de pet por agora"
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#737373' }}>
            Pular por agora
          </Text>
          <Ionicons name="arrow-forward" size={14} color="#737373" />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Benefit({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFEDD5',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 11 }}>{emoji}</Text>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412' }}>{label}</Text>
    </View>
  );
}
