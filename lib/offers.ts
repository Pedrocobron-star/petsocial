/**
 * Clube de vantagens — ofertas dos patrocinadores.
 *
 * Segundo motor de receita: marcas/petshops pagam pra aparecer com cupom numa
 * aba dedicada. Usuário vê ativas, copia cupom, vai pro site (track_offer_click).
 * Admin gerencia via RLS is_admin().
 */

import { logAdminAction } from './admin-audit';
import { supabase } from './supabase';

export type OfferCategory = 'racao' | 'petshop' | 'saude' | 'servico' | 'acessorio' | 'outro';

export interface Offer {
  id: string;
  created_at: string;
  active: boolean;
  title: string;
  brand: string;
  description: string | null;
  discount_label: string | null;
  coupon_code: string | null;
  cta_url: string;
  cta_label: string;
  category: OfferCategory;
  image_url: string | null;
  valid_until: string | null;
  priority: number;
  clicks_count: number;
  notes: string | null;
  created_by: string | null;
}

export const OFFER_CATEGORIES: { key: OfferCategory; label: string; emoji: string }[] = [
  { key: 'racao', label: 'Ração & comida', emoji: '🥣' },
  { key: 'petshop', label: 'Petshop', emoji: '🛒' },
  { key: 'saude', label: 'Saúde & vet', emoji: '🩺' },
  { key: 'servico', label: 'Serviços', emoji: '✂️' },
  { key: 'acessorio', label: 'Acessórios', emoji: '🦴' },
  { key: 'outro', label: 'Outros', emoji: '🎁' },
];

export function offerCategoryMeta(c: OfferCategory) {
  return OFFER_CATEGORIES.find((x) => x.key === c) ?? OFFER_CATEGORIES[5];
}

// ============================================================================
// Usuário
// ============================================================================

/**
 * Ofertas ativas e não vencidas, ordenadas por prioridade.
 * Usa o RPC `offers_active()` (só colunas públicas) em vez de select('*') —
 * a tabela `offers` guarda `notes` (notas internas do admin: contato/valor pago
 * do parceiro) e `created_by`, que NÃO podem trafegar pro usuário. O SELECT
 * direto na tabela agora é admin-only (RLS); o público lê por aqui.
 */
export async function fetchActiveOffers(): Promise<Offer[]> {
  const { data, error } = await supabase.rpc('offers_active');
  if (error) return [];
  // O RPC não devolve notes/created_by/clicks_count (internos/admin) —
  // completa o shape do tipo com valores neutros.
  return ((data ?? []) as Omit<Offer, 'notes' | 'created_by' | 'clicks_count'>[]).map((o) => ({
    ...o,
    notes: null,
    created_by: null,
    clicks_count: 0,
  }));
}

/** Incrementa o contador de cliques. Fire-and-forget. */
export async function trackOfferClick(offerId: string): Promise<void> {
  try {
    await supabase.rpc('track_offer_click', { p_offer_id: offerId });
  } catch {
    // ignora
  }
}

// ============================================================================
// Admin
// ============================================================================

/** Lista TODAS as ofertas (admin vê tudo via RLS is_admin). */
export async function adminListOffers(): Promise<Offer[]> {
  const { data, error } = await supabase
    .from('offers')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Offer[];
}

export interface OfferInput {
  active?: boolean;
  title: string;
  brand: string;
  description?: string | null;
  discount_label?: string | null;
  coupon_code?: string | null;
  cta_url: string;
  cta_label?: string;
  category?: OfferCategory;
  image_url?: string | null;
  valid_until?: string | null;
  priority?: number;
  notes?: string | null;
}

export async function adminCreateOffer(input: OfferInput): Promise<Offer> {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      active: input.active ?? true,
      title: input.title,
      brand: input.brand,
      description: input.description ?? null,
      discount_label: input.discount_label ?? null,
      coupon_code: input.coupon_code ?? null,
      cta_url: input.cta_url,
      cta_label: input.cta_label ?? 'Aproveitar',
      category: input.category ?? 'outro',
      image_url: input.image_url ?? null,
      valid_until: input.valid_until ?? null,
      priority: input.priority ?? 0,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Offer;
}

export async function adminUpdateOffer(id: string, patch: Partial<OfferInput>): Promise<void> {
  const { error } = await supabase.from('offers').update(patch).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteOffer(id: string): Promise<void> {
  const existing = await adminFetchOffer(id).catch(() => null);
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) throw error;
  void logAdminAction('delete', 'offer', id, {
    brand: existing?.brand ?? null,
    title: existing?.title ?? null,
  });
}

export async function adminFetchOffer(id: string): Promise<Offer | null> {
  const { data, error } = await supabase.from('offers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Offer | null;
}
