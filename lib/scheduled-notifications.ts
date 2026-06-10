import { supabase } from '@/lib/supabase';

/**
 * Notificações broadcast/agendadas criadas pelo admin. Gravadas in-app pra todo
 * o segmento + push pros inscritos. O cron `petsocial-dispatch` (a cada 5 min)
 * processa as que vencem; "enviar agora" dispara o dispatch na hora.
 */

export type NotifAudience = 'all' | 'pro' | 'with_pets' | 'inactive';

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  audience: NotifAudience;
  scheduled_at: string;
  sent_at: string | null;
  sent_count: number | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateScheduledNotificationInput {
  title: string;
  body?: string | null;
  url?: string | null;
  audience: NotifAudience;
  /** ISO. Use o horário atual pra "enviar agora". */
  scheduled_at: string;
}

export const AUDIENCE_LABELS: Record<NotifAudience, string> = {
  all: 'Todos',
  pro: 'Pet Pro',
  with_pets: 'Com pet',
  inactive: 'Inativos 7d+',
};

export const AUDIENCE_OPTIONS: { value: NotifAudience; label: string; sub: string }[] = [
  { value: 'all', label: 'Todos', sub: 'Toda a base' },
  { value: 'with_pets', label: 'Com pet', sub: 'Quem cadastrou pet' },
  { value: 'pro', label: 'Pet Pro', sub: 'Assinantes' },
  { value: 'inactive', label: 'Inativos', sub: 'Sumidos 7d+' },
];

export async function adminCreateScheduledNotification(
  input: CreateScheduledNotificationInput,
): Promise<ScheduledNotification> {
  const { data, error } = await supabase.rpc('admin_create_scheduled_notification', {
    p_title: input.title,
    p_body: input.body ?? null,
    p_url: input.url ?? null,
    p_audience: input.audience,
    p_scheduled_at: input.scheduled_at,
  });
  if (error) throw error;
  return data as ScheduledNotification;
}

export async function adminListScheduledNotifications(limit = 100): Promise<ScheduledNotification[]> {
  const { data, error } = await supabase.rpc('admin_list_scheduled_notifications', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ScheduledNotification[];
}

export async function adminCancelScheduledNotification(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_scheduled_notification', { p_id: id });
  if (error) throw error;
}

/** Roda o dispatch imediatamente (pra "enviar agora" não esperar o cron). */
export async function adminRunDispatchNow(): Promise<void> {
  const { error } = await supabase.rpc('admin_run_dispatch_now');
  if (error) throw error;
}

export const qkScheduledNotif = {
  list: ['admin', 'scheduled-notif', 'list'] as const,
};
