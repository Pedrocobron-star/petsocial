/**
 * Notificações locais agendadas para alertas de saúde do pet.
 *
 * Usa expo-notifications.scheduleNotificationAsync (cliente, sem servidor) pra
 * lembrar o tutor de:
 *  - Vacina vencendo (3 dias antes + no dia)
 *  - Parasita vencendo (1 dia antes + no dia)
 *  - Consulta agendada (1 dia antes)
 *
 * Web: no-op. As Web Notifications API têm UX/permission diferente; mantemos
 * silencioso e dependemos só dos alertas in-app.
 *
 * Estratégia de cancel: cada notificação leva `data.sourceKey` (ex: 'vaccine:abc-123').
 * `cancelHealthRemindersFor(sourceKey)` lista todas agendadas e cancela as que batem.
 *
 * Permissão: pedimos sob demanda no primeiro agendamento. Se o user negar,
 * silenciosamente skip — não bloqueia o save da vacina/parasita/consulta.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

const HEALTH_SOURCE_PREFIX = {
  vaccine: 'vaccine:',
  parasite: 'parasite:',
  vet_visit: 'vet_visit:',
  symptom: 'symptom:',
  medication: 'medication:',
} as const;

/** Categories registradas no OS pra ter botões nas notificações. */
const CATEGORIES = {
  MEDICATION: 'med-reminder',
  VACCINE: 'vaccine-reminder',
  PARASITE: 'parasite-reminder',
  VET_VISIT: 'vet-reminder',
} as const;

let categoriesRegistered = false;

/**
 * Registra as categories no OS uma vez. Idempotente. Chame no app boot
 * (RootLayout effect) ou na primeira vez que vamos agendar uma notif.
 */
export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (categoriesRegistered) return;

  try {
    await Notifications.setNotificationCategoryAsync(CATEGORIES.MEDICATION, [
      {
        identifier: 'TAKEN',
        buttonTitle: '✓ Tomada',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'POSTPONE',
        buttonTitle: '⏰ Adiar 1h',
        options: { opensAppToForeground: false },
      },
      { identifier: 'VIEW', buttonTitle: 'Ver', options: { opensAppToForeground: true } },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORIES.VACCINE, [
      { identifier: 'VIEW', buttonTitle: 'Ver vacinas', options: { opensAppToForeground: true } },
      {
        identifier: 'POSTPONE',
        buttonTitle: '⏰ Lembrar amanhã',
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORIES.PARASITE, [
      {
        identifier: 'APPLIED',
        buttonTitle: '✓ Apliquei',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'POSTPONE',
        buttonTitle: '⏰ Lembrar amanhã',
        options: { opensAppToForeground: false },
      },
      { identifier: 'VIEW', buttonTitle: 'Ver', options: { opensAppToForeground: true } },
    ]);

    await Notifications.setNotificationCategoryAsync(CATEGORIES.VET_VISIT, [
      { identifier: 'VIEW', buttonTitle: 'Ver consulta', options: { opensAppToForeground: true } },
    ]);

    categoriesRegistered = true;
  } catch {
    // ignora — categories falhando não bloqueia agendamento
  }
}

export type HealthNotifKind = keyof typeof HEALTH_SOURCE_PREFIX;

/** Garante permissão. Idempotente, retorna boolean. */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    const result = await Notifications.requestPermissionsAsync();
    return result.status === 'granted';
  } catch {
    return false;
  }
}

interface ScheduleOpts {
  title: string;
  body: string;
  /** Data exata no futuro. Se ≤ now, pulamos (notificação não-agendável). */
  fireAt: Date;
  /** Chave estável pra agrupar/cancelar (ex: 'vaccine:uuid'). */
  sourceKey: string;
  /** Payload extra pra deep linking ao clicar. */
  data?: Record<string, unknown>;
  /** Category id (define os botões de ação). */
  categoryId?: string;
}

/** Agenda 1 notificação. No-op se permissão negada, data passada ou na web. */
async function scheduleOne(opts: ScheduleOpts): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (opts.fireAt.getTime() <= Date.now()) return null;

  const granted = await ensurePermission();
  if (!granted) return null;

  // Registra categories na primeira chamada (idempotente)
  await registerNotificationCategories();

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: { sourceKey: opts.sourceKey, ...opts.data },
        categoryIdentifier: opts.categoryId,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: opts.fireAt },
    });
    return id;
  } catch {
    return null;
  }
}

