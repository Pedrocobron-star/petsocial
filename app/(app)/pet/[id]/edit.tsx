import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';

import { PetForm } from '@/components/pet-form';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { deletePet, fetchPet, qk, updatePet } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { session } = useSession();
  const { setActivePet, pets } = useActivePet();
  const userId = session?.user.id;

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePet(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk.myPets(userId!) });
      const remaining = pets.filter((p) => p.id !== id);
      if (remaining[0]) setActivePet(remaining[0].id);
      toast.success('Pet excluído', 'Os dados foram removidos definitivamente.');
      router.replace('/(app)/(tabs)/profile');
    },
    onError: (e) =>
      toast.error('Erro ao excluir', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  if (!userId || !petQuery.data) return null;
  const pet = petQuery.data;
  if (pet.owner_id !== userId) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-neutral-600">Você só pode editar os seus pets.</Text>
        </View>
      </Screen>
    );
  }

  const confirmDelete = () => {
    Alert.alert(
      `Excluir ${pet.name}?`,
      'Todos os posts, comentários e encontros desse pet também serão removidos. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    );
  };

  return (
    <Screen>
      <View className="px-4 pt-2">
        <Text className="text-xl font-bold text-neutral-900">Editar {pet.name}</Text>
      </View>
      <PetForm
        userId={userId}
        submitLabel="Salvar alterações"
        initial={{
          name: pet.name,
          species: pet.species,
          breed: pet.breed ?? '',
          birthdate: pet.birthdate ?? '',
          bio: pet.bio ?? '',
          avatar_url: pet.avatar_url ?? '',
          social_temperament: pet.social_temperament ?? '',
          microchip_number: pet.microchip_number ?? '',
          rga_number: pet.rga_number ?? '',
          blood_type: pet.blood_type ?? '',
          allergies: pet.allergies ?? '',
          known_conditions: pet.known_conditions ?? '',
          emergency_contact_name: pet.emergency_contact_name ?? '',
          emergency_contact_phone: pet.emergency_contact_phone ?? '',
          preferred_vet_name: pet.preferred_vet_name ?? '',
          preferred_vet_phone: pet.preferred_vet_phone ?? '',
          sinpatinhas_id: pet.sinpatinhas_id ?? '',
        }}
        onSubmit={async (data) => {
          try {
            await updatePet(pet.id, {
              name: data.name,
              species: data.species,
              breed: data.breed || null,
              birthdate: data.birthdate || null,
              bio: data.bio || null,
              avatar_url: data.avatar_url || null,
              social_temperament: data.social_temperament || null,
              microchip_number: data.microchip_number || null,
              rga_number: data.rga_number || null,
              blood_type: data.blood_type || null,
              allergies: data.allergies || null,
              known_conditions: data.known_conditions || null,
              emergency_contact_name: data.emergency_contact_name || null,
              emergency_contact_phone: data.emergency_contact_phone || null,
              preferred_vet_name: data.preferred_vet_name || null,
              preferred_vet_phone: data.preferred_vet_phone || null,
              sinpatinhas_id: data.sinpatinhas_id || null,
            });
            await qc.invalidateQueries({ queryKey: qk.pet(pet.id) });
            await qc.invalidateQueries({ queryKey: qk.myPets(userId) });
            toast.success(`${data.name} atualizado!`);
            router.back();
          } catch (e) {
            toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente.');
            throw e;
          }
        }}
      />
      <View className="px-4 pb-8" style={{ gap: 8 }}>
        <Link href={{ pathname: '/pet/[id]/memorial' as never, params: { id: pet.id } as never }} asChild>
          <Pressable
            style={{
              backgroundColor: '#F5F3F0',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: '#E5E5E5',
            }}
          >
            <Text style={{ fontSize: 22 }}>🌈</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 14, color: '#1A1410' }}>
                {pet.memorial_at ? 'Memorial ativo' : 'Criar memorial'}
              </Text>
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: '#737373' }}>
                {pet.memorial_at
                  ? 'Toque pra gerenciar'
                  : 'Espaço pra honrar a memória'}
              </Text>
            </View>
          </Pressable>
        </Link>
        <Button
          title="Excluir pet"
          variant="danger"
          onPress={confirmDelete}
          loading={deleteMutation.isPending}
          fullWidth
        />
      </View>
    </Screen>
  );
}
