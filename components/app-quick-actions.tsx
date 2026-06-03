import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useActivePet } from '@/providers/active-pet-provider';

/**
 * Atalhos do ícone do app (iOS 3D Touch / Android long-press).
 *
 * - "Postar agora" → /create (sempre disponível)
 * - "Saúde de {pet}" → /pet/{ativo}/health (quando há pet ativo)
 * - "Encontrar vet" → /places?kind=vet
 *
 * Web/desktop: no-op silencioso. iOS: até 4 ações. Android: até 4.
 *
 * useQuickActionRouting do expo-quick-actions/router conecta automaticamente
 * o `params.href` ao Expo Router — basta passar `href` que ele navega.
 */
export function AppQuickActions() {
  // Hook tem que ser chamado pra deep linking funcionar; só funciona em native
  useQuickActionRouting();
  const { activePet } = useActivePet();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const items: QuickActions.Action[] = [
      {
        id: 'create-post',
        title: 'Postar agora',
        subtitle: 'Compartilhe a fofura',
        icon: Platform.OS === 'ios' ? 'symbol:camera.fill' : 'create',
        params: { href: '/(app)/(tabs)/create' },
      },
    ];

    if (activePet) {
      items.push({
        id: 'pet-health',
        title: `Saúde de ${activePet.name}`,
        subtitle: 'Vacinas, sintomas, alertas',
        icon: Platform.OS === 'ios' ? 'symbol:heart.fill' : 'home',
        params: { href: `/(app)/pet/${activePet.id}/health` },
      });
    }

    items.push({
      id: 'find-vet',
      title: 'Encontrar vet',
      subtitle: 'Veterinários perto',
      icon: Platform.OS === 'ios' ? 'symbol:cross.case.fill' : 'search',
      params: { href: '/(app)/places?kind=vet' },
    });

    QuickActions.setItems(items).catch(() => undefined);
  }, [activePet]);

  return null;
}
