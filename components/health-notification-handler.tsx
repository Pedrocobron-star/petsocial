import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import {
  handleNotificationAction,
  registerNotificationCategories,
} from '@/lib/health-notifications';
import { useToast } from '@/providers/toast-provider';

/**
 * Componente invisível: registra categories no boot e escuta respostas das
 * notifs de saúde, roteando pra tela certa ou disparando mutations.
 *
 * Web: no-op (expo-notifications resp listener não dispara).
 * Native: monta listener UMA vez por sessão autenticada.
 */
export function HealthNotificationHandler() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Registra categories (idempotente)
    registerNotificationCategories().catch(() => undefined);

    // Listener pra responses
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      const result = await handleNotificationAction({
        actionId: response.actionIdentifier,
        kind: typeof data.kind === 'string' ? data.kind : undefined,
        petId: typeof data.petId === 'string' ? data.petId : undefined,
        resourceId: getResourceId(data),
        sourceKey: typeof data.sourceKey === 'string' ? data.sourceKey : undefined,
      });

      // Feedback toast quando user fez ação sem abrir app (TAKEN, APPLIED, POSTPONE)
      if (response.actionIdentifier === 'TAKEN') {
        toast.success('Dose marcada como tomada ✓');
      } else if (response.actionIdentifier === 'APPLIED') {
        toast.success('Aplicação registrada ✓');
      } else if (response.actionIdentifier === 'POSTPONE') {
        toast.info('Lembrete cancelado. Reagende quando quiser.');
      }

      // Navega quando aplicável
      if (result.navigateTo) {
        router.push(result.navigateTo as never);
      }
    });

    return () => sub.remove();
  }, [router, toast]);

  return null;
}

/** Tenta extrair o ID do recurso de várias chaves possíveis. */
function getResourceId(data: Record<string, unknown>): string | undefined {
  const candidates = ['resourceId', 'medicationId', 'vaccinationId', 'treatmentId', 'visitId'];
  for (const key of candidates) {
    const v = data[key];
    if (typeof v === 'string') return v;
  }
  return undefined;
}
