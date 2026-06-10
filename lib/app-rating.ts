import { supabase } from '@/lib/supabase';

/**
 * Avaliação do app (1-5 estrelas + comentário ≥ 30 chars). Guardada interna —
 * visível pro admin em /admin/ratings, vira prova social depois.
 */

export interface AppRatingRow {
  id: string;
  rating: number;
  comment: string | null;
  trigger_reason: string | null;
  created_at: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
}

export interface AppRatingsSummary {
  total: number;
  avg_rating: number | null;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
}

/** Submete a avaliação do usuário logado (servidor valida estrelas + 30 chars). */
export async function submitAppRating(rating: number, comment: string, trigger?: string): Promise<void> {
  const { error } = await supabase.rpc('submit_app_rating', {
    p_rating: rating,
    p_comment: comment,
    p_trigger: trigger ?? null,
  });
  if (error) throw error;
}

/** Admin: lista as avaliações recebidas. */
export async function adminListAppRatings(limit = 200): Promise<AppRatingRow[]> {
  const { data, error } = await supabase.rpc('admin_list_app_ratings', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as AppRatingRow[];
}

/** Admin: resumo (total, média, distribuição por estrela). */
export async function adminAppRatingsSummary(): Promise<AppRatingsSummary> {
  const { data, error } = await supabase.rpc('admin_app_ratings_summary');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as AppRatingsSummary | undefined;
  return row ?? { total: 0, avg_rating: null, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
}

/** Admin: o Mozart manda uma DM pro usuário (cria/reusa a conversa). */
export async function adminMozartDm(userId: string, message: string): Promise<void> {
  const { error } = await supabase.rpc('admin_mozart_dm', { p_user: userId, p_message: message });
  if (error) throw error;
}

export const qkRatings = {
  list: ['admin', 'app-ratings', 'list'] as const,
  summary: ['admin', 'app-ratings', 'summary'] as const,
};
