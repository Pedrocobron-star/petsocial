/**
 * Sponsored Posts — queries pro feed (usuário comum) + admin (CRUD + métricas).
 *
 * Modelo:
 *  - `sponsored_posts` é totalmente customizável (sponsor avatar, nome, handle,
 *    imagem, caption, CTA label + URL, datas, prioridade).
 *  - `sponsored_post_events` registra impression/click granular (RPC
 *    `track_sponsored_event`).
 *  - Counters denormalizados (`impressions_count`, `clicks_count`) atualizados
 *    via trigger no DB → leitura rápida no painel.
 *
 * RLS resumido:
 *  - SELECT `sponsored_posts`: qualquer authenticated, só os ativos+vigentes.
 *  - WRITE `sponsored_posts`: só admin (gated por `is_admin()`).
 *  - INSERT `sponsored_post_events`: qualquer authenticated (via RPC).
 *  - SELECT eventos brutos: só admin.
 *
 * ============================================================================
 * DECISÃO DE PRODUTO — Sponsored aparece pra TODOS os usuários (Free + Pro).
 * ============================================================================
 * Patrocinadores são a principal fonte de receita do Maestro Pet (mais que
 * Pet Pro, que sozinho não cobre custos de infra). Por isso Pro NÃO remove
 * anúncios — só remove os outros limites (posts/dia, pets, marca d'água, AI
 * rate limit, histórico de Score de Saúde). Anúncios continuam exibidos pra todos.
 *
 * Se um dia quisermos um tier mais alto ("Pet Pro+") que remove ads, basta
 * filtrar `sponsored_posts` pela subscription do user antes de chamar
 * `interleaveSponsored`. Hoje não é o caso — a feature `interleaveSponsored`
 * abaixo NÃO checa isPro de propósito.
 *
 * Refs:
 *  - copy do plano Pro em app/(app)/pro.tsx menciona "Anúncios discretos"
 *    como característica do free, MAS não promete "sem anúncios" pro Pro
 *  - upgrade-modal.tsx ajustada pra remover qualquer promessa de "sem ads"
 */

import { logAdminAction } from './admin-audit';
import { supabase } from './supabase';

// ============================================================================
// Tipos
// ============================================================================

export interface SponsoredPost {
  id: string;
  created_at: string;
  updated_at: string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  sponsor_name: string;
  sponsor_handle: string | null;
  sponsor_avatar_url: string | null;
  sponsor_verified: boolean;
  content: string | null;
  media_url: string;
  media_kind: 'image' | 'video';
  cta_label: string;
  cta_url: string;
  priority: number;
  impressions_count: number;
  clicks_count: number;
  target_audience: Record<string, unknown>;
  notes: string | null;
  created_by: string | null;
}

export type SponsoredStatus = 'active' | 'scheduled' | 'expired' | 'paused';

export interface SponsoredListRow extends SponsoredPost {
  ctr_pct: number;
  status: SponsoredStatus;
}

export interface SponsoredMetrics {
  total_impressions: number;
  total_clicks: number;
  ctr_pct: number;
  unique_users_impressions: number;
  unique_users_clicks: number;
  by_day_30d: { day: string; impressions: number; clicks: number }[];
}

// ============================================================================
// Feed (usuário comum)
// ============================================================================

/**
 * Busca sponsored posts ativos e vigentes, ordenados por priority.
 * Pegamos um máximo razoável (até 10) — o feed embaralha esses entre os posts
 * orgânicos.
 */
export async function fetchActiveSponsoredPosts(limit = 10): Promise<SponsoredPost[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('sponsored_posts')
    .select('*')
    .eq('active', true)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    // RLS / tabela ainda não existe → silencia, feed continua sem sponsored
    return [];
  }
  return (data ?? []) as SponsoredPost[];
}

/** Registra uma impression. Fire-and-forget. */
export async function trackSponsoredImpression(postId: string): Promise<void> {
  try {
    await supabase.rpc('track_sponsored_event', {
      p_post_id: postId,
      p_kind: 'impression',
      p_meta: {},
    });
  } catch {
    // ignora
  }
}

/** Registra um click. Fire-and-forget. */
export async function trackSponsoredClick(postId: string): Promise<void> {
  try {
    await supabase.rpc('track_sponsored_event', {
      p_post_id: postId,
      p_kind: 'click',
      p_meta: {},
    });
  } catch {
    // ignora
  }
}

