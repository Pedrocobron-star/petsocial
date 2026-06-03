import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import {
  CARETAKER_ROLE_LABEL,
  fetchSharedPets,
  speciesEmoji,
  type SharedPet,
} from '@/lib/caretaking';
import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

export default function SharedPetsScreen() {
  const { theme } = useTheme();
  const query = useQuery({ queryKey: ['shared-pets'], queryFn: fetchSharedPets });
  const pets = query.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Pets que ajudo a cuidar', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={560}>
          <View
            style={{
              backgroundColor: theme.brandSurface,
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: theme.brandLight,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 30 }}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.brandDark }}>
                Cuidado em família
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.brandDark, opacity: 0.85, marginTop: 2, lineHeight: 17 }}>
                Pets que outras pessoas compartilharam com você. Veja a saúde e a agenda de cada um.
              </Text>
            </View>
          </View>

          {query.isLoading ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 30 }} />
          ) : pets.length === 0 ? (
            <EmptyState
              emoji="🐾"
              title="Nenhum pet compartilhado"
              description="Quando alguém te convidar pra ajudar a cuidar de um pet, ele aparece aqui. Peça o link de convite pro tutor."
            />
          ) : (
            <View style={{ gap: 10 }}>
              {pets.map((p) => (
                <SharedPetCard key={p.pet_id} pet={p} />
              ))}
            </View>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function SharedPetCard({ pet }: { pet: SharedPet }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.borderLight,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {pet.avatar_url ? (
          <Image source={{ uri: pet.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.borderLight }} contentFit="cover" />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: theme.brandLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26 }}>{speciesEmoji(pet.species)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text }}>{pet.name}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            {pet.owner_name ? `de ${pet.owner_name}` : 'compartilhado'}
            {pet.breed ? ` · ${pet.breed}` : ''}
          </Text>
        </View>
        <View style={{ backgroundColor: theme.borderLight, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.textDim }}>
            {CARETAKER_ROLE_LABEL[pet.role]}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Link href={{ pathname: '/pet/[id]/health', params: { id: pet.pet_id } }} asChild>
          <PressScale style={{ flex: 1, backgroundColor: theme.brand, paddingVertical: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="medkit" size={15} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>Ver saúde</Text>
          </PressScale>
        </Link>
        <Link href={{ pathname: '/pet/[id]/agenda', params: { id: pet.pet_id } }} asChild>
          <PressScale style={{ flex: 1, backgroundColor: theme.borderLight, paddingVertical: 11, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="calendar" size={15} color={theme.text} />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>Agenda</Text>
          </PressScale>
        </Link>
      </View>
    </View>
  );
}
