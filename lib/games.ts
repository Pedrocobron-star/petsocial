import type { QueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

export type GameKey = 'treats' | 'quiz' | 'caminho' | 'runner';

export const GAME_META: Record<GameKey, { label: string; emoji: string; scoreLabel: string }> = {
  treats: { label: 'Cesta do Mozart', emoji: '🧺', scoreLabel: 'petiscos' },
  quiz: { label: 'Quiz Pet', emoji: '🧠', scoreLabel: 'pontos' },
  caminho: { label: 'Caminho do Au-Au', emoji: '🐕', scoreLabel: 'fases' },
  runner: { label: 'Mozart Corre', emoji: '🏃', scoreLabel: 'pontos' },
};

/** Tiers de dificuldade. 1=Fácil, 2=Médio, 3=Difícil. Médio = experiência original. */
export type GameDifficulty = 1 | 2 | 3;

export const DIFF_META: Record<GameDifficulty, { label: string; emoji: string; mult: number }> = {
  1: { label: 'Fácil', emoji: '🟢', mult: 1 },
  2: { label: 'Médio', emoji: '🟡', mult: 1.5 },
  3: { label: 'Difícil', emoji: '🔴', mult: 2 },
};

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  pet_id: string | null;
  pet_name: string | null;
  pet_avatar: string | null;
  score: number;
  difficulty: number | null;
  achieved_at: string;
}

/**
 * Abre uma sessão de jogo no SERVIDOR (carimba o início). Chamada no start()
 * de cada jogo; o id volta pra ser entregue no submit. O servidor mede a
 * duração real (now() - started_at) pra validar plausibilidade — o cliente não
 * controla o tempo. null = falhou abrir (offline no start); nesse caso o score
 * não terá como ser salvo (mesmo desfecho de um submit que falha por rede).
 */
export async function beginGameSession(game: GameKey, difficulty: GameDifficulty): Promise<string | null> {
  const { data, error } = await supabase.rpc('game_begin', { p_game: game, p_difficulty: difficulty });
  if (error) return null;
  return (typeof data === 'string' ? data : null);
}

/**
 * Grava o placar via RPC `game_submit` (único caminho de escrita em game_scores
 * — o insert direto foi revogado). A dificuldade vem da SESSÃO (travada no
 * begin), então não é mais enviada aqui. Sem sessionId não há como salvar.
 */
export async function submitGameScore(params: {
  game: GameKey;
  score: number;
  petId: string | null;
  userId: string;
  sessionId: string | null;
}): Promise<void> {
  if (params.score <= 0) return;
  if (!params.sessionId) throw new Error('sessão de jogo ausente');
  const { error } = await supabase.rpc('game_submit', {
    p_session: params.sessionId,
    p_score: params.score,
    p_pet_id: params.petId,
  });
  if (error) throw error;
}

export type GamePeriod = 'all' | 'week';

export async function fetchLeaderboard(
  game: GameKey,
  limit = 20,
  period: GamePeriod = 'all',
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('game_leaderboard', {
    p_game: game,
    p_limit: limit,
    p_period: period,
  });
  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}

export interface MyRank {
  rank: number;
  score: number;
  total: number;
}

/** Posição do usuário atual no ranking (mesmo fora do top). null = ainda não pontuou. */
export async function fetchMyRank(game: GameKey, period: GamePeriod = 'all'): Promise<MyRank | null> {
  const { data, error } = await supabase.rpc('game_my_rank', { p_game: game, p_period: period });
  if (error) throw error;
  const row = (data as MyRank[] | null)?.[0];
  return row ?? null;
}

/** Maior dificuldade que o tutor já pontuou nesse jogo (troféu de grau). null = nunca jogou. */
export async function fetchMaxDifficulty(game: GameKey): Promise<GameDifficulty | null> {
  const { data, error } = await supabase.rpc('game_max_difficulty', { p_game: game });
  if (error) throw error;
  return (data as GameDifficulty | null) ?? null;
}

export interface GameStreak {
  current_streak: number;
  played_today: boolean;
  best_streak: number;
  plays_today: number;
  daily_goal: number;
}

/** Streak diário + meta do dia (derivado de game_scores, fuso BR). null = sem dados. */
export async function fetchStreak(): Promise<GameStreak | null> {
  const { data, error } = await supabase.rpc('game_streak');
  if (error) throw error;
  return (data as GameStreak[] | null)?.[0] ?? null;
}

/** Uma linha do placar geral combinado (soma do melhor score de cada jogo). */
export interface GlobalLeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  total_score: number;
  games_played: number;
}

