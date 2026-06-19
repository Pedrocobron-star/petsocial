import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useToast } from '@/providers/toast-provider';

import { cleanupPetStorage } from './pet-cleanup';
import { deletePet, qk } from './queries';
import type { Pet } from './types';

/**
 * Hook único pra excluir um pet — usado na tela de editar pet E na lista
 * "Meus pets". Centraliza: confirmação destrutiva (funciona em web e native
 * via shim do Alert), o delete (DELETE direto sob RLS dono-only; o cascade de
 * FK limpa posts/comentários/seguidores/encontros/saúde), a reatribuição do
 * pet ativo (se o excluído era o ativo, passa pro próximo) e os toasts.
 *
 * `confirmAndDelete(pet, onDeleted?)` — onDeleted roda só após o sucesso
 * (ex.: voltar pro perfil na tela de edição). Na lista não passa nada (a
 * própria invalidação de myPets atualiza a tela no lugar).
 */
export function useDeletePet() {
  const qc = useQueryClient();
  const toast = useToast();
  const { session } = useSession();
  const { pets, setActivePet } = useActivePet();
  const userId = session?.user.id;

  const mutation = useMutation({
    // Limpa os arquivos de storage ANTES de apagar a linha (a RPC precisa que os
    // registros ainda existam pra coletar as URLs). Best-effort — não bloqueia.
    mutationFn: async (petId: string) => {
      await cleanupPetStorage(petId);
      return deletePet(petId);
    },
    onError: (e) =>
      toast.error('Erro ao excluir', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const confirmAndDelete = (pet: Pet, onDeleted?: () => void) => {
    Alert.alert(
      `Excluir ${pet.name}?`,
      `Isso apaga em definitivo TODOS os dados de ${pet.name}: posts, comentários, seguidores, encontros e os registros de saúde (vacinas, peso, consultas, documentos). Seus outros pets não são afetados, e essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            mutation.mutate(pet.id, {
              onSuccess: async () => {
                if (userId) await qc.invalidateQueries({ queryKey: qk.myPets(userId) });
                const remaining = pets.filter((p) => p.id !== pet.id);
                setActivePet(remaining[0] ? remaining[0].id : null);
                toast.success('Pet excluído', 'Os dados foram removidos definitivamente.');
                onDeleted?.();
              },
            }),
        },
      ],
    );
  };

  return { confirmAndDelete, isDeleting: mutation.isPending };
}
