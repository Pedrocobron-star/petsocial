/**
 * Helpers de push notifications locais.
 *
 * IMPORTANTE: Pra ativar no mobile, instale o package:
 *   npx expo install expo-notifications
 *
 * Se o package não estiver instalado, os métodos viram no-op silenciosamente,
 * não quebram o app. Web usa a Notification API do browser como fallback.
 */

import { Platform } from 'react-native';

import { describeRecurrence } from './event-templates';
import type { PetEvent } from './types';

// Tipo mínimo do expo-notifications que usamos (evita import direto)
interface ExpoNotificationsModule {
  setNotificationHandler: (handler: { handleNotification: () => Promise<unknown> }) => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean; status: string }>;
  getPermissionsAsync: () => Promise<{ granted: boolean; status: string }>;
  scheduleNotificationAsync: (req: {
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: { date: Date; channelId?: string } | { seconds: number } | null;
    identifier?: string;
  }) => Promise<string>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  setNotificationChannelAsync?: (
    channelId: string,
    channel: { name: string; importance: number; sound?: string },
  ) => Promise<void>;
  AndroidImportance?: { HIGH: number; DEFAULT: number };
}

let cachedModule: ExpoNotificationsModule | null | undefined = undefined;

function loadExpoNotifications(): ExpoNotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  if (Platform.OS === 'web') {
    cachedModule = null;
    return null;
  }
  try {
    // require dinâmico — não falha em build se módulo não existe
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as ExpoNotificationsModule;
    cachedModule = mod;
    // Setup default handler — mostra notif mesmo com app aberto
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    return mod;
  } catch {
    cachedModule = null;
    return null;
  }
}

/**
 * Pede permissão pra notificações. Retorna true se autorizado.
 * Idempotente.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof globalThis.Notification === 'undefined') return false;
    if (globalThis.Notification.permission === 'granted') return true;
    if (globalThis.Notification.permission === 'denied') return false;
    try {
      const result = await globalThis.Notification.requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  const mod = loadExpoNotifications();
  if (!mod) return false;
  const existing = await mod.getPermissionsAsync();
  if (existing.granted) return true;
  const next = await mod.requestPermissionsAsync();
  // Cria canal Android pra som/importância
  if (Platform.OS === 'android' && mod.setNotificationChannelAsync) {
    await mod.setNotificationChannelAsync('agenda', {
      name: 'Agenda do pet',
      importance: mod.AndroidImportance?.HIGH ?? 4,
    });
  }
  return next.granted;
}

/**
 * Status atual sem pedir permissão.
 */
export async function getNotificationPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (Platform.OS === 'web') {
    if (typeof globalThis.Notification === 'undefined') return 'denied';
    const s = globalThis.Notification.permission;
    return s === 'granted' ? 'granted' : s === 'denied' ? 'denied' : 'undetermined';
  }
  const mod = loadExpoNotifications();
  if (!mod) return 'undetermined';
  const res = await mod.getPermissionsAsync();
  return res.granted ? 'granted' : res.status === 'denied' ? 'denied' : 'undetermined';
}

/**
 * Gera identifier estável pra notificação de um evento + ocorrência + reminder.
 * Permite cancelar/substituir.
 */
function notifId(eventId: string, occurrenceTs: number, minutesBefore: number): string {
  return `event-${eventId}-${occurrenceTs}-${minutesBefore}`;
}

/**
 * Conteúdo amigável da notificação por tipo.
 */
function buildContent(event: PetEvent, minutesBefore: number): { title: string; body: string } {
  const when =
    minutesBefore === 0
      ? 'agora'
      : minutesBefore < 60
      ? `em ${minutesBefore} min`
      : minutesBefore < 1440
      ? `em ${Math.round(minutesBefore / 60)}h`
      : `em ${Math.round(minutesBefore / 1440)} dia${minutesBefore >= 2880 ? 's' : ''}`;
  const emoji = event.emoji ?? '🐾';
  return {
    title: `${emoji} ${event.title}`,
    body:
      minutesBefore === 0
        ? 'Tá na hora! Toque pra registrar como feito.'
        : `Lembrete ${when} · ${describeRecurrence(event.recurrence_rule)}`,
  };
}

/**
 * Agenda notificações locais pra um evento (uma por reminder + por ocorrência).
 * Pra eventos recorrentes, agenda apenas as próximas N ocorrências (default 12).
 *
 * Retorna array de identifiers agendados (pra eventual cancelamento futuro).
 */
export async function scheduleEventReminders(
  event: PetEvent,
  occurrences: Date[],
): Promise<string[]> {
  if (Platform.OS === 'web') {
    // Web não suporta notificações agendadas via service worker sem complexidade;
    // poderíamos usar setTimeout enquanto a aba está aberta, mas evitamos
    // pra não criar inconsistência. Push web requer SW + endpoint do backend.
    return [];
  }
  const mod = loadExpoNotifications();
  if (!mod) return [];

  const ok = await requestNotificationPermission();
  if (!ok) return [];

  const scheduled: string[] = [];
  const now = Date.now();

  for (const occ of occurrences) {
    for (const minsBefore of event.reminder_minutes ?? [1440, 0]) {
      const fireAt = new Date(occ.getTime() - minsBefore * 60 * 1000);
      // Só agenda no futuro
      if (fireAt.getTime() <= now + 30 * 1000) continue;
      const content = buildContent(event, minsBefore);
      const identifier = notifId(event.id, occ.getTime(), minsBefore);
      try {
        await mod.scheduleNotificationAsync({
          identifier,
          content: {
            ...content,
            data: {
              eventId: event.id,
              petId: event.pet_id,
              occurrenceDate: occ.toISOString().slice(0, 10),
              source: 'agenda',
            },
          },
          trigger: { date: fireAt, channelId: 'agenda' },
        });
        scheduled.push(identifier);
      } catch {
        // Falha silenciosa — não bloqueia o save
      }
    }
  }
  return scheduled;
}

/**
 * Cancela notificações de um evento (best-effort — usa identifier prefix).
 * Não há API pra "list by prefix", então mantemos o identifier estável.
 */
export async function cancelEventReminders(
  eventId: string,
  occurrences: Date[],
  reminderMinutes: number[],
): Promise<void> {
  if (Platform.OS === 'web') return;
  const mod = loadExpoNotifications();
  if (!mod) return;
  for (const occ of occurrences) {
    for (const minsBefore of reminderMinutes) {
      const identifier = notifId(eventId, occ.getTime(), minsBefore);
      try {
        await mod.cancelScheduledNotificationAsync(identifier);
      } catch {
        // ignore
      }
    }
  }
}