/** Cancela todas as notifs cujo `data.sourceKey === sourceKey`. */
export async function cancelHealthRemindersFor(sourceKey: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const matching = all.filter((n) => {
      const data = n.content.data as Record<string, unknown> | null | undefined;
      return data?.sourceKey === sourceKey;
    });
    await Promise.all(matching.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  } catch {
    // ignora
  }
}

// ============================================================================
// VACINAS
// ============================================================================

export async function scheduleVaccineReminders(input: {
  vaccinationId: string;
  petId: string;
  petName: string;
  vaccineName: string;
  /** ISO da próxima dose. */
  nextDoseAt: string | null;
}): Promise<void> {
  const sourceKey = `${HEALTH_SOURCE_PREFIX.vaccine}${input.vaccinationId}`;
  // Cancela qualquer notif anterior pra essa vacina (idempotência em edit)
  await cancelHealthRemindersFor(sourceKey);

  if (!input.nextDoseAt) return;
  const dueDate = new Date(input.nextDoseAt);
  if (Number.isNaN(dueDate.getTime())) return;

  const data = { kind: 'vaccine', petId: input.petId, vaccinationId: input.vaccinationId };

  // 3 dias antes às 10h
  const threeDaysBefore = new Date(dueDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
  threeDaysBefore.setHours(10, 0, 0, 0);
  await scheduleOne({
    title: `💉 Vacina ${input.vaccineName} em 3 dias`,
    body: `${input.petName} tem ${input.vaccineName} marcada pra ${dueDate.toLocaleDateString('pt-BR')}`,
    fireAt: threeDaysBefore,
    sourceKey,
    data,
    categoryId: CATEGORIES.VACCINE,
  });

  // No dia, às 9h
  const sameDay = new Date(dueDate);
  sameDay.setHours(9, 0, 0, 0);
  await scheduleOne({
    title: `🔔 Hoje: vacina ${input.vaccineName}`,
    body: `${input.petName} precisa tomar ${input.vaccineName} hoje.`,
    fireAt: sameDay,
    sourceKey,
    data,
    categoryId: CATEGORIES.VACCINE,
  });
}

export async function cancelVaccineReminders(vaccinationId: string): Promise<void> {
  await cancelHealthRemindersFor(`${HEALTH_SOURCE_PREFIX.vaccine}${vaccinationId}`);
}

// ============================================================================
// PARASITAS
// ============================================================================

export async function scheduleParasiteReminders(input: {
  treatmentId: string;
  petId: string;
  petName: string;
  productName: string;
  nextDueAt: string | null;
}): Promise<void> {
  const sourceKey = `${HEALTH_SOURCE_PREFIX.parasite}${input.treatmentId}`;
  await cancelHealthRemindersFor(sourceKey);

  if (!input.nextDueAt) return;
  const dueDate = new Date(input.nextDueAt);
  if (Number.isNaN(dueDate.getTime())) return;

  const data = { kind: 'parasite', petId: input.petId, treatmentId: input.treatmentId };

  // 1 dia antes às 10h
  const oneDayBefore = new Date(dueDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  oneDayBefore.setHours(10, 0, 0, 0);
  await scheduleOne({
    title: `💊 ${input.productName} amanhã`,
    body: `Reaplicação programada pra ${input.petName} amanhã.`,
    fireAt: oneDayBefore,
    sourceKey,
    data,
    categoryId: CATEGORIES.PARASITE,
  });

  // No dia, às 8h
  const sameDay = new Date(dueDate);
  sameDay.setHours(8, 0, 0, 0);
  await scheduleOne({
    title: `🦟 Hoje: ${input.productName}`,
    body: `${input.petName} precisa de ${input.productName} hoje.`,
    fireAt: sameDay,
    sourceKey,
    data,
    categoryId: CATEGORIES.PARASITE,
  });
}

export async function cancelParasiteReminders(treatmentId: string): Promise<void> {
  await cancelHealthRemindersFor(`${HEALTH_SOURCE_PREFIX.parasite}${treatmentId}`);
}

// ============================================================================
// CONSULTAS VETERINÁRIAS
// ============================================================================

export async function scheduleVetVisitReminder(input: {
  visitId: string;
  petId: string;
  petName: string;
  reason: string;
  nextVisitAt: string | null;
  clinicName?: string | null;
}): Promise<void> {
  const sourceKey = `${HEALTH_SOURCE_PREFIX.vet_visit}${input.visitId}`;
  await cancelHealthRemindersFor(sourceKey);

  if (!input.nextVisitAt) return;
  const visitDate = new Date(input.nextVisitAt);
  if (Number.isNaN(visitDate.getTime())) return;

  const data = { kind: 'vet_visit', petId: input.petId, visitId: input.visitId };

  // 1 dia antes às 18h
  const oneDayBefore = new Date(visitDate);
  oneDayBefore.setDate(oneDayBefore.getDate() - 1);
  oneDayBefore.setHours(18, 0, 0, 0);
  await scheduleOne({
    title: `🩺 Consulta amanhã: ${input.petName}`,
    body: input.clinicName
      ? `${input.reason} amanhã em ${input.clinicName}.`
      : `${input.reason} amanhã.`,
    fireAt: oneDayBefore,
    sourceKey,
    data,
    categoryId: CATEGORIES.VET_VISIT,
  });
}

export async function cancelVetVisitReminders(visitId: string): Promise<void> {
  await cancelHealthRemindersFor(`${HEALTH_SOURCE_PREFIX.vet_visit}${visitId}`);
}

// ============================================================================
// REMÉDIOS (lembrete recorrente diário no horário definido)
// ============================================================================

/** Parseia "08:00, 20:00" / "8h" / "20h00" em [{hour, minute}] (máx 4). */
function parseTimeOfDay(raw: string | null | undefined): { hour: number; minute: number }[] {
  if (!raw) return [];
  const out: { hour: number; minute: number }[] = [];
  const re = /(\d{1,2})\s*[:hH]\s*(\d{2})?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null && out.length < 4) {
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) out.push({ hour, minute });
  }
  return out;
}

