/**
 * Catálogo de templates de rotina pra agenda do pet.
 * Coração do "Adicionar rotina em 1 tap" — onboarding rápido.
 *
 * Cada template tem:
 *  - kind: categoria do evento
 *  - default title/emoji/tint
 *  - default recurrence_rule
 *  - tip: dica fofa que aparece junto do evento
 *  - prompt: copy explicando quando usar
 */

import type { PetEventKind, RecurrenceRule, Species } from './types';

export interface EventKindMeta {
  emoji: string;
  label: string;
  tint: { bg: string; text: string };
  /** Default recurrence (pode ser overridden) */
  default_recurrence: RecurrenceRule | null;
  /** Mensagem fofa que aparece no card / notification */
  default_tip: string;
}

/**
 * Metadados de cada tipo de evento — usado no UI inteiro.
 */
export const EVENT_KIND_META: Record<PetEventKind, EventKindMeta> = {
  bath: {
    emoji: '🛁',
    label: 'Banho',
    tint: { bg: '#DBEAFE', text: '#1E40AF' },
    default_recurrence: 'every:30d',
    default_tip: 'Dia de spa! Lembra de secar bem as patinhas 💧',
  },
  grooming: {
    emoji: '✂️',
    label: 'Tosa',
    tint: { bg: '#F3E8FF', text: '#6B21A8' },
    default_recurrence: 'every:60d',
    default_tip: 'Hora do glow up ✨',
  },
  school: {
    emoji: '🎓',
    label: 'Escolinha',
    tint: { bg: '#FEF3C7', text: '#92400E' },
    default_recurrence: 'weekly:monday,wednesday,friday',
    default_tip: 'Hoje tem aula! Não esquece da mochilinha 🎒',
  },
  walk: {
    emoji: '🚶',
    label: 'Passeio',
    tint: { bg: '#DCFCE7', text: '#166534' },
    default_recurrence: 'weekly:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    default_tip: 'Bora pegar um ar! Coleira e sacolinha na mão 🦴',
  },
  vet_visit: {
    emoji: '🩺',
    label: 'Vet',
    tint: { bg: '#FEE2E2', text: '#991B1B' },
    default_recurrence: null,
    default_tip: 'Leva a carteirinha e papel de vacinas',
  },
  feeding: {
    emoji: '🍖',
    label: 'Alimentação',
    tint: { bg: '#FFEDD5', text: '#9A3412' },
    default_recurrence: 'every:1d',
    default_tip: 'Bom apetite!',
  },
  training: {
    emoji: '🏆',
    label: 'Treino',
    tint: { bg: '#E0E7FF', text: '#3730A3' },
    default_recurrence: 'weekly:tuesday,thursday',
    default_tip: 'Cabeça fresca + petiscos prontos',
  },
  playdate: {
    emoji: '🎾',
    label: 'Encontro',
    tint: { bg: '#FCE7F3', text: '#9D174D' },
    default_recurrence: null,
    default_tip: 'Dia de socializar! Leva água + brinquedo',
  },
  nail_trim: {
    emoji: '💅',
    label: 'Corte de unha',
    tint: { bg: '#FCE7F3', text: '#9D174D' },
    default_recurrence: 'every:15d',
    default_tip: 'Distrai com petisco e corta só a pontinha 🐾',
  },
  ear_cleaning: {
    emoji: '👂',
    label: 'Limpeza de ouvido',
    tint: { bg: '#F0FDFA', text: '#0F766E' },
    default_recurrence: 'every:15d',
    default_tip: 'Algodão úmido suave — nunca cotonete!',
  },
  tooth_brushing: {
    emoji: '🦷',
    label: 'Escovação',
    tint: { bg: '#F0F9FF', text: '#0C4A6E' },
    default_recurrence: 'every:3d',
    default_tip: 'Use pasta específica pra pet, nunca pasta humana ⚠️',
  },
  custom: {
    emoji: '⭐',
    label: 'Personalizado',
    tint: { bg: '#F5F5F5', text: '#404040' },
    default_recurrence: null,
    default_tip: '',
  },
};

