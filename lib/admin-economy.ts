/**
 * Admin da economia — leitura do ledger Pontos de Tutor, campeões mensais e
 * monitor de referral. Backend: supabase/admin-economy.sql (is_admin gated).
 */
import { supabase } from './supabase';

export interface PtLeader {
  user_id: string;
  display_name: string | null;
  email: string | null;
  total_pt: number;
  entries: number;
  last_at: string | null;
}
export interface MonthlyChampion {
  month_start: string;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  points: number;
  note: string | null;
  awarded_at: string | null;
}
export interface ReferralCluster {
  referrer_id: string;
  display_name: string | null;
  email: string | null;
  converted: number;
  pending: number;
  last_reward: string | null;
}

export const qkPtLeaderboard = ['admin-pt-leaderboard'] as const;
export const qkMonthlyChampions = ['admin-monthly-champions'] as const;
export const qkReferralMonitor = ['admin-referral-monitor'] as const;

export async function fetchPtLeaderboard(limit = 50): Promise<PtLeader[]> {
  const { data, error } = await supabase.rpc('admin_tutor_points_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as PtLeader[];
}
export async function fetchMonthlyChampions(limit = 24): Promise<MonthlyChampion[]> {
  const { data, error } = await supabase.rpc('admin_monthly_champions', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as MonthlyChampion[];
}
export async function fetchReferralMonitor(limit = 50): Promise<ReferralCluster[]> {
  const { data, error } = await supabase.rpc('admin_referral_monitor', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as ReferralCluster[];
}
export async function adminAwardMonthlyManual(monthStart: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_award_monthly_winner_manual', {
    p_month_start: monthStart,
    p_user_id: userId,
  });
  if (error) throw error;
}

/** Primeiro dia do mês ANTERIOR em formato YYYY-MM-DD (pra premiar o mês que fechou). */
export function previousMonthStart(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
