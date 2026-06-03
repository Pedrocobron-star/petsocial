/**
 * Helpers do painel admin.
 *
 * Por enquanto: grant/revoke de Pet Pro pra qualquer usuário.
 *
 * Todas as funções dependem da função SQL `is_admin()` no Supabase — se o
 * usuário corrente não é admin, a RPC retorna erro 'forbidden' (42501).
 */

import { supabase } from './supabase';

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