/**
 * Templates pré-configurados que viram rotina com 1 tap.
 */
export interface EventTemplate {
  slug: string;
  kind: PetEventKind;
  title: string;
  description?: string;
  /** Dia/hora default (relativo). Default = próxima ocorrência ao adicionar */
  default_time_of_day: string; // "08:00"
  recurrence: RecurrenceRule | null;
  /** Recomendado para quais espécies */
  species: Species[];
  /** Custo estimado em R$ */
  estimated_cost?: number;
  /** Lembretes em minutos antes (default herdam de [1440, 0]) */
  reminders?: number[];
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  // Higiene
  {
    slug: 'bath-monthly',
    kind: 'bath',
    title: 'Banho mensal',
    description: 'Banho completo no petshop ou em casa',
    default_time_of_day: '10:00',
    recurrence: 'every:30d',
    species: ['dog'],
    estimated_cost: 80,
  },
  {
    slug: 'bath-15d',
    kind: 'bath',
    title: 'Banho quinzenal',
    description: 'Pra pets de pelo curto ou que ficam mais sujos',
    default_time_of_day: '10:00',
    recurrence: 'every:15d',
    species: ['dog'],
    estimated_cost: 80,
  },
  {
    slug: 'grooming-bimonthly',
    kind: 'grooming',
    title: 'Tosa higiênica',
    description: 'Patinhas, focinho e bumbum',
    default_time_of_day: '10:00',
    recurrence: 'every:45d',
    species: ['dog', 'cat'],
    estimated_cost: 50,
  },
  {
    slug: 'nail-trim-15d',
    kind: 'nail_trim',
    title: 'Corte de unha',
    description: 'Quando começa a fazer barulho no chão, tá na hora',
    default_time_of_day: '11:00',
    recurrence: 'every:15d',
    species: ['dog', 'cat'],
    estimated_cost: 20,
  },
  {
    slug: 'ear-cleaning',
    kind: 'ear_cleaning',
    title: 'Limpeza de ouvido',
    description: 'Crucial pra orelhas pendulares (Beagle, Cocker, Basset)',
    default_time_of_day: '20:00',
    recurrence: 'every:15d',
    species: ['dog'],
  },
  {
    slug: 'tooth-brushing-weekly',
    kind: 'tooth_brushing',
    title: 'Escovação dental',
    description: 'Previne tártaro e mau hálito',
    default_time_of_day: '20:00',
    recurrence: 'weekly:monday,wednesday,friday',
    species: ['dog', 'cat'],
  },

  // Educação & exercício
  {
    slug: 'school-mwf',
    kind: 'school',
    title: 'Escolinha — segunda, quarta, sexta',
    description: 'Adestramento ou creche',
    default_time_of_day: '14:00',
    recurrence: 'weekly:monday,wednesday,friday',
    species: ['dog'],
    estimated_cost: 400,
  },
  {
    slug: 'school-daily',
    kind: 'school',
    title: 'Creche todos os dias',
    description: 'Rotina full-time',
    default_time_of_day: '08:00',
    recurrence: 'weekly:monday,tuesday,wednesday,thursday,friday',
    species: ['dog'],
    estimated_cost: 1200,
  },
  {
    slug: 'walk-morning',
    kind: 'walk',
    title: 'Passeio matinal',
    description: 'Hora do xixi e cocô antes do trabalho',
    default_time_of_day: '07:00',
    recurrence: 'weekly:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    species: ['dog'],
  },
  {
    slug: 'walk-evening',
    kind: 'walk',
    title: 'Passeio da tarde',
    description: 'Pra esticar as patinhas',
    default_time_of_day: '18:00',
    recurrence: 'weekly:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    species: ['dog'],
  },
  {
    slug: 'training-weekly',
    kind: 'training',
    title: 'Treino em casa',
    description: '15min de comandos básicos + recompensa',
    default_time_of_day: '19:00',
    recurrence: 'weekly:tuesday,thursday,saturday',
    species: ['dog', 'cat'],
  },

