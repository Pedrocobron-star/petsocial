/**
 * Recalls — alertas de recall de ração/medicamento/petisco cruzados com os
 * produtos que o tutor registra no app.
 *
 * Modelo:
 *  - `recalls` é curado pelo admin (de Anvisa/MAPA/fabricantes/comunidade).
 *  - O app busca recalls ativos e cruza a `brand`/`product_name` com o que o
 *    tutor registra: ração ativa (pet_diet_logs.brand), antiparasitário
 *    (parasite_treatments.product_name) e medicação (medications.name).
 *  - Se bater, mostra um alerta com link pra fonte oficial.
 *
 * Por que client-side matching: o volume de recalls ativos é baixo (poucos por
 * vez) e os produtos do tutor também — cruzar no cliente evita uma RPC pesada e
 * mantém a privacidade (nenhum produto do tutor vai pro servidor pra matching).
 */

import {
  fetchActiveDiet,
  fetchMedications,
  fetchParasiteTreatments,
} from './queries';
import { supabase } from './supabase';
import type { Pet } from './types';

// ============================================================================
// Tipos
// ============================================================================

export type RecallSeverity = 'low' | 'medium' | 'high';
export type RecallCategory =
  | 'racao'
  | 'petisco'
  | 'medicamento'
  | 'antipulga'
  | 'acessorio'
  | 'outro';
export type RecallSource = 'Anvisa' | 'MAPA' | 'Fabricante' | 'Imprensa' | 'Comunidade';

export interface Recall {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  active: boolean;
  severity: RecallSeverity;
  category: RecallCategory;
  brand: string;
  product_name: string | null;
  title: string;
  description: string;
  affected_lots: string | null;
  source: RecallSource;
  source_url: string | null;
  published_at: string | null;
  region: string | null;
  notes: string | null;
}

/** Recall + quais pets/produtos do tutor bateram. */
export interface RecallMatch {
  recall: Recall;
  /** Produtos do tutor que casaram (ex: "Golden Formula", "Drontal"). */
  matchedProducts: string[];
  /** Pets afetados pelo match. */
  matchedPets: { id: string; name: string }[];
}

// ============================================================================
// Feed (usuário comum)
// ============================================================================

/** Busca todos os recalls ativos. Silencia erro se a tabela ainda não existe. */
export async function fetchActiveRecalls(): Promise<Recall[]> {
  const { data, error } = await supabase
    .from('recalls')
    .select('*')
    .eq('active', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as Recall[];
}

/**
 * Cruza os recalls ativos com os produtos registrados de TODOS os pets do
 * tutor. Retorna só os recalls que bateram, com os pets/produtos afetados.
 *
 * Matching: case-insensitive, exige a `brand` do recall (>= 3 chars) aparecer
 * no nome do produto do tutor (ou vice-versa). Evita falso-positivo de marcas
 * muito curtas.
 */
export async function fetchRecallMatchesForPets(pets: Pet[]): Promise<RecallMatch[]> {
  if (pets.length === 0) return [];
  const recalls = await fetchActiveRecalls();
  if (recalls.length === 0) return [];

  // Junta os produtos de cada pet (ração ativa + antiparasitários + medicações)
  const petProducts = await Promise.all(
    pets.map(async (pet) => {
      const [diet, parasites, meds] = await Promise.all([
        fetchActiveDiet(pet.id).catch(() => null),
        fetchParasiteTreatments(pet.id).catch(() => []),
        fetchMedications(pet.id).catch(() => []),
      ]);
      const products: string[] = [];
      if (diet) {
        if (diet.brand) products.push(diet.brand);
        if (diet.product_name) products.push(diet.product_name);
      }
      for (const p of parasites) {
        if (p.product_name) products.push(p.product_name);
      }
      for (const m of meds) {
        if (m.name) products.push(m.name);
      }
      return { pet, products };
    }),
  );

  const matches: RecallMatch[] = [];
  for (const recall of recalls) {
    const matchedProducts = new Set<string>();
    const matchedPets: { id: string; name: string }[] = [];

    for (const { pet, products } of petProducts) {
      let petMatched = false;
      for (const product of products) {
        if (productMatchesRecall(product, recall)) {
          matchedProducts.add(product);
          petMatched = true;
        }
      }
      if (petMatched) matchedPets.push({ id: pet.id, name: pet.name });
    }

    if (matchedPets.length > 0) {
      matches.push({
        recall,
        matchedProducts: [...matchedProducts],
        matchedPets,
      });
    }
  }

  // Ordena por severidade (high primeiro)
  const sev: Record<RecallSeverity, number> = { high: 0, medium: 1, low: 2 };
  return matches.sort((a, b) => sev[a.recall.severity] - sev[b.recall.severity]);
}

/** True se o produto do tutor casa com a marca/produto do recall. */
function productMatchesRecall(product: string, recall: Recall): boolean {
  const p = normalize(product);
  const brand = normalize(recall.brand);
  if (brand.length < 3) return false;
  // Marca do recall aparece no produto do tutor (ex: "golden" em "golden formula")
  if (p.includes(brand)) return true;
  // Produto específico do recall casa com o do tutor
  if (recall.product_name) {
    const prod = normalize(recall.product_name);
    if (prod.length >= 3 && (p.includes(prod) || prod.includes(p))) return true;
  }
  return false;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .trim();
}

// ============================================================================
// Admin CRUD
// ============================================================================

export async function adminListRecalls(): Promise<Recall[]> {
  const { data, error } = await supabase.rpc('admin_recalls_list');
  if (error) throw error;
  return (data ?? []) as Recall[];
}

export interface RecallInput {
  active?: boolean;
  severity?: RecallSeverity;
  category?: RecallCategory;
  brand: string;
  product_name?: string | null;
  title: string;
  description: string;
  affected_lots?: string | null;
  source?: RecallSource;
  source_url?: string | null;
  published_at?: string | null;
  region?: string | null;
  notes?: string | null;
}

export async function adminCreateRecall(input: RecallInput): Promise<Recall> {
  const { data, error } = await supabase
    .from('recalls')
    .insert({
      active: input.active ?? true,
      severity: input.severity ?? 'medium',
      category: input.category ?? 'racao',
      brand: input.brand,
      product_name: input.product_name ?? null,
      title: input.title,
      description: input.description,
      affected_lots: input.affected_lots ?? null,
      source: input.source ?? 'Fabricante',
      source_url: input.source_url ?? null,
      published_at: input.published_at ?? new Date().toISOString(),
      region: input.region ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Recall;
}

export async function adminUpdateRecall(id: string, patch: Partial<RecallInput>): Promise<void> {
  const { error } = await supabase.from('recalls').update(patch).eq('id', id);
  if (error) throw error;
}

export async function adminDeleteRecall(id: string): Promise<void> {
  const { error } = await supabase.from('recalls').delete().eq('id', id);
  if (error) throw error;
}

export async function adminFetchRecall(id: string): Promise<Recall | null> {
  const { data, error } = await supabase.from('recalls').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Recall | null;
}

// ============================================================================
// Helpers de exibição
// ============================================================================

export const RECALL_SEVERITY_LABEL: Record<RecallSeverity, string> = {
  high: 'Risco grave',
  medium: 'Atenção',
  low: 'Precaução',
};

export const RECALL_CATEGORY_LABEL: Record<RecallCategory, string> = {
  racao: 'Ração',
  petisco: 'Petisco',
  medicamento: 'Medicamento',
  antipulga: 'Antipulga/Vermífugo',
  acessorio: 'Acessório',
  outro: 'Outro',
};
