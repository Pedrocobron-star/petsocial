import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { canViewPet, fetchPet, qk } from '@/lib/queries';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

import { EmptyState } from './empty-state';

/**
 * Aviso de "informações privadas" pra telas médicas/de histórico do pet quando
 * quem abre não é o dono nem co-tutor. A privacidade REAL é o RLS no banco
 * (supabase/health-privacy-lockdown.sql) — isto é só a UX: em vez de uma lista
 * vazia confusa, o visitante vê uma mensagem clara.
 */
export function PetPrivateNotice({ petName }: { petName?: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
      <EmptyState
        emoji="🔒"
        title="Informações privadas"
        description={`Só ${petName ?? 'o tutor'} e quem ele autoriza podem ver a saúde e o histórico desse pet.`}
      />
    </View>
  );
}

/**
 * Aviso de "pet não encontrado" pras telas médicas/privadas quando o pet não
 * existe mais / foi deletado / o RLS bloqueia (fetchPet resolve null). Evita o
 * loader/skeleton eterno num deep-link pra pet que sumiu.
 */
export function PetNotFoundNotice() {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}>
      <EmptyState
        emoji="🐾"
        title="Pet não encontrado"
        description="Esse pet não existe mais ou você não tem acesso a ele."
      />
    </View>
  );
}

/**
 * Guard pras telas médicas/privadas do pet. Retorna o elemento de "privado" se
 * o usuário NÃO pode ver (não é dono nem co-tutor); senão retorna null (a tela
 * segue normal). Compartilha o cache de `qk.pet(petId)`, então não refaz fetch.
 *
 * Uso na tela (depois de declarar os outros hooks, antes do return principal):
 *   const gate = usePetHealthGate(id);
 *   if (gate) return gate;
 */
export function usePetHealthGate(petId: string | undefined) {
  const { session } = useSession();
  const me = session?.user.id;

  const petQuery = useQuery({
    queryKey: qk.pet(petId ?? ''),
    queryFn: () => fetchPet(petId!),
    enabled: !!petId,
  });
  const pet = petQuery.data;
  const isOwner = !!pet && !!me && pet.owner_id === me;

  const accessQuery = useQuery({
    queryKey: ['pet-health-access', petId, me],
    queryFn: () => canViewPet(petId!),
    enabled: !!petId && !!me && !!pet && !isOwner,
    staleTime: 5 * 60 * 1000,
  });

  // Pet ainda carregando → deixa a tela mostrar o próprio loader.
  if (petQuery.isLoading) return null;
  // Pet inexistente / deletado / sem acesso por RLS (fetchPet resolve null) →
  // "não encontrado", em vez de prender a tela num loader/skeleton eterno.
  if (!pet) return <PetNotFoundNotice />;
  if (isOwner) return null;
  // Sem sessão → não é dono nem co-tutor → privado.
  if (!me) return <PetPrivateNotice petName={pet.name} />;
  // Checando co-tutor → não bloqueia ainda (o RLS já protege os dados).
  if (accessQuery.isLoading) return null;
  if (accessQuery.data === true) return null; // co-tutor aceito
  return <PetPrivateNotice petName={pet.name} />;
}
