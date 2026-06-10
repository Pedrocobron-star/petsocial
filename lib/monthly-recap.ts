/**
 * Retrospectiva mensal do pet — "Wrapped" de saúde.
 *
 * Diferente do time-capsule (anual, social), aqui o foco é a atividade de SAÚDE
 * do mês: vacinas, vermífugos, consultas, pesagens, remédios, sintomas e
 * documentos. Agrega client-side reusando fetchHealthTimeline + documentos, sem
 * SQL novo. Card compartilhável que traz a pessoa de volta todo mês.
 */

import type { PetDocument } from './documents';
import type { HealthEventKind, HealthTimelineEvent } from './queries';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export interface RecapStat {
  key: HealthEventKind | 'document';
  label: string;
  emoji: string;
  count: number;
  color: string;
  bg: string;
}

export interface MonthlyRecap {
  year: number;
  month: number; // 0-11
  monthLabel: string; // "Junho de 2026"
  monthShort: string; // "Junho"
  total: number;
  stats: RecapStat[]; // só os que têm count > 0
  events: HealthTimelineEvent[]; // do mês, asc
  documentsCount: number;
  isEmpty: boolean;
}

const KIND_META: Record<
  HealthEventKind | 'document',
  { label: string; singular: string; emoji: string; color: string; bg: string }
> = {
  vaccine: { label: 'Vacinas', singular: 'Vacina', emoji: '💉', color: '#9A3412', bg: '#FFEDD5' },
  parasite: { label: 'Vermífugo & pulga', singular: 'Vermífugo & pulga', emoji: '💊', color: '#166534', bg: '#DCFCE7' },
  vet_visit: { label: 'Consultas', singular: 'Consulta', emoji: '🩺', color: '#1E40AF', bg: '#DBEAFE' },
  weight: { label: 'Pesagens', singular: 'Pesagem', emoji: '⚖️', color: '#9D174D', bg: '#FCE7F3' },
  medication_started: { label: 'Remédios', singular: 'Remédio', emoji: '🧪', color: '#3730A3', bg: '#EEF2FF' },
  symptom: { label: 'Sintomas', singular: 'Sintoma', emoji: '📝', color: '#92400E', bg: '#FEF3C7' },
  document: { label: 'Documentos', singular: 'Documento', emoji: '📂', color: '#5B21B6', bg: '#EDE9FE' },
};

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} de ${year}`;
}
export function monthShort(month: number): string {
  return MONTH_NAMES[month];
}

/** Avança/retrocede um mês, tratando virada de ano. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** True se (year, month) está no futuro em relação a `ref` (default: hoje passado por quem chama). */
export function isAfter(
  a: { year: number; month: number },
  b: { year: number; month: number },
): boolean {
  return a.year * 12 + a.month > b.year * 12 + b.month;
}

function inMonth(iso: string, year: number, month: number): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === year && d.getMonth() === month;
}

export function buildMonthlyRecap(
  events: HealthTimelineEvent[],
  documents: PetDocument[],
  year: number,
  month: number,
): MonthlyRecap {
  const monthEvents = events
    .filter((e) => inMonth(e.date, year, month))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const monthDocs = documents.filter((d) =>
    inMonth(d.doc_date ?? d.created_at, year, month),
  );

  const counts: Record<string, number> = {};
  for (const e of monthEvents) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  if (monthDocs.length) counts.document = monthDocs.length;

  const order: (HealthEventKind | 'document')[] = [
    'vaccine', 'parasite', 'vet_visit', 'medication_started', 'weight', 'symptom', 'document',
  ];
  const stats: RecapStat[] = order
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => ({
      key: k,
      label: counts[k] === 1 ? KIND_META[k].singular : KIND_META[k].label,
      emoji: KIND_META[k].emoji,
      color: KIND_META[k].color,
      bg: KIND_META[k].bg,
      count: counts[k],
    }));

  const total = monthEvents.length + monthDocs.length;

  return {
    year,
    month,
    monthLabel: monthLabel(year, month),
    monthShort: monthShort(month),
    total,
    stats,
    events: monthEvents,
    documentsCount: monthDocs.length,
    isEmpty: total === 0,
  };
}

/** Linha de "vibe" baseada no volume de atividade do mês. */
export function recapVibe(recap: MonthlyRecap, petName: string): string {
  if (recap.isEmpty) return `Mês tranquilo pro ${petName} 🌿`;
  if (recap.total >= 6) return `Mês cheio de cuidado com o ${petName}! 💪`;
  if (recap.stats.some((s) => s.key === 'vaccine')) return `${petName} em dia com a saúde 🎯`;
  return `Acompanhando de pertinho o ${petName} 🐾`;
}

/** Texto de compartilhamento. */
export function recapShareText(recap: MonthlyRecap, petName: string): string {
  const lines = recap.stats.map((s) => `${s.emoji} ${s.count} ${s.label.toLowerCase()}`);
  return [
    `📅 ${recap.monthShort} do ${petName} no Maestro Pet`,
    ...lines,
    '',
    'Cuido da saúde do meu pet no Maestro Pet 🐾',
  ].join('\n');
}
