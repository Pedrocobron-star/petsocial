import { supabase } from './supabase';
import type { GameKey } from './games';

/**
 * Torneios de Cassino — evento temporizado de 1 jogo. O placar e computado das
 * pontuacoes que ja entram em game_scores na janela (o jogador so joga o jogo).
 */

export interface Tournament {
  id: string;
  title: string;
  game: GameKey;
  min_difficulty: number;
  starts_at: string;
  ends_at: string;
  finalized_at: string | null;
}

export interface TournamentRow {
  user_id: string;
  display_name: string;
  tutor_avatar: string | null;
  score: number;
  plays: number;
}

export interface MyTournamentRank {
  rank: number;
  score: number;
}

export async function fetchActiveTournament(): Promise<Tournament | null> {
  const { data, error } = await supabase.rpc('active_tournament');
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as Tournament) ?? null;
}

export async function fetchTournamentLeaderboard(id: string, limit = 10): Promise<TournamentRow[]> {
  const { data, error } = await supabase.rpc('tournament_leaderboard', {
    p_tournament_id: id,
    p_limit: limit,
  });
  if (error) return [];
  return ((data as TournamentRow[] | null) ?? []).map((r) => ({ ...r, score: Number(r.score) }));
}

export async function fetchMyTournamentRank(id: string): Promise<MyTournamentRank | null> {
  const { data, error } = await supabase.rpc('my_tournament_rank', { p_tournament_id: id });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { rank: Number(row.rank), score: Number(row.score) };
}

export const qkTournament = {
  active: () => ['tournament-active'] as const,
  leaderboard: (id: string) => ['tournament-lb', id] as const,
  myRank: (id: string) => ['tournament-rank', id] as const,
};

/** ms restantes -> "2d 4h" / "4h 12m" / "12m". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'encerrado';
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
