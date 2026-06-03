/**
 * Catálogo de marcas comuns de ração no mercado brasileiro pra quick chips
 * no form de dieta. NÃO é exaustivo — o tutor sempre pode digitar marca custom.
 *
 * Fontes: Cobasi, Petz, marketplaces principais de pet shop BR.
 */

import type { DietFoodType } from './types';

export interface DietBrand {
  name: string;
  /** Tier: super-premium (alto custo), premium (médio), standard (popular). */
  tier: 'super_premium' | 'premium' | 'standard';
}

export const DIET_BRANDS_DOG: DietBrand[] = [
  { name: 'Royal Canin', tier: 'super_premium' },
  { name: "Hill's Science Diet", tier: 'super_premium' },
  { name: 'Premier', tier: 'super_premium' },
  { name: 'Pro Plan', tier: 'super_premium' },
  { name: 'Golden', tier: 'premium' },
  { name: 'Magnus', tier: 'premium' },
  { name: 'GranPlus', tier: 'premium' },
  { name: 'Equilíbrio', tier: 'premium' },
  { name: 'Biofresh', tier: 'premium' },
  { name: 'Pedigree', tier: 'standard' },
  { name: 'Dog Chow', tier: 'standard' },
  { name: 'Faro', tier: 'standard' },
  { name: 'Foster', tier: 'standard' },
];

export const DIET_BRANDS_CAT: DietBrand[] = [
  { name: 'Royal Canin', tier: 'super_premium' },
  { name: "Hill's Science Diet", tier: 'super_premium' },
  { name: 'Premier Cat', tier: 'super_premium' },
  { name: 'Pro Plan Cat', tier: 'super_premium' },
  { name: 'GranPlus Gato', tier: 'premium' },
  { name: 'Equilíbrio Cat', tier: 'premium' },
  { name: 'Magnus Cat', tier: 'premium' },
  { name: 'Whiskas', tier: 'standard' },
  { name: 'Friskies', tier: 'standard' },
  { name: 'Felix', tier: 'standard' },
];

export function brandsForSpecies(species: string): DietBrand[] {
  if (species === 'cat') return DIET_BRANDS_CAT;
  if (species === 'dog') return DIET_BRANDS_DOG;
  return [];
}

export const FOOD_TYPE_META: Record<DietFoodType, { label: string; emoji: string }> = {
  dry_food: { label: 'Ração seca', emoji: '🥣' },
  wet_food: { label: 'Ração úmida (sachê)', emoji: '🍲' },
  natural: { label: 'Alimentação natural', emoji: '🥩' },
  mixed: { label: 'Mista', emoji: '🥗' },
  puppy: { label: 'Filhote', emoji: '🍼' },
  senior: { label: 'Sênior', emoji: '👴' },
  special: { label: 'Especial / terapêutica', emoji: '💊' },
};

/**
 * Calcula custo mensal estimado da dieta.
 * Retorna null se faltar dado (gramas diárias ou tamanho/custo do pacote).
 */
export function monthlyDietCost(input: {
  daily_amount_g: number | null;
  package_size_g: number | null;
  package_cost_brl: number | null;
}): number | null {
  if (!input.daily_amount_g || !input.package_size_g || input.package_cost_brl == null) {
    return null;
  }
  if (input.package_size_g <= 0) return null;
  const days = 30;
  const totalG = input.daily_amount_g * days;
  const packages = totalG / input.package_size_g;
  return Math.round(packages * input.package_cost_brl * 100) / 100;
}
