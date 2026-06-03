/**
 * Catálogo de antiparasitários comuns no Brasil — base do sistema de lembrete.
 * Cada produto tem intervalo de reaplicação em dias, baseado na bula oficial.
 * Quando o tutor registra uma aplicação, calculamos next_due_at = applied_at + interval_days.
 *
 * Se o tutor não achar o produto na lista, ele pode cadastrar custom com intervalo manual.
 *
 * Fontes: bulas MAPA-aprovadas (Bravecto, NexGard, Simparic, Seresto, Drontal,
 * Vermivet, Endogard, Milbemax, Heartgard, Advocate, Frontline).
 */

import type { Species } from './types';

export type ParasiteKind = 'internal' | 'external' | 'heartworm' | 'combined';

export interface ParasiteProduct {
  slug: string;
  brand: string;
  kind: ParasiteKind;
  /** Intervalo em dias entre aplicações (default da bula adulto). */
  interval_days: number;
  /** Espécies suportadas. */
  species: Species[];
  /** Forma de administração. */
  form: 'oral' | 'topical' | 'collar' | 'injectable';
  /** Lista curta de parasitas cobertos pra mostrar no card. */
  covers: string[];
  /** Emoji decorativo. */
  emoji: string;
  /** Cor tonal pro tag visual (background + text). */
  tint: { bg: string; text: string };
}

