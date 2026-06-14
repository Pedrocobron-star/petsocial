/**
 * Adoção responsável — mural de pets pra adoção.
 *
 * ONGs e tutores anunciam; a comunidade descobre e fala no WhatsApp. Anúncios
 * são públicos (SELECT pra todos); cada um gerencia os próprios (RLS owner).
 * Fotos vão pro bucket público `posts`.
 */

import { logAdminAction } from './admin-audit';
import { supabase } from './supabase';
import { deleteFromBucket } from './storage';

export type AdoptionSpecies = 'dog' | 'cat' | 'other';
export type AdoptionSex = 'male' | 'female' | 'unknown';
export type AdoptionSize = 'small' | 'medium' | 'large';
export type AdoptionStatus = 'available' | 'adopted' | 'paused';

export interface AdoptionListing {
  id: string;
  created_at: string;
  owner_id: string;
  status: AdoptionStatus;
  pet_name: string;
  species: AdoptionSpecies;
  breed: string | null;
  sex: AdoptionSex | null;
  age_label: string | null;
  size: AdoptionSize | null;
  city: string | null;
  uf: string | null;
  description: string;
  vaccinated: boolean;
  neutered: boolean;
  special_needs: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  image_urls: string[];
  video_url?: string | null;
  priority: number;
  /** Sinalizado pela heuristica anti-spam do servidor (link, venda, etc). */
  needs_review: boolean;
  /** Codigo do motivo do flag (a UI traduz). */
  review_reason: AdoptionReviewReason | null;
  /** Gate de moderacao: so vai pro mural depois que o admin aprova. */
  approved: boolean;
}

export type AdoptionReviewReason = 'external_link' | 'too_short' | 'possible_sale';

/** Traducao dos codigos de review_reason pra exibir no painel admin. */
export const REVIEW_REASON_LABEL: Record<AdoptionReviewReason, string> = {
  external_link: 'Link externo na descrição',
  too_short: 'Descrição muito curta',
  possible_sale: 'Possível venda (preço na descrição)',
};

export const SPECIES_META: Record<AdoptionSpecies, { label: string; emoji: string }> = {
  dog: { label: 'Cão', emoji: '🐶' },
  cat: { label: 'Gato', emoji: '🐱' },
  other: { label: 'Outro', emoji: '🐾' },
};
export const SEX_LABEL: Record<AdoptionSex, string> = {
  male: 'Macho',
  female: 'Fêmea',
  unknown: 'Não sei',
};
export const SIZE_LABEL: Record<AdoptionSize, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
};

// ============================================================================
// Leitura (mural público)
// ============================================================================

export interface AdoptionFilters {
  species?: AdoptionSpecies;
  uf?: string;
}

/**
 * Anúncios do mural: só os APROVADOS (passaram pela moderação de 24h).
 * Se `viewerId` for passado, inclui também os anúncios PENDENTES do próprio
 * dono — assim quem anuncia continua vendo o seu (com selo "Em análise") mesmo
 * antes de ir ao ar. Disponíveis primeiro, depois adotados/pausados.
 */
export async function fetchAdoptionListings(
  filters?: AdoptionFilters,
  viewerId?: string | null,
): Promise<AdoptionListing[]> {
  let q = supabase
    .from('adoption_listings')
    .select('*')
    .order('status', { ascending: true }) // 'adopted' < 'available' < 'paused' alfabeticamente — reordenamos abaixo
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });
  // Gate de moderação: público vê só aprovados; o dono vê também os próprios pendentes.
  if (viewerId) q = q.or(`approved.eq.true,owner_id.eq.${viewerId}`);
  else q = q.eq('approved', true);
  if (filters?.species) q = q.eq('species', filters.species);
  if (filters?.uf) q = q.eq('uf', filters.uf);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as AdoptionListing[];
  // Disponíveis primeiro
  const rank = (s: AdoptionStatus) => (s === 'available' ? 0 : s === 'paused' ? 1 : 2);
  return rows.sort((a, b) => rank(a.status) - rank(b.status));
}

export async function fetchAdoptionListing(id: string): Promise<AdoptionListing | null> {
  const { data, error } = await supabase
    .from('adoption_listings')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as AdoptionListing | null;
}

