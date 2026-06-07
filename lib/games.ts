import { supabase } from './supabase';

export type GameKey = 'treats' | 'quiz';

export const GAME_META: Record<GameKey, { label: string; emoji: string; scoreLabel: string }> = {
  treats: { label: 'Pega o Petisco', emoji: '🦴', scoreLabel: 'petiscos' },
  quiz: { label: 'Quiz Pet', emoji: '🧠', scoreLabel: 'pontos' },
};

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  pet_id: string | null;
  pet_name: string | null;
  pet_avatar: string | null;
  score: number;
  achieved_at: string;
}

export async function submitGameScore(params: {
  game: GameKey;
  score: number;
  petId: string | null;
  userId: string;
}): Promise<void> {
  if (params.score <= 0) return;
  const { error } = await supabase.from('game_scores').insert({
    user_id: params.userId,
    pet_id: params.petId,
    game: params.game,
    score: params.score,
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

export const qkGames = {
  leaderboard: (game: GameKey, period: GamePeriod) => ['game-leaderboard', game, period] as const,
  myRank: (game: GameKey, period: GamePeriod) => ['game-my-rank', game, period] as const,
};
