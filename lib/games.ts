import { supabase } from './supabase';

export type GameKey = 'treats' | 'quiz';

export const GAME_META: Record<GameKey, { label: string; emoji: string; scoreLabel: string }> = {
  treats: { label: 'Pega o Petisco', emoji: '🦴', scoreLabel: 'petiscos' },
  quiz: { label: 'Quiz Pet', emoji: '🧠', scoreLabel: 'pontos' },
};

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
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

export async function fetchLeaderboard(game: GameKey, limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('game_leaderboard', { p_game: game, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}

export const qkGames = {
  leaderboard: (game: GameKey) => ['game-leaderboard', game] as const,
};
