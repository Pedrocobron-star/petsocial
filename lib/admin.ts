/**
 * Helpers do painel admin.
 *
 * Por enquanto: grant/revoke de Pet Pro pra qualquer usuário.
 *
 * Todas as funções dependem da função SQL `is_admin()` no Supabase — se o
 * usuário corrente não é admin, a RPC retorna erro 'forbidden' (42501).
 */

import { supabase } from './supabase';

/**
 * Gate de admin de UI centralizado (fonte única; antes o e-mail estava
 * espalhado por ~37 arquivos). Suporta múltiplos admins via env, sem tocar no
 * código. O gate de verdade é server-side (is_admin() nas RPCs).
 */
export const ADMIN_EMAILS: string[] = (process.env.EXPO_PUBLIC_ADMIN_EMAILS || 'pedrocobron@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface GrantProResult {
  ok: boolean;
  user_id: string;
  status: string;
  plan: string;
  current_period_end: string | null;
  granted_by: string;
}

export interface RevokeProResult {
  ok: boolean;
  user_id: string;
  updated_rows: number;
}

/**
 * Concede Pet Pro pra um usuário.
 *
 * @param userId   alvo do grant
 * @param durationDays  duração em dias. `null` = permanente (sem expiração).
 *                      30 = 1 mês, 180 = 6 meses, 365 = 1 ano.
 */
export async function adminGrantPro(
  userId: string,
  durationDays: number | null,
): Promise<GrantProResult> {
  const { data, error } = await supabase.rpc('admin_grant_pro', {
    p_user_id: userId,
    p_duration_days: durationDays,
  });
  if (error) throw error;
  return data as GrantProResult;
}

/** Revoga Pet Pro do usuário (set status='canceled'). */
export async function adminRevokePro(userId: string): Promise<RevokeProResult> {
  const { data, error } = await supabase.rpc('admin_revoke_pro', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as RevokeProResult;
}

/**
 * Opções pré-definidas de duração pro painel.
 * `days: null` = permanente.
 */
export const PRO_GRANT_PRESETS = [
  { label: '1 mês', days: 30 as number | null },
  { label: '6 meses', days: 180 as number | null },
  { label: '1 ano', days: 365 as number | null },
  { label: 'Permanente', days: null as number | null },
] as const;

// ----------------------------------------------------------------------------
// Visibilidade operacional (telas Banidos / Erros / Fundadores)
// ----------------------------------------------------------------------------

export interface AdminErrorRow {
  id: string;
  created_at: string;
  message: string;
  route: string | null;
  platform: string | null;
  app_version: string | null;
  user_id: string | null;
  email: string | null;
  stack: string | null;
}

export async function fetchAdminErrors(limit = 100, search?: string): Promise<AdminErrorRow[]> {
  const { data, error } = await supabase.rpc('admin_list_errors', {
    p_limit: limit,
    p_offset: 0,
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as AdminErrorRow[];
}

export interface AdminBannedRow {
  id: string;
  email: string | null;
  display_name: string | null;
  banned_at: string;
  banned_reason: string | null;
}

export async function fetchBannedUsers(limit = 100, search?: string): Promise<AdminBannedRow[]> {
  const { data, error } = await supabase.rpc('admin_list_banned_users', {
    p_limit: limit,
    p_offset: 0,
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as AdminBannedRow[];
}

/** Desbane um usuário (reusa admin_ban_user com p_ban=false). */
export async function adminUnbanUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_ban_user', { p_user_id: userId, p_ban: false, p_reason: null });
  if (error) throw error;
}

export interface FounderOverview {
  limit: number;
  taken: number;
  remaining: number;
  display_count: number;
  pro_active: number;
  expired: number;
}

export async function fetchFounderOverview(): Promise<FounderOverview | null> {
  const { data, error } = await supabase.rpc('admin_founder_overview');
  if (error) throw error;
  return (data as FounderOverview) ?? null;
}

export interface FounderRow {
  founder_number: number;
  id: string;
  email: string | null;
  display_name: string | null;
  pro_until: string | null;
  pro_active: boolean;
}

export async function fetchFounders(limit = 120): Promise<FounderRow[]> {
  const { data, error } = await supabase.rpc('admin_list_founders', { p_limit: limit, p_offset: 0 });
  if (error) throw error;
  return (data ?? []) as FounderRow[];
}

export interface AdminAuditRow {
  id: string;
  admin_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** Lê o log de auditoria direto (RLS já permite SELECT pro admin). */
export async function fetchAuditLog(limit = 200): Promise<AdminAuditRow[]> {
  const { data, error } = await supabase
    .from('admin_audit')
    .select('id, admin_email, action, entity, entity_id, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdminAuditRow[];
}

// ----------------------------------------------------------------------------
// Pagamentos (Cakto) + receita
// ----------------------------------------------------------------------------

export interface CaktoEventRow {
  id: string;
  created_at: string;
  event: string | null;
  email: string | null;
  order_id: string | null;
  amount: number | null;
  result: string | null;
  matched_user: string | null;
}

export async function fetchCaktoEvents(limit = 100, search?: string): Promise<CaktoEventRow[]> {
  const { data, error } = await supabase.rpc('admin_cakto_events', {
    p_limit: limit,
    p_offset: 0,
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as CaktoEventRow[];
}

export interface CaktoRevenue {
  total_revenue: number;
  sales_count: number;
  rev_30d: number;
  sales_30d: number;
  rev_7d: number;
  rev_today: number;
  avg_ticket: number;
  refunds: number;
  active_pro_paid: number;
}

export async function fetchCaktoRevenue(): Promise<CaktoRevenue | null> {
  const { data, error } = await supabase.rpc('admin_cakto_revenue');
  if (error) throw error;
  return (data as CaktoRevenue) ?? null;
}

// ----------------------------------------------------------------------------
// LGPD: trilha de pedidos de exportar/excluir conta
// ----------------------------------------------------------------------------

export interface LgpdRequestRow {
  id: string;
  user_id: string | null;
  email: string | null;
  kind: 'export' | 'delete';
  status: 'pending' | 'completed';
  requested_at: string;
  completed_at: string | null;
  notes: string | null;
}

export async function fetchLgpdRequests(limit = 200): Promise<LgpdRequestRow[]> {
  const { data, error } = await supabase
    .from('lgpd_requests')
    .select('id, user_id, email, kind, status, requested_at, completed_at, notes')
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LgpdRequestRow[];
}