export const PARASITE_PRODUCTS: ParasiteProduct[] = [
  // ====== EXTERNOS (pulga / carrapato) ======
  {
    slug: 'bravecto',
    brand: 'Bravecto',
    kind: 'external',
    interval_days: 90,
    species: ['dog'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato'],
    emoji: '🦴',
    tint: { bg: '#FEE2E2', text: '#991B1B' },
  },
  {
    slug: 'bravecto-1mo',
    brand: 'Bravecto Plus (gato)',
    kind: 'combined',
    interval_days: 60,
    species: ['cat'],
    form: 'topical',
    covers: ['Pulga', 'Carrapato', 'Vermes', 'Coração'],
    emoji: '💧',
    tint: { bg: '#FEE2E2', text: '#991B1B' },
  },
  {
    slug: 'nexgard',
    brand: 'NexGard',
    kind: 'external',
    interval_days: 30,
    species: ['dog'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato'],
    emoji: '🦴',
    tint: { bg: '#FEF3C7', text: '#92400E' },
  },
  {
    slug: 'nexgard-spectra',
    brand: 'NexGard Spectra',
    kind: 'combined',
    interval_days: 30,
    species: ['dog'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato', 'Vermes', 'Coração'],
    emoji: '🦴',
    tint: { bg: '#FEF3C7', text: '#92400E' },
  },
  {
    slug: 'simparic',
    brand: 'Simparic',
    kind: 'external',
    interval_days: 35,
    species: ['dog'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato', 'Sarna'],
    emoji: '🦴',
    tint: { bg: '#DBEAFE', text: '#1E40AF' },
  },
  {
    slug: 'simparic-trio',
    brand: 'Simparic Trio',
    kind: 'combined',
    interval_days: 30,
    species: ['dog'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato', 'Vermes', 'Coração'],
    emoji: '🦴',
    tint: { bg: '#DBEAFE', text: '#1E40AF' },
  },
  {
    slug: 'frontline-plus',
    brand: 'Frontline Plus',
    kind: 'external',
    interval_days: 30,
    species: ['dog', 'cat'],
    form: 'topical',
    covers: ['Pulga', 'Carrapato', 'Piolho'],
    emoji: '💧',
    tint: { bg: '#E0E7FF', text: '#3730A3' },
  },
  {
    slug: 'frontline-tri-act',
    brand: 'Frontline Tri-Act',
    kind: 'external',
    interval_days: 30,
    species: ['dog'],
    form: 'topical',
    covers: ['Pulga', 'Carrapato', 'Mosquito'],
    emoji: '💧',
    tint: { bg: '#E0E7FF', text: '#3730A3' },
  },
  {
    slug: 'seresto',
    brand: 'Coleira Seresto',
    kind: 'external',
    interval_days: 240, // 8 meses
    species: ['dog', 'cat'],
    form: 'collar',
    covers: ['Pulga', 'Carrapato'],
    emoji: '🎀',
    tint: { bg: '#F3E8FF', text: '#6B21A8' },
  },
  {
    slug: 'advantage',
    brand: 'Advantage',
    kind: 'external',
    interval_days: 30,
    species: ['dog', 'cat'],
    form: 'topical',
    covers: ['Pulga'],
    emoji: '💧',
    tint: { bg: '#FEE2E2', text: '#991B1B' },
  },
  {
    slug: 'credelio',
    brand: 'Credelio',
    kind: 'external',
    interval_days: 30,
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Pulga', 'Carrapato'],
    emoji: '🦴',
    tint: { bg: '#DCFCE7', text: '#166534' },
  },
  {
    slug: 'capstar',
    brand: 'Capstar',
    kind: 'external',
    interval_days: 1, // ação imediata
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Pulga (choque)'],
    emoji: '⚡',
    tint: { bg: '#FEE2E2', text: '#991B1B' },
  },

  // ====== INTERNOS (vermífugos) ======
  {
    slug: 'drontal',
    brand: 'Drontal',
    kind: 'internal',
    interval_days: 90, // 3 meses (adulto)
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Vermes redondos', 'Vermes chatos'],
    emoji: '💊',
    tint: { bg: '#FEF3C7', text: '#92400E' },
  },
  {
    slug: 'drontal-plus',
    brand: 'Drontal Plus',
    kind: 'internal',
    interval_days: 90,
    species: ['dog'],
    form: 'oral',
    covers: ['Ascarídios', 'Ancilostomídeos', 'Tênias'],
    emoji: '💊',
    tint: { bg: '#FEF3C7', text: '#92400E' },
  },
  {
    slug: 'vermivet',
    brand: 'Vermivet',
    kind: 'internal',
    interval_days: 90,
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Vermes redondos', 'Vermes chatos'],
    emoji: '💊',
    tint: { bg: '#FED7AA', text: '#9A3412' },
  },
  {
    slug: 'endogard',
    brand: 'Endogard',
    kind: 'internal',
    interval_days: 90,
    species: ['dog'],
    form: 'oral',
    covers: ['Vermes redondos', 'Vermes chatos'],
    emoji: '💊',
    tint: { bg: '#FED7AA', text: '#9A3412' },
  },
  {
    slug: 'milbemax',
    brand: 'Milbemax',
    kind: 'internal',
    interval_days: 90,
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Vermes', 'Coração'],
    emoji: '💊',
    tint: { bg: '#DBEAFE', text: '#1E40AF' },
  },
  {
    slug: 'vermifugo-puppy',
    brand: 'Vermífugo filhote',
    kind: 'internal',
    interval_days: 14, // 2 semanas pra filhote
    species: ['dog', 'cat'],
    form: 'oral',
    covers: ['Vermes redondos'],
    emoji: '🐶',
    tint: { bg: '#FCE7F3', text: '#9D174D' },
  },

  // ====== CORAÇÃO (Dirofilaria) ======
  {
    slug: 'heartgard-plus',
    brand: 'Heartgard Plus',
    kind: 'heartworm',
    interval_days: 30,
    species: ['dog'],
    form: 'oral',
    covers: ['Verme do coração'],
    emoji: '❤️',
    tint: { bg: '#FCE7F3', text: '#BE185D' },
  },
  {
    slug: 'advocate',
    brand: 'Advocate',
    kind: 'combined',
    interval_days: 30,
    species: ['dog', 'cat'],
    form: 'topical',
    covers: ['Pulga', 'Vermes', 'Coração', 'Sarna'],
    emoji: '💧',
    tint: { bg: '#E0E7FF', text: '#3730A3' },
  },
  {
    slug: 'revolution',
    brand: 'Revolution',
    kind: 'combined',
    interval_days: 30,
    species: ['dog', 'cat'],
    form: 'topical',
    covers: ['Pulga', 'Vermes', 'Coração'],
    emoji: '💧',
    tint: { bg: '#E0E7FF', text: '#3730A3' },
  },
];

/**
 * Filtra produtos por espécie + kind opcional.
 */
export function filterProducts(species: Species, kind?: ParasiteKind): ParasiteProduct[] {
  return PARASITE_PRODUCTS.filter((p) => {
    const speciesMatch = p.species.includes(species);
    const kindMatch = kind ? p.kind === kind : true;
    return speciesMatch && kindMatch;
  });
}

/**
 * Busca um produto pelo slug.
 */
export function getProduct(slug: string | null | undefined): ParasiteProduct | null {
  if (!slug) return null;
  return PARASITE_PRODUCTS.find((p) => p.slug === slug) ?? null;
}

/**
 * Label em português pra cada kind.
 */
export const KIND_LABEL: Record<ParasiteKind, string> = {
  internal: 'Vermífugo',
  external: 'Pulga & Carrapato',
  heartworm: 'Verme do coração',
  combined: 'Tudo em um',
};

export const KIND_EMOJI: Record<ParasiteKind, string> = {
  internal: '💊',
  external: '🦟',
  heartworm: '❤️',
  combined: '✨',
};

/**
 * Formata intervalo em dias em texto humano: 30 → "1 mês", 90 → "3 meses", 240 → "8 meses".
 */
export function formatInterval(days: number): string {
  if (days === 1) return 'dose única';
  if (days < 7) return `${days} dias`;
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  }
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? 'ano' : 'anos'}`;
}
