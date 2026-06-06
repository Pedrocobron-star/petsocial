import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { AnimatedPet } from '@/components/animated-pet';
import { PetForm } from '@/components/pet-form';
import { Screen } from '@/components/ui/screen';
import { FONTS } from '@/lib/fonts';
import { qk } from '@/lib/queries';
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
          onPress: () => router.replace('/(app)/(tabs)'),
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
              marginBottom: 16,
            }}
          >
            <AnimatedPet kind="dog" size={42} delay={0} />
            <AnimatedPet kind="cat" size={42} delay={200} />
            <AnimatedPet kind="rabbit" size={42} delay={400} />
            <AnimatedPet kind="parrot" size={42} delay={600} />
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
            Bora cadastrar seu primeiro pet. Você pode adicionar mais depois — e
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
                const { error } = await supabase.from('pets').insert({
                  owner_id: userId,
                  name: data.name,
                  species: data.species,
                  breed: data.breed || null,
                  birthdate: data.birthdate || null,
                  bio: data.bio || null,
                  avatar_url: data.avatar_url || null,
                  social_temperament: data.social_temperament || null,
                });
                if (error) throw error;
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
