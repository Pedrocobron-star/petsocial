/**
 * Push web (PWA) — inscrição do navegador via Web Push API.
 *
 * Só funciona na web (Platform.OS === 'web') em navegador com service worker +
 * PushManager. No native, as funções são no-op (lá o push é via Expo token).
 *
 * Fluxo: pede permissão → pushManager.subscribe(VAPID público) → salva a
 * subscription em push_subscriptions. A edge function send-web-push envia.
 */

import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Chave VAPID PÚBLICA — segura pra embutir no client (a privada é secret no Supabase). */
export const VAPID_PUBLIC_KEY =
  'BGYcFqQLkmKMnuwWAhQNmoBnHUOQAFa-3aSkdTuMlCT5XRYvGOg_a4KYO7gLNjmf9K4hB41A56DQ5xc5ZTuX9XU';

export function isPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/** True se este navegador já tem uma subscription ativa. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

/**
 * Pede permissão, inscreve no push e salva a subscription. Retorna o status.
 */
export async function subscribeToPush(
  userId: string,
): Promise<'subscribed' | 'denied' | 'unsupported' | 'error'> {
  if (!isPushSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return 'error';

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: ua,
      },
      { onConflict: 'user_id,endpoint' },
    );
    if (error) return 'error';

    // Limpa inscrições MORTAS do mesmo device (mesmo user_agent, endpoint antigo):
    // ao reinstalar/atualizar o PWA o endpoint muda e o velho fica órfão (o FCM
    // aceita o push mas o device nunca recebe). Mantém só a inscrição viva.
    if (ua) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('user_agent', ua)
        .neq('endpoint', json.endpoint)
        .then(undefined, () => {});
    }
    return 'subscribed';
  } catch {
    return 'error';
  }
}

/**
 * Re-sincroniza a inscrição no LAUNCH quando a permissão já é 'granted'.
 * Conserta o caso em que o device reinstalou/atualizou o PWA: o endpoint mudou,
 * mas como o prompt só aparece em permission==='default', a inscrição salva no
 * banco ficava morta e o push parava de chegar. Silencioso (no-op se não granted).
 */
export async function refreshPushSubscription(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  if (Notification.permission !== 'granted') return;
  try {
    await subscribeToPush(userId);
  } catch {
    // ignora — best-effort
  }
}

/**
 * Dispara um push de teste pra si mesmo (chama a edge function send-web-push).
 * Útil pra validar o loop completo depois do deploy da function + secrets.
 */
export async function sendTestPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('send-web-push', {
      body: {
        user_id: userId,
        title: 'Maestro Pet 🐾',
        body: 'Push funcionando! É assim que os lembretes vão chegar.',
        url: '/reminders',
        tag: 'test',
      },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'erro' };
  }
}

/** Cancela a inscrição (remove do banco + do navegador). */
export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    // ignora
  }
}