  // Saúde
  {
    slug: 'vet-annual',
    kind: 'vet_visit',
    title: 'Check-up anual',
    description: 'Consulta de rotina + exames preventivos',
    default_time_of_day: '10:00',
    recurrence: 'every:365d',
    species: ['dog', 'cat', 'rabbit', 'bird'],
    estimated_cost: 300,
    reminders: [10080, 1440, 0], // 1 semana, 1 dia, na hora
  },
  {
    slug: 'vet-semester',
    kind: 'vet_visit',
    title: 'Check-up semestral (sênior)',
    description: 'Recomendado pra pets +7 anos',
    default_time_of_day: '10:00',
    recurrence: 'every:180d',
    species: ['dog', 'cat'],
    estimated_cost: 300,
    reminders: [10080, 1440, 0],
  },

  // Alimentação
  {
    slug: 'feeding-2x',
    kind: 'feeding',
    title: 'Ração — 2× por dia',
    description: 'Manhã e noite',
    default_time_of_day: '07:30',
    recurrence: 'weekly:monday,tuesday,wednesday,thursday,friday,saturday,sunday',
    species: ['dog', 'cat'],
  },

  // Playdates / social
  {
    slug: 'playdate-weekend',
    kind: 'playdate',
    title: 'Encontro no parque',
    description: 'Socialização semanal',
    default_time_of_day: '09:00',
    recurrence: 'weekly:saturday',
    species: ['dog'],
  },
];

/**
 * Filtra templates por espécie (e opcionalmente kind).
 */
export function filterTemplates(
  species: Species,
  kind?: PetEventKind,
): EventTemplate[] {
  return EVENT_TEMPLATES.filter((t) => {
    const speciesMatch = t.species.includes(species);
    const kindMatch = kind ? t.kind === kind : true;
    return speciesMatch && kindMatch;
  });
}

/**
 * Converte recurrence_rule em texto humano.
 * Examples:
 *   "every:30d"               → "a cada 30 dias"
 *   "weekly:monday,wednesday" → "segunda e quarta"
 *   "monthly"                 → "todo mês"
 *   null                      → "única"
 */
export function describeRecurrence(rule: RecurrenceRule | null): string {
  if (!rule) return 'única';
  if (rule === 'monthly') return 'todo mês';
  if (rule === 'yearly') return 'todo ano';
  if (rule.startsWith('every:')) {
    const num = parseInt(rule.split(':')[1], 10);
    if (rule.endsWith('d')) {
      if (num === 1) return 'todo dia';
      if (num === 7) return 'toda semana';
      if (num === 14) return 'a cada 2 semanas';
      if (num === 15) return 'quinzenal';
      if (num === 30) return 'mensal';
      if (num === 60) return 'a cada 2 meses';
      if (num === 90) return 'a cada 3 meses';
      if (num === 180) return 'semestral';
      if (num === 365) return 'anual';
      return `a cada ${num} dias`;
    }
  }
  if (rule.startsWith('weekly:')) {
    const days = rule.split(':')[1].split(',');
    const DAY_NAMES: Record<string, string> = {
      monday: 'seg',
      tuesday: 'ter',
      wednesday: 'qua',
      thursday: 'qui',
      friday: 'sex',
      saturday: 'sáb',
      sunday: 'dom',
    };
    if (days.length === 7) return 'todo dia';
    if (
      days.length === 5 &&
      days.includes('monday') &&
      days.includes('friday') &&
      !days.includes('saturday')
    )
      return 'dias de semana';
    if (days.length === 2 && days.includes('saturday') && days.includes('sunday'))
      return 'fim de semana';
    return days.map((d) => DAY_NAMES[d] ?? d).join(', ');
  }
  return rule;
}