/**
 * Agenda lembretes locais RECORRENTES (diários no horário) pro remédio.
 * Só pra contínuos (daily/twice_daily) COM horário definido em time_of_day.
 * Semanal/mensal e sem-horário ficam pro push diário do servidor (notify_due_care).
 */
export async function scheduleMedicationReminders(input: {
  medicationId: string;
  petId: string;
  petName: string;
  medName: string;
  frequency: string;
  timeOfDay: string | null;
  active: boolean;
  endDate?: string | null;
}): Promise<void> {
  const sourceKey = `${HEALTH_SOURCE_PREFIX.medication}${input.medicationId}`;
  await cancelHealthRemindersFor(sourceKey);
  if (Platform.OS === 'web') return;
  if (!input.active || input.frequency === 'as_needed') return;
  if (input.frequency !== 'daily' && input.frequency !== 'twice_daily') return;
  if (input.endDate && new Date(input.endDate).getTime() < Date.now()) return;
  const times = parseTimeOfDay(input.timeOfDay);
  if (times.length === 0) return;

  const granted = await ensurePermission();
  if (!granted) return;
  await registerNotificationCategories();

  for (const t of times) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💊 Hora do remédio de ${input.petName}`,
          body: `${input.medName} agora.`,
          data: {
            sourceKey,
            kind: 'medication',
            resourceId: input.medicationId,
            petId: input.petId,
            medicationId: input.medicationId,
          },
          categoryIdentifier: CATEGORIES.MEDICATION,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute },
      });
    } catch {
      // ignora — uma falha de agendamento não bloqueia o save
    }
  }
}

export async function cancelMedicationReminders(medicationId: string): Promise<void> {
  await cancelHealthRemindersFor(`${HEALTH_SOURCE_PREFIX.medication}${medicationId}`);
}

// ============================================================================
// UTILS
// ============================================================================

/** Lista todas as notificações de saúde agendadas (pra debug/settings). */
export async function listScheduledHealthReminders(): Promise<
  { id: string; sourceKey: string; title: string; date: Date | null }[]
> {
  if (Platform.OS === 'web') return [];
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all
      .filter((n) => {
        const data = n.content.data as Record<string, unknown> | null | undefined;
        const sk = data?.sourceKey;
        return typeof sk === 'string' && Object.values(HEALTH_SOURCE_PREFIX).some((p) => sk.startsWith(p));
      })
      .map((n) => {
        const data = n.content.data as Record<string, unknown> | null | undefined;
        const trigger = n.trigger as { type?: string; date?: string | number | Date } | null;
        const date =
          trigger?.type === 'date' && trigger.date != null
            ? new Date(trigger.date as string | number | Date)
            : null;
        return {
          id: n.identifier,
          sourceKey: String(data?.sourceKey ?? ''),
          title: n.content.title ?? '',
          date,
        };
      });
  } catch {
    return [];
  }
}

/** Cancela TODAS as notificações de saúde (usar em logout / desabilitar feature). */
export async function cancelAllHealthReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const all = await listScheduledHealthReminders();
    await Promise.all(all.map((n) => Notifications.cancelScheduledNotificationAsync(n.id)));
  } catch {
    // ignora
  }
}

// ============================================================================
// ACTION HANDLERS — disparados quando user toca um botão da notif
// ============================================================================

export interface NotificationActionPayload {
  /** Identifier do botão tocado, OR Notifications.DEFAULT_ACTION_IDENTIFIER se tocou o body. */
  actionId: string;
  /** data.kind embutido na notif (vaccine | parasite | vet_visit | medication). */
  kind?: string;
  /** data.petId pra deep linking. */
  petId?: string;
  /** ID do recurso (vaccinationId | treatmentId | etc). */
  resourceId?: string;
  /** sourceKey pra cancel/reschedule. */
  sourceKey?: string;
}

/**
 * Handler central pra response de notification.
 *
 * Mutations (marcar tomada, postpone) chamam o supabase direto — não temos
 * acesso a hooks de React Query num response listener fora de componente.
 * UI updates: o componente que tiver a query montada vai pegar via invalidateOnFocus.
 *
 * Retorna uma URL pra navegar quando aplicável (action = VIEW ou tap no body).
 */
export async function handleNotificationAction(
  payload: NotificationActionPayload,
): Promise<{ navigateTo: string | null }> {
  const { actionId, kind, petId, resourceId, sourceKey } = payload;

  // VIEW ou tap no body → navegar pra tela específica
  if (
    actionId === 'VIEW' ||
    actionId === Notifications.DEFAULT_ACTION_IDENTIFIER ||
    !actionId
  ) {
    return { navigateTo: deepLinkForKind(kind, petId) };
  }

  // POSTPONE: cancela notif atual e reagenda pra 1 dia depois (ou 1h pra meds)
  if (actionId === 'POSTPONE') {
    if (sourceKey) await cancelHealthRemindersFor(sourceKey);
    // O reschedule "burro" requer re-pull dos dados do DB. Por simplicidade,
    // não reagendamos automaticamente — vamos confiar no fluxo "user abre o
    // app, ajusta data, salva → schedule novo". Toast de confirmação fica
    // no listener do app (handleResponseInApp).
    return { navigateTo: null };
  }

  // TAKEN: marca remédio como administrado (cria medication_log row)
  if (actionId === 'TAKEN' && kind === 'medication' && resourceId) {
    try {
      await supabase.from('medication_logs').insert({
        medication_id: resourceId,
        administered_at: new Date().toISOString(),
      });
    } catch {
      // best-effort
    }
    return { navigateTo: null };
  }

  // APPLIED: marca parasita como aplicado (atualiza applied_at)
  if (actionId === 'APPLIED' && kind === 'parasite' && resourceId) {
    try {
      await supabase
        .from('parasite_treatments')
        .update({ applied_at: new Date().toISOString().slice(0, 10) })
        .eq('id', resourceId);
    } catch {
      // best-effort
    }
    return { navigateTo: petId ? `/pet/${petId}/parasites` : null };
  }

  return { navigateTo: null };
}

/** Mapeia kind→rota pra deep linking. */
export function deepLinkForKind(kind: string | undefined, petId: string | undefined): string | null {
  if (!petId) return null;
  switch (kind) {
    case 'vaccine':
      return `/pet/${petId}/vaccinations`;
    case 'parasite':
      return `/pet/${petId}/parasites`;
    case 'vet_visit':
      return `/pet/${petId}/vet-visits`;
    case 'medication':
      return `/pet/${petId}/medications`;
    case 'symptom':
      return `/pet/${petId}/symptoms`;
    default:
      return `/pet/${petId}/health`;
  }
}