/** Placar geral combinado: ranking dos tutores somando os 3 jogos. */
export async function fetchGlobalLeaderboard(limit = 30): Promise<GlobalLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('game_global_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data as GlobalLeaderboardEntry[] | null) ?? [];
}

export interface GlobalRank {
  rank: number;
  total_score: number;
  total: number;
}

/** Posição do tutor logado no placar geral. null = ainda não pontuou. */
export async function fetchGlobalMyRank(): Promise<GlobalRank | null> {
  const { data, error } = await supabase.rpc('game_global_my_rank');
  if (error) throw error;
  return (data as GlobalRank[] | null)?.[0] ?? null;
}

/** Uma linha do placar do Desafio Diário (só hoje, jogo+dificuldade fixos). */
export interface DailyLeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  pet_id: string | null;
  pet_name: string | null;
  score: number;
  achieved_at: string;
}

/** Placar do desafio do dia (reseta sozinho: filtra só hoje, fuso BR). */
export async function fetchDailyLeaderboard(
  game: GameKey,
  difficulty: GameDifficulty,
  limit = 20,
): Promise<DailyLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('game_daily_leaderboard', {
    p_game: game,
    p_difficulty: difficulty,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as DailyLeaderboardEntry[] | null) ?? [];
}

export interface DailyResult {
  best_score: number | null;
  rank: number | null;
  total: number;
  played: boolean;
}

/** Seu resultado no desafio de hoje (best, rank, total, se já jogou). */
export async function fetchDailyMyResult(
  game: GameKey,
  difficulty: GameDifficulty,
): Promise<DailyResult | null> {
  const { data, error } = await supabase.rpc('game_daily_my_result', {
    p_game: game,
    p_difficulty: difficulty,
  });
  if (error) throw error;
  return (data as DailyResult[] | null)?.[0] ?? null;
}

export interface WeeklyRank {
  points: number;
  rank: number;
  total: number;
}

/** Pontos efetivos da semana (BR) + posição do tutor na liga. null = sem dados. */
export async function fetchWeeklyRank(): Promise<WeeklyRank | null> {
  const { data, error } = await supabase.rpc('game_weekly_rank');
  if (error) throw error;
  return (data as WeeklyRank[] | null)?.[0] ?? null;
}

export interface WeeklyLeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  points: number;
}

/** Placar da liga da semana (top N por pontos da semana). */
export async function fetchWeeklyLeaderboard(limit = 20): Promise<WeeklyLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('game_weekly_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data as WeeklyLeaderboardEntry[] | null) ?? [];
}

export const qkGames = {
  leaderboard: (game: GameKey, period: GamePeriod) => ['game-leaderboard', game, period] as const,
  myRank: (game: GameKey, period: GamePeriod) => ['game-my-rank', game, period] as const,
  maxDifficulty: (game: GameKey) => ['game-max-difficulty', game] as const,
  streak: () => ['game-streak'] as const,
  global: () => ['game-global-leaderboard'] as const,
  globalMyRank: () => ['game-global-my-rank'] as const,
  daily: (game: GameKey, difficulty: GameDifficulty) => ['game-daily', game, difficulty] as const,
  dailyMyResult: (game: GameKey, difficulty: GameDifficulty) => ['game-daily-my', game, difficulty] as const,
  weeklyRank: () => ['game-weekly-rank'] as const,
  weeklyLeaderboard: () => ['game-weekly-leaderboard'] as const,
};

/**
 * Invalida TODAS as queries afetadas por um novo score: ranking do jogo,
 * streak, Liga da Semana, Ranking Geral e Desafio do Dia. Antes os jogos só
 * invalidavam o ranking do próprio jogo + streak → os cards de Liga/Geral/
 * Desafio no hub ficavam com dado velho até um refetch. Prefixo de key (sem
 * period/difficulty) cobre todas as variações daquele grupo.
 */
export function invalidateGameQueries(qc: QueryClient, game: GameKey): void {
  qc.invalidateQueries({ queryKey: ['game-leaderboard', game] });
  qc.invalidateQueries({ queryKey: ['game-my-rank', game] });
  qc.invalidateQueries({ queryKey: qkGames.streak() });
  qc.invalidateQueries({ queryKey: qkGames.weeklyRank() });
  qc.invalidateQueries({ queryKey: qkGames.weeklyLeaderboard() });
  qc.invalidateQueries({ queryKey: qkGames.global() });
  qc.invalidateQueries({ queryKey: qkGames.globalMyRank() });
  qc.invalidateQueries({ queryKey: ['game-daily', game] });
  qc.invalidateQueries({ queryKey: ['game-daily-my', game] });
}