export async function fetchMyAdoptionListings(ownerId: string): Promise<AdoptionListing[]> {
  const { data, error } = await supabase
    .from('adoption_listings')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as AdoptionListing[];
}

// ============================================================================
// Escrita (dono)
// ============================================================================

export interface AdoptionInput {
  pet_name: string;
  species: AdoptionSpecies;
  breed?: string | null;
  sex?: AdoptionSex | null;
  age_label?: string | null;
  size?: AdoptionSize | null;
  city?: string | null;
  uf?: string | null;
  description: string;
  vaccinated?: boolean;
  neutered?: boolean;
  special_needs?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  image_urls?: string[];
  video_url?: string | null;
  status?: AdoptionStatus;
}

export async function createAdoptionListing(
  ownerId: string,
  input: AdoptionInput,
): Promise<AdoptionListing> {
  const { data, error } = await supabase
    .from('adoption_listings')
    .insert({
      owner_id: ownerId,
      pet_name: input.pet_name,
      species: input.species,
      breed: input.breed ?? null,
      sex: input.sex ?? null,
      age_label: input.age_label ?? null,
      size: input.size ?? null,
      city: input.city ?? null,
      uf: input.uf ?? null,
      description: input.description,
      vaccinated: input.vaccinated ?? false,
      neutered: input.neutered ?? false,
      special_needs: input.special_needs ?? null,
      contact_name: input.contact_name ?? null,
      contact_phone: input.contact_phone ?? null,
      image_urls: input.image_urls ?? [],
      video_url: input.video_url ?? null,
      status: input.status ?? 'available',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AdoptionListing;
}

export async function updateAdoptionListing(id: string, patch: Partial<AdoptionInput>): Promise<void> {
  const { error } = await supabase.from('adoption_listings').update(patch).eq('id', id);
  if (error) throw error;
}

export async function setAdoptionStatus(id: string, status: AdoptionStatus): Promise<void> {
  const { error } = await supabase.from('adoption_listings').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteAdoptionListing(id: string): Promise<void> {
  // Pega as URLs das mídias antes de apagar a linha (pra limpar o storage depois).
  const { data: row } = await supabase
    .from('adoption_listings')
    .select('image_urls, video_url')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('adoption_listings').delete().eq('id', id);
  if (error) throw error;

  // Best-effort: remove as mídias órfãs do bucket público `posts`.
  const urls = [
    ...((row?.image_urls ?? []) as string[]),
    ...((row?.video_url ? [row.video_url] : []) as string[]),
  ];
  await Promise.all(urls.map((u) => deleteFromBucket('posts', u)));
}

// ============================================================================
// Moderação (admin)
// ============================================================================

/**
 * Fila de moderação: anúncios PENDENTES de aprovação (approved=false) OU
 * sinalizados pela heurística anti-spam (needs_review=true, ex. um aprovado que
 * foi editado pra algo suspeito). Mais recentes primeiro.
 */
export async function adminListAdoptionForReview(): Promise<AdoptionListing[]> {
  const { data, error } = await supabase
    .from('adoption_listings')
    .select('*')
    .or('approved.eq.false,needs_review.eq.true')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdoptionListing[];
}

/** Aprova o anúncio: vai pro mural (approved=true) e limpa o flag anti-spam. */
export async function adminApproveAdoption(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_adoption_approved', {
    p_id: id,
    p_approved: true,
  });
  if (error) throw error;
  void logAdminAction('approve', 'adoption_listing', id);
}

/** Remove o anúncio (viola regras) — apaga linha + limpa fotos do bucket. */
export async function adminDeleteAdoption(id: string, petName?: string): Promise<void> {
  const { data, error } = await supabase.rpc('admin_delete_adoption', { p_id: id });
  if (error) throw error;
  void logAdminAction('delete', 'adoption_listing', id, { pet_name: petName ?? null });
  const urls = (data ?? []) as string[];
  await Promise.all(urls.map((u) => deleteFromBucket('posts', u).catch(() => undefined)));
}

/** Monta o resumo de chips (espécie · sexo · porte · idade). */
export function listingChips(l: AdoptionListing): string[] {
  const chips: string[] = [SPECIES_META[l.species].label];
  if (l.sex) chips.push(SEX_LABEL[l.sex]);
  if (l.size) chips.push(SIZE_LABEL[l.size]);
  if (l.age_label) chips.push(l.age_label);
  return chips;
}
