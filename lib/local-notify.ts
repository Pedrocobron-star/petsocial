import { Platform } from 'react-native';

/**
 * Notificação local IMEDIATA no navegador (web), se já houver permissão. No-op
 * em nativo ou sem permissão — NUNCA pede permissão aqui (isso é do fluxo de
 * push). Útil pra avisar o user no momento de um evento (ex: conquista) mesmo
 * que ele esteja em outra aba.
 */
export function showLocalNotification(title: string, body: string, url?: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'achievement',
    });
    if (url) {
      n.onclick = () => {
        try {
          window.focus();
          window.location.href = url;
        } catch {
          // ignora
        }
        n.close();
      };
    }
  } catch {
    // ignora — notificação nunca pode quebrar fluxo
  }
}
