import { supabase } from '@/lib/supabase';

/**
 * Missão do Dia — um objetivo de foto por dia do mês (1..31), editável no admin.
 * O usuário cumpre postando com a hashtag do dia; um trigger no banco pontua e
 * registra a conquista. `get_today_mission` (RPC security definer) devolve a
 * missão de hoje (fuso BRT) + o status do usuário (feito hoje, total, streak).
 */

export interface TodayMission {
  day_of_month: number;
  title: string;
  prompt: string;
  hashtag: string;
  points: number;
  emoji: string;
  done_today: boolean;
  total_completions: number;
  total_points: number;
  streak: number;
}

export interface DailyMissionRow {
  id: string;
  day_of_month: number;
  title: string;
  prompt: string;
  hashtag: string;
  points: number;
  emoji: string;
  active: boolean;
  updated_at: string;
}

export interface DailyMissionInput {
  day_of_month: number;
  title: string;
  prompt: string;
  hashtag: string;
  points: number;
  emoji: string;
  active: boolean;
}

/** Missão de hoje + meu progresso. Retorna null se não houver missão pro dia. */
export async function fetchTodayMission(): Promise<TodayMission | null> {
  const { data, error } = await supabase.rpc('get_today_mission');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as TodayMission) ?? null;
}

/** Admin: lista as 31 missões (via RLS admin). */
export async function fetchAllMissions(): Promise<DailyMissionRow[]> {
  const { data, error } = await supabase
    .from('daily_missions')
    .select('*')
    .order('day_of_month', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DailyMissionRow[];
}

/** Admin: cria/atualiza a missão de um dia (upsert por day_of_month). */
export async function upsertMission(input: DailyMissionInput): Promise<void> {
  const clean = {
    day_of_month: input.day_of_month,
    title: input.title.trim(),
    prompt: input.prompt.trim(),
    hashtag: input.hashtag.replace(/[^\p{L}\p{N}_]/gu, '').trim(),
    points: input.points,
    emoji: input.emoji.trim() || '📸',
    active: input.active,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('daily_missions')
    .upsert(clean, { onConflict: 'day_of_month' });
  if (error) throw error;
}

export const qkTodayMission = ['daily-mission', 'today'] as const;
export const qkAllMissions = ['admin', 'daily-missions'] as const;

// -------- Ranking MENSAL da Missão do Dia (o 1º do mês ganha 1 mês de Pro) --------

export interface MissionLeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  points: number;
  completions: number;
  rank_position: number;
}

export interface MyMonthlyRank {
  rank: number;
  points: number;
  total_tutors: number;
}

export const qkMissionLeaderboard = ['mission', 'monthly-leaderboard'] as const;
export const qkMyMonthlyMission = ['mission', 'my-monthly'] as const;

/** Top tutores do mês corrente (pontos da Missão do Dia). */
export async function fetchMissionMonthlyLeaderboard(
  limit = 50,
): Promise<MissionLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('mission_monthly_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data as MissionLeaderboardEntry[] | null) ?? [];
}

/** Minha posição no ranking do mês (null se ainda não pontuei no mês). */
export async function fetchMyMonthlyMissionRank(): Promise<MyMonthlyRank | null> {
  const { data, error } = await supabase.rpc('mission_my_monthly');
  if (error) throw error;
  return (data as MyMonthlyRank[] | null)?.[0] ?? null;
}
