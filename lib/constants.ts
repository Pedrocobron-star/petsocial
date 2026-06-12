import type { MeetupCategory, SocialTemperament, Species } from './types';

/**
 * Feature flag — Tira-dúvidas de Saúde (`pet/[id]/ai-assistant`).
 * Hoje é um GUIA LOCAL de referência (lib/health-guide.ts): respostas curadas,
 * sem LLM, sem rede, custo ZERO. Por isso fica LIGADO. (Antes era um assistente
 * IA via edge function paga, que ficava desligado pra não gerar custo.)
 */
export const HEALTH_GUIDE_ENABLED = true;

export const SPECIES_OPTIONS: { value: Species; label: string; emoji: string }[] = [
  { value: 'dog', label: 'Cachorro', emoji: '🐶' },
  { value: 'cat', label: 'Gato', emoji: '🐱' },
  { value: 'bird', label: 'Pássaro', emoji: '🦜' },
  { value: 'rabbit', label: 'Coelho', emoji: '🐰' },
  { value: 'rodent', label: 'Roedor', emoji: '🐹' },
  { value: 'reptile', label: 'Réptil', emoji: '🦎' },
  { value: 'fish', label: 'Peixe', emoji: '🐠' },
  { value: 'other', label: 'Outro', emoji: '🐾' },
];

export const speciesEmoji = (s: Species) =>
  SPECIES_OPTIONS.find((o) => o.value === s)?.emoji ?? '🐾';

export const speciesLabel = (s: Species) =>
  SPECIES_OPTIONS.find((o) => o.value === s)?.label ?? 'Outro';

export const TEMPERAMENT_OPTIONS: { value: SocialTemperament; label: string; emoji: string; desc: string }[] = [
  { value: 'sociable', label: 'Sociável', emoji: '😄', desc: 'Adora fazer amizade com outros pets' },
  { value: 'shy', label: 'Tímido', emoji: '😌', desc: 'Mais reservado, precisa de tempo pra confiar' },
  { value: 'needs_space', label: 'Precisa de espaço', emoji: '🛡️', desc: 'Prefere ficar mais isolado' },
  { value: 'mixed', label: 'Depende do dia', emoji: '🌤️', desc: 'Varia entre extrovertido e quieto' },
];

export const temperamentLabel = (t: SocialTemperament | null | undefined) =>
  t ? TEMPERAMENT_OPTIONS.find((o) => o.value === t)?.label ?? null : null;

export const temperamentEmoji = (t: SocialTemperament | null | undefined) =>
  t ? TEMPERAMENT_OPTIONS.find((o) => o.value === t)?.emoji ?? null : null;

export const MEETUP_CATEGORIES: { value: MeetupCategory; label: string; emoji: string }[] = [
  { value: 'social', label: 'Social', emoji: '🐾' },
  { value: 'walk', label: 'Passeio', emoji: '🚶' },
  { value: 'play', label: 'Brincar', emoji: '🎾' },
  { value: 'training', label: 'Adestramento', emoji: '🎓' },
  { value: 'birthday', label: 'Aniversário', emoji: '🎂' },
  { value: 'bath', label: 'Banho', emoji: '🛁' },
  { value: 'other', label: 'Outro', emoji: '✨' },
];

export const meetupCategoryLabel = (c: MeetupCategory) =>
  MEETUP_CATEGORIES.find((o) => o.value === c)?.label ?? 'Social';

export const meetupCategoryEmoji = (c: MeetupCategory) =>
  MEETUP_CATEGORIES.find((o) => o.value === c)?.emoji ?? '🐾';
