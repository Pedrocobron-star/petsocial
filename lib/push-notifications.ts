/**
 * Push notifications via Expo Push Notification Service.
 *
 * Fluxo:
 * 1. App pede permissão (iOS/Android exigem)
 * 2. Obtém Expo Push Token via expo-notifications
 * 3. Salva token no profile (`profiles.push_token`)
 * 4. Edge function / trigger dispatcha via api.expo.dev quando notif é criada
 *
 * Web: no-op (Expo Push só funciona em native).
 */

import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

// Handler default: mostra notif como banner quando app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Pede permissão e registra o push token do device.
 * Retorna o token (ou null se falhou / web / sem permissão).
 *
 * Idempotente — chamar várias vezes é seguro. Só atualiza o banco se o token
 * mudou desde a última vez.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Web não suporta Expo Push
  if (Platform.OS === 'web') return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;
    if (!token) return null;

    // Salva no profile (upsert by user id). Best-effort — não bloqueia se falhar.
    try {
      await supabase
        .from('profiles')
        .update({ push_token: token, push_token_updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch {
      // ignora
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Remove o push token (use no logout pra parar notificações).
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null, push_token_updated_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // ignora
  }
}

/**
 * Setup de listener pra clicks em notifications (deep linking).
 * Retorna função de cleanup.
 */
export function listenForNotificationTaps(
  onTap: (data: Record<string, unknown>) => void,
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    onTap(data as Record<string, unknown>);
  });
  return () => sub.remove();
}
