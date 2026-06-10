import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { EVENT_KIND_META, expandOccurrences } from '@/lib/event-templates';
import type {
  AgendaItem,
  ParasiteTreatment,
  PetEvent,
  PetEventLog,
  Vaccination,
  VetVisit,
} from '@/lib/types';

export interface AgendaRaw {
  events: PetEvent[];
  logs: PetEventLog[];
  vaccinations: Vaccination[];
  parasites: ParasiteTreatment[];
  vetVisits: VetVisit[];
}

/**
 * Funde todas as fontes (eventos custom + vacinas/vermífugo/consultas com próxima
 * data) num único `AgendaItem[]` ordenado por data. Reusado pela agenda do pet e
 * pela "Minha agenda" da home.
 */
export function mergeIntoAgenda(
  raw: AgendaRaw,
  rangeStartIso: string,
  rangeEndIso: string,
): AgendaItem[] {
  const items: AgendaItem[] = [];

  // Index logs por (event_id, occurrence_date)
  const logIndex = new Map<string, PetEventLog>();
  for (const log of raw.logs) {
    logIndex.set(`${log.event_id}:${log.occurrence_date}`, log);
  }

  // pet_events com recorrência expandida
  for (const ev of raw.events) {
    const occurrences = expandOccurrences(ev.recurrence_rule, ev.starts_at, rangeStartIso, rangeEndIso, 30);
    const meta = EVENT_KIND_META[ev.kind];
    for (const occ of occurrences) {
      const occDate = occ.toISOString().slice(0, 10);
      const log = logIndex.get(`${ev.id}:${occDate}`) ?? null;
      items.push({
        key: `event:${ev.id}:${occDate}`,
        source: 'event',
        ref_id: ev.id,
        pet_id: ev.pet_id,
        kind: ev.kind,
        title: ev.title,
        description: ev.description,
        emoji: ev.emoji ?? meta.emoji,
        tint: meta.tint,
        occurs_at: occ.toISOString(),
        all_day: ev.all_day,
        log,
        editable: true,
      });
    }
  }

  // Vacinas com próxima dose
  for (const v of raw.vaccinations) {
    if (!v.next_dose_at) continue;
    const occurs = parseISO(v.next_dose_at);
    if (occurs.toISOString() < rangeStartIso || occurs.toISOString() > rangeEndIso) continue;
    items.push({
      key: `vaccination:${v.id}:${v.next_dose_at}`,
      source: 'vaccination',
      ref_id: v.id,
      pet_id: v.pet_id,
      kind: 'vaccination',
      title: `Vacina: ${v.name}`,
      description: v.notes,
      emoji: '💉',
      tint: { bg: '#FFEDD5', text: '#9A3412' },
      occurs_at: occurs.toISOString(),
      all_day: true,
      log: null,
      editable: false,
    });
  }

  // Antiparasitários com próxima dose
  for (const p of raw.parasites) {
    if (!p.next_due_at) continue;
    const occurs = parseISO(p.next_due_at);
    if (occurs.toISOString() < rangeStartIso || occurs.toISOString() > rangeEndIso) continue;
    items.push({
      key: `parasite:${p.id}:${p.next_due_at}`,
      source: 'parasite',
      ref_id: p.id,
      pet_id: p.pet_id,
      kind: 'parasite',
      title: p.product_name,
      description: `Reaplicação · ${p.kind}`,
      emoji: '💊',
      tint: { bg: '#DCFCE7', text: '#166534' },
      occurs_at: occurs.toISOString(),
      all_day: true,
      log: null,
      editable: false,
    });
  }

  // Consultas vet agendadas
  for (const v of raw.vetVisits) {
    if (!v.next_visit_at) continue;
    const occurs = parseISO(v.next_visit_at);
    if (occurs.toISOString() < rangeStartIso || occurs.toISOString() > rangeEndIso) continue;
    items.push({
      key: `vet:${v.id}:${v.next_visit_at}`,
      source: 'vet_visit',
      ref_id: v.id,
      pet_id: v.pet_id,
      kind: 'vet_visit',
      title: 'Consulta veterinária',
      description: v.clinic_name ?? v.vet_name,
      emoji: '🩺',
      tint: { bg: '#FEE2E2', text: '#991B1B' },
      occurs_at: occurs.toISOString(),
      all_day: false,
      log: null,
      editable: false,
    });
  }

  items.sort((a, b) => a.occurs_at.localeCompare(b.occurs_at));
  return items;
}

/** Agrupa AgendaItem[] por dia com labels amigáveis (HOJE / AMANHÃ / data). */
export function groupByDay(
  items: AgendaItem[],
): { dayKey: string; dayLabel: string; items: AgendaItem[] }[] {
  const groups = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const key = it.occurs_at.slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from(groups.entries())
    .map(([dayKey, dayItems]) => {
      const d = parseISO(dayKey + 'T00:00:00');
      const isToday = d.toDateString() === today.toDateString();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();
      let label: string;
      if (isToday) label = 'HOJE';
      else if (isTomorrow) label = 'AMANHÃ';
      else label = format(d, "EEE, d 'de' MMM", { locale: ptBR }).toUpperCase();
      return { dayKey, dayLabel: label, items: dayItems };
    })
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}
