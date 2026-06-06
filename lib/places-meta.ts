import type { PlaceKind } from './types';

/**
 * Metadata visual e funcional por categoria de lugar.
 * Centraliza emoji + cores + label num único lugar pra consistência
 * entre lista, detail, share poster e analytics.
 */
export interface PlaceKindMeta {
  label: string;
  emoji: string;
  /** Cor do ícone/accents (destaque). */
  color: string;
  /** Cor de fundo do card/hero (tinta suave). */
  bg: string;
  /** Cor escura pra texto sobre o bg. */
  text: string;
}

export const PLACE_KIND_META: Record<PlaceKind | 'other', PlaceKindMeta> = {
  vet: {
    label: 'Veterinário',
    emoji: '🩺',
    color: '#16A34A',
    bg: '#DCFCE7',
    text: '#14532D',
  },
  pet_shop: {
    label: 'Pet Shop',
    emoji: '🛍️',
    color: '#F59E0B',
    bg: '#FEF3C7',
    text: '#78350F',
  },
  grooming: {
    label: 'Banho & Tosa',
    emoji: '🛁',
    color: '#EC4899',
    bg: '#FCE7F3',
    text: '#831843',
  },
  hotel: {
    label: 'Hotel',
    emoji: '🏨',
    color: '#3B82F6',
    bg: '#DBEAFE',
    text: '#1E3A8A',
  },
  daycare: {
    label: 'Creche',
    emoji: '🐕',
    color: '#F97316',
    bg: '#FED7AA',
    text: '#9A3412',
  },
  park: {
    label: 'Parque',
    emoji: '🌳',
    color: '#10B981',
    bg: '#D1FAE5',
    text: '#064E3B',
  },
  training: {
    label: 'Adestrador',
    emoji: '🎓',
    color: '#8B5CF6',
    bg: '#EDE9FE',
    text: '#4C1D95',
  },
  restaurant: {
    label: 'Restaurante',
    emoji: '🍽️',
    color: '#EF4444',
    bg: '#FEE2E2',
    text: '#7F1D1D',
  },
  cafe: {
    label: 'Café',
    emoji: '☕',
    color: '#A16207',
    bg: '#FEF9C3',
    text: '#713F12',
  },
  event: {
    label: 'Evento',
    emoji: '🎉',
    color: '#D946EF',
    bg: '#FAE8FF',
    text: '#701A75',
  },
  beach: {
    label: 'Praia',
    emoji: '🏖️',
    color: '#06B6D4',
    bg: '#CFFAFE',
    text: '#164E63',
  },
  other: {
    label: 'Outro',
    emoji: '📍',
    color: '#737373',
    bg: '#F5F5F4',
    text: '#404040',
  },
};

export function placeKindMeta(kind: PlaceKind | string): PlaceKindMeta {
  return PLACE_KIND_META[(kind as PlaceKind) ?? 'other'] ?? PLACE_KIND_META.other;
}