// ============================================================================
// Helper: intercalar sponsored entre orgânicos
// ============================================================================

/**
 * Insere sponsored posts a cada N posts orgânicos. Retorna um array misto
 * tipado com discriminator pra o feed renderizar diferente.
 *
 * Ex: organicEvery = 5 → sponsored aparece nas posições 5, 11, 17, etc.
 * Se acabarem os sponsored, segue só com orgânicos.
 */
export type FeedItem<T> =
  | { kind: 'organic'; data: T; key: string }
  | { kind: 'sponsored'; data: SponsoredPost; key: string };

export function interleaveSponsored<T extends { id: string }>(
  organic: T[],
  sponsored: SponsoredPost[],
  organicEvery = 5,
): FeedItem<T>[] {
  if (sponsored.length === 0) {
    return organic.map((o) => ({ kind: 'organic' as const, data: o, key: `o-${o.id}` }));
  }
  const out: FeedItem<T>[] = [];
  let sponsoredIdx = 0;
  organic.forEach((post, i) => {
    out.push({ kind: 'organic', data: post, key: `o-${post.id}` });
    // Insere sponsored APÓS cada N-ésimo orgânico (1-indexed)
    if ((i + 1) % organicEvery === 0 && sponsoredIdx < sponsored.length) {
      const sp = sponsored[sponsoredIdx++];
      out.push({ kind: 'sponsored', data: sp, key: `s-${sp.id}` });
    }
  });
  return out;
}

// ============================================================================
// Admin CRUD
// ============================================================================

/** Lista TODOS sponsored posts (ativos, agendados, expirados, pausados). Admin only. */
export async function adminListSponsoredPosts(): Promise<SponsoredListRow[]> {
  const { data, error } = await supabase.rpc('admin_sponsored_list');
  if (error) throw error;
  return (data ?? []) as SponsoredListRow[];
}

/** Cria um novo sponsored post. Admin only via RLS. */
export interface SponsoredPostInput {
  active?: boolean;
  starts_at?: string;
  ends_at?: string | null;
  sponsor_name: string;
  sponsor_handle?: string | null;
  sponsor_avatar_url?: string | null;
  sponsor_verified?: boolean;
  content?: string | null;
  media_url: string;
  media_kind?: 'image' | 'video';
  cta_label?: string;
  cta_url: string;
  priority?: number;
  target_audience?: Record<string, unknown>;
  notes?: string | null;
}

export async function adminCreateSponsoredPost(input: SponsoredPostInput): Promise<SponsoredPost> {
  const { data, error } = await supabase
    .from('sponsored_posts')
    .insert({
      active: input.active ?? true,
      starts_at: input.starts_at ?? new Date().toISOString(),
      ends_at: input.ends_at ?? null,
      sponsor_name: input.sponsor_name,
      sponsor_handle: input.sponsor_handle ?? null,
      sponsor_avatar_url: input.sponsor_avatar_url ?? null,
      sponsor_verified: input.sponsor_verified ?? false,
      content: input.content ?? null,
      media_url: input.media_url,
      media_kind: input.media_kind ?? 'image',
      cta_label: input.cta_label ?? 'Saiba mais',
      cta_url: input.cta_url,
      priority: input.priority ?? 0,
      target_audience: input.target_audience ?? {},
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SponsoredPost;
}

export async function adminUpdateSponsoredPost(
  id: string,
  patch: Partial<SponsoredPostInput>,
): Promise<void> {
  const { error } = await supabase.from('sponsored_posts').update(patch).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteSponsoredPost(id: string): Promise<void> {
  const { error } = await supabase.from('sponsored_posts').delete().eq('id', id);
  if (error) throw error;
  // Hard-delete de recurso de RECEITA: registra na trilha de auditoria como
  // offer/news/adoption ja fazem (best-effort, nao bloqueia o delete).
  void logAdminAction('delete', 'sponsored_post', id);
}

export async function adminFetchSponsoredPost(id: string): Promise<SponsoredPost | null> {
  const { data, error } = await supabase
    .from('sponsored_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SponsoredPost | null;
}

export async function adminSponsoredMetrics(id: string): Promise<SponsoredMetrics> {
  const { data, error } = await supabase.rpc('admin_sponsored_metrics', { p_post_id: id });
  if (error) throw error;
  return data as SponsoredMetrics;
}
