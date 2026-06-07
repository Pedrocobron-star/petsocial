import { supabase } from './supabase';

export type GameKey = 'treats' | 'quiz' | 'caminho';

export const GAME_META: Record<GameKey, { label: string; emoji: string; scoreLabel: string }> = {
  treats: { label: 'Pega o Petisco', emoji: '🦴', scoreLabel: 'petiscos' },
  quiz: { label: 'Quiz Pet', emoji: '🧠', scoreLabel: 'pontos' },
  caminho: { label: 'Caminho do Au-Au', emoji: '🐕', scoreLabel: 'fases' },
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

export async function submitGameScore(params: {
  game: GameKey;
  score: number;
  petId: string | null;
  userId: string;
  difficulty?: GameDifficulty;
}): Promise<void> {
  if (params.score <= 0) return;
  const { error } = await supabase.from('game_scores').insert({
    user_id: params.userId,
    pet_id: params.petId,
    game: params.game,
    score: params.score,
    difficulty: params.difficulty ?? 2,
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

export const qkGames = {
  leaderboard: (game: GameKey, period: GamePeriod) => ['game-leaderboard', game, period] as const,
  myRank: (game: GameKey, period: GamePeriod) => ['game-my-rank', game, period] as const,
  maxDifficulty: (game: GameKey) => ['game-max-difficulty', game] as const,
  streak: () => ['game-streak'] as const,
  global: () => ['game-global-leaderboard'] as const,
  globalMyRank: () => ['game-global-my-rank'] as const,
};