/**
 * Dado uma RecurrenceRule e uma data base, calcula a próxima ocorrência depois de fromDate.
 * Retorna null se a regra não tem recorrência.
 */
export function nextOccurrenceAfter(
  rule: RecurrenceRule | null,
  fromIso: string,
  baseStartsAt: string,
): Date | null {
  if (!rule) return null;
  const from = new Date(fromIso);
  const base = new Date(baseStartsAt);

  if (rule.startsWith('every:')) {
    const num = parseInt(rule.split(':')[1], 10);
    if (rule.endsWith('d') && Number.isFinite(num) && num > 0) {
      // Encontra próximo múltiplo de N dias após `from`
      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.ceil((from.getTime() - base.getTime()) / msPerDay);
      const cycles = Math.max(0, Math.ceil(diffDays / num));
      return new Date(base.getTime() + cycles * num * msPerDay);
    }
  }

  if (rule.startsWith('weekly:')) {
    const days = rule.split(':')[1].split(',');
    const DAY_IDX: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const target = new Date(from);
    target.setHours(base.getHours(), base.getMinutes(), 0, 0);
    for (let i = 0; i < 14; i++) {
      const candidate = new Date(target);
      candidate.setDate(target.getDate() + i);
      if (days.some((d) => DAY_IDX[d] === candidate.getDay()) && candidate >= from) {
        return candidate;
      }
    }
    return null;
  }

  if (rule === 'monthly') {
    const target = new Date(from);
    target.setDate(base.getDate());
    target.setHours(base.getHours(), base.getMinutes(), 0, 0);
    if (target < from) target.setMonth(target.getMonth() + 1);
    return target;
  }

  return null;
}

/**
 * Expande um PetEvent recorrente em N ocorrências dentro do range [from, to].
 * Retorna array de Dates (limitado a 60 ocorrências pra segurança).
 */
export function expandOccurrences(
  rule: RecurrenceRule | null,
  baseStartsAt: string,
  rangeStartIso: string,
  rangeEndIso: string,
  limit: number = 60,
): Date[] {
  const occurrences: Date[] = [];
  const base = new Date(baseStartsAt);
  const rangeEnd = new Date(rangeEndIso);

  if (!rule) {
    if (
      base >= new Date(rangeStartIso) &&
      base <= rangeEnd
    ) {
      occurrences.push(new Date(base));
    }
    return occurrences;
  }

  if (rule.startsWith('every:')) {
    const num = parseInt(rule.split(':')[1], 10);
    if (!rule.endsWith('d') || !Number.isFinite(num) || num <= 0) return occurrences;
    const msPerDay = 24 * 60 * 60 * 1000;
    let cursor = new Date(base);
    while (cursor < new Date(rangeStartIso)) {
      cursor = new Date(cursor.getTime() + num * msPerDay);
    }
    let i = 0;
    while (cursor <= rangeEnd && i < limit) {
      occurrences.push(new Date(cursor));
      cursor = new Date(cursor.getTime() + num * msPerDay);
      i++;
    }
    return occurrences;
  }

  if (rule.startsWith('weekly:')) {
    const days = rule.split(':')[1].split(',');
    const DAY_IDX: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    const dayNums = days.map((d) => DAY_IDX[d]).filter((n) => n !== undefined);
    const cursor = new Date(rangeStartIso);
    cursor.setHours(base.getHours(), base.getMinutes(), 0, 0);
    let i = 0;
    while (cursor <= rangeEnd && i < limit) {
      if (dayNums.includes(cursor.getDay()) && cursor >= base) {
        occurrences.push(new Date(cursor));
        i++;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return occurrences;
  }

  if (rule === 'monthly') {
    const cursor = new Date(base);
    while (cursor < new Date(rangeStartIso)) cursor.setMonth(cursor.getMonth() + 1);
    let i = 0;
    while (cursor <= rangeEnd && i < limit) {
      occurrences.push(new Date(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
      i++;
    }
    return occurrences;
  }

  return occurrences;
}
