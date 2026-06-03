/**
 * Sistema unificado de alertas de saúde.
 *
 * Pura função `computeHealthAlerts(ctx)` que recebe TODO o estado de saúde
 * do pet e retorna alertas tipados, ordenados por urgência.
 *
 * Usado em:
 *   - health.tsx hub (Alerts section)
 *   - health-alerts.tsx (central dedicada)
 *   - eventualmente push notifications (worker server-side)
 *
 * IMPORTANTE: nenhum alerta diagnostica. Todos sugerem AÇÃO (registrar,
 * agendar consulta, atualizar) — nunca dizem o que o pet TEM.
 */

import { parseISO } from 'date-fns';

import type {
  HealthSummary,
  Medication,
  ParasiteTreatment,
  Pet,
  PetSymptom,
  Vaccination,
  VetVisit,
  WeightRecord,
} from './types';

export type AlertSeverity = 'urgent' | 'warning' | 'info';

export type AlertCategory =
  | 'vaccine'
  | 'parasite'
  | 'medication'
  | 'symptom'
  | 'vet_visit'
  | 'weight'
  | 'age';

export interface HealthAlert {
  /** Key estável pra React + dedup. */
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  emoji: string;
  title: string;
  description: string;
  /** Quando relevante, navega pra ação específica. */
  action?: { label: string; href: string };
  /** Pra ordenação secundária — dias até deadline (negativo = atrasado). */
  daysUntil?: number;
}

export interface HealthAlertsContext {
  pet: Pet;
  summary?: HealthSummary;
  vaccinations?: Vaccination[];
  parasites?: ParasiteTreatment[];
  medications?: Medication[];
  symptoms?: PetSymptom[];
  vetVisits?: VetVisit[];
  weights?: WeightRecord[];
}

const DAY_MS = 86400000;
const now = () => Date.now();

// ============================================================================
// API pública
// ============================================================================

export function computeHealthAlerts(ctx: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  alerts.push(...vaccineAlerts(ctx));
  alerts.push(...parasiteAlerts(ctx));
  alerts.push(...medicationAlerts(ctx));
  alerts.push(...symptomAlerts(ctx));
  alerts.push(...vetVisitAlerts(ctx));
  alerts.push(...weightAlerts(ctx));
  alerts.push(...ageAlerts(ctx));

  // Ordena: urgent → warning → info; depois daysUntil ascendente (mais atrasado primeiro)
  const sevOrder: Record<AlertSeverity, number> = { urgent: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return (a.daysUntil ?? Infinity) - (b.daysUntil ?? Infinity);
  });

  return alerts;
}

/** Contagem rápida por severity pra badges. */
export function countAlertsBySeverity(alerts: HealthAlert[]): Record<AlertSeverity, number> {
  return alerts.reduce(
    (acc, a) => {
      acc[a.severity]++;
      return acc;
    },
    { urgent: 0, warning: 0, info: 0 } as Record<AlertSeverity, number>,
  );
}

// ============================================================================
// VACINAS
// ============================================================================

function vaccineAlerts({ pet, summary }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!summary?.next_vaccine) return alerts;

  const { name, due_at, days_until } = summary.next_vaccine;
  const href = `/pet/${pet.id}/vaccinations`;

  if (days_until <= 0) {
    alerts.push({
      id: `vaccine-overdue-${name}`,
      severity: 'urgent',
      category: 'vaccine',
      emoji: '⚠️',
      title: `Vacina ${name} vencida`,
      description: `Estava marcada pra ${fmtDate(due_at)}. Considere agendar com seu vet.`,
      action: { label: 'Ver vacinas', href },
      daysUntil: days_until,
    });
  } else if (days_until <= 14) {
    alerts.push({
      id: `vaccine-due-${name}`,
      severity: 'warning',
      category: 'vaccine',
      emoji: '🔔',
      title: `${name} em ${days_until} dia${days_until === 1 ? '' : 's'}`,
      description: `Próxima dose: ${fmtDate(due_at)}`,
      action: { label: 'Ver vacinas', href },
      daysUntil: days_until,
    });
  } else if (days_until <= 30) {
    alerts.push({
      id: `vaccine-upcoming-${name}`,
      severity: 'info',
      category: 'vaccine',
      emoji: '📅',
      title: `${name} em ~${Math.round(days_until / 7)} semanas`,
      description: `Planeje a consulta com antecedência.`,
      action: { label: 'Ver vacinas', href },
      daysUntil: days_until,
    });
  }

  return alerts;
}

// ============================================================================
// PARASITAS (vermífugo / antipulgas)
// ============================================================================

function parasiteAlerts({ pet, parasites }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!parasites || parasites.length === 0) return alerts;

  const href = `/pet/${pet.id}/parasites`;
  const today = now();

  // Próximo tratamento mais urgente
  const upcoming = parasites
    .filter((p) => p.next_due_at)
    .map((p) => ({
      treatment: p,
      daysUntil: Math.ceil((parseISO(p.next_due_at!).getTime() - today) / DAY_MS),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];

  if (!upcoming) return alerts;

  const { treatment, daysUntil } = upcoming;

  if (daysUntil < 0) {
    alerts.push({
      id: `parasite-overdue-${treatment.id}`,
      severity: 'urgent',
      category: 'parasite',
      emoji: '🦟',
      title: `${treatment.product_name} atrasado ${Math.abs(daysUntil)}d`,
      description: `Reaplicação estava marcada para ${fmtDate(treatment.next_due_at)}`,
      action: { label: 'Aplicar agora', href },
      daysUntil,
    });
  } else if (daysUntil === 0) {
    alerts.push({
      id: `parasite-today-${treatment.id}`,
      severity: 'warning',
      category: 'parasite',
      emoji: '💊',
      title: `${treatment.product_name} vence hoje`,
      description: 'Reaplicação programada pra hoje.',
      action: { label: 'Marcar aplicado', href },
      daysUntil,
    });
  } else if (daysUntil <= 7) {
    alerts.push({
      id: `parasite-soon-${treatment.id}`,
      severity: 'warning',
      category: 'parasite',
      emoji: '💊',
      title: `${treatment.product_name} em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`,
      description: `Próxima reaplicação: ${fmtDate(treatment.next_due_at)}`,
      action: { label: 'Ver parasitas', href },
      daysUntil,
    });
  }

  return alerts;
}

// ============================================================================
// MEDICAÇÃO
// ============================================================================

function medicationAlerts({ pet, summary }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const due = summary?.due_medications_today ?? 0;
  if (due === 0) return alerts;

  alerts.push({
    id: 'meds-today',
    severity: 'warning',
    category: 'medication',
    emoji: '🧪',
    title: `${due} dose${due === 1 ? '' : 's'} pendente${due === 1 ? '' : 's'} hoje`,
    description: 'Toque pra registrar a administração.',
    action: { label: 'Ver remédios', href: `/pet/${pet.id}/medications` },
    daysUntil: 0,
  });
  return alerts;
}

// ============================================================================
// SINTOMAS
// ============================================================================

function symptomAlerts({ pet, symptoms }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!symptoms || symptoms.length === 0) return alerts;

  const href = `/pet/${pet.id}/symptoms`;
  const active = symptoms.filter((s) => !s.resolved_at);

  // 1. Sintomas graves ativos (severity ≥ 4)
  const severe = active.filter((s) => s.severity >= 4);
  if (severe.length > 0) {
    alerts.push({
      id: 'symptom-severe',
      severity: 'urgent',
      category: 'symptom',
      emoji: '🚨',
      title: `${severe.length} sintoma${severe.length > 1 ? 's' : ''} grave${severe.length > 1 ? 's' : ''} ativo${severe.length > 1 ? 's' : ''}`,
      description: 'Considere consulta veterinária.',
      action: { label: 'Ver sintomas', href },
      daysUntil: 0,
    });
  }

  // 2. Sintomas marcados pro vet (não severos)
  const flagged = active.filter((s) => s.flagged_for_vet && s.severity < 4);
  if (flagged.length > 0) {
    alerts.push({
      id: 'symptom-flagged',
      severity: 'warning',
      category: 'symptom',
      emoji: '🩺',
      title: `${flagged.length} sintoma${flagged.length > 1 ? 's' : ''} marcado${flagged.length > 1 ? 's' : ''} pro vet`,
      description: 'Leve no próximo check-up.',
      action: { label: 'Ver sintomas', href },
      daysUntil: 7,
    });
  }

  // 3. Sintoma ativo há mais de 7 dias sem ser resolvido → sugere atualizar/agendar vet
  const today = now();
  const stale = active.filter((s) => {
    const ageDays = (today - parseISO(s.recorded_at).getTime()) / DAY_MS;
    return ageDays > 7 && s.severity < 4 && !s.flagged_for_vet;
  });
  if (stale.length > 0) {
    alerts.push({
      id: 'symptom-stale',
      severity: 'info',
      category: 'symptom',
      emoji: '⏳',
      title: `${stale.length} sintoma${stale.length > 1 ? 's' : ''} ativo${stale.length > 1 ? 's' : ''} há +7 dias`,
      description: 'Atualize ou marque como resolvido se já melhorou.',
      action: { label: 'Ver sintomas', href },
      daysUntil: 14,
    });
  }

  return alerts;
}

// ============================================================================
// VET VISITS
// ============================================================================

function vetVisitAlerts({ pet, summary }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const href = `/pet/${pet.id}/vet-visits`;
  const today = now();

  // 1. Próxima visita já agendada e vencendo
  if (summary?.next_vet_visit?.next_visit_at) {
    const nextDate = parseISO(summary.next_vet_visit.next_visit_at).getTime();
    const daysUntil = Math.ceil((nextDate - today) / DAY_MS);

    if (daysUntil < 0) {
      alerts.push({
        id: 'vet-visit-overdue',
        severity: 'warning',
        category: 'vet_visit',
        emoji: '🩺',
        title: `Consulta atrasada ${Math.abs(daysUntil)}d`,
        description: summary.next_vet_visit.clinic_name ?? 'Reagendar com seu vet.',
        action: { label: 'Ver consultas', href },
        daysUntil,
      });
    } else if (daysUntil <= 7) {
      alerts.push({
        id: 'vet-visit-soon',
        severity: 'info',
        category: 'vet_visit',
        emoji: '📅',
        title: `Consulta em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`,
        description: summary.next_vet_visit.clinic_name ?? 'Não esqueça do agendamento.',
        action: { label: 'Ver consultas', href },
        daysUntil,
      });
    }
  }

  // 2. Faz muito tempo sem consulta — check-up sugerido
  // Cão/gato adulto: anual. Sênior: semestral.
  if (summary?.last_vet_visit) {
    const lastDate = parseISO(summary.last_vet_visit.visited_at).getTime();
    const daysSince = Math.floor((today - lastDate) / DAY_MS);
    const ageMonths = pet.birthdate
      ? (today - parseISO(pet.birthdate).getTime()) / (DAY_MS * 30)
      : null;
    const isSenior = ageMonths !== null && ageMonths > 84; // 7+ anos
    const threshold = isSenior ? 180 : 365;

    // Só dispara se não houver próxima visita agendada
    if (daysSince > threshold && !summary.next_vet_visit?.next_visit_at) {
      const months = Math.floor(daysSince / 30);
      alerts.push({
        id: 'vet-visit-overdue-checkup',
        severity: 'info',
        category: 'vet_visit',
        emoji: '🩺',
        title: `Faz ${months} ${months === 1 ? 'mês' : 'meses'} sem consulta`,
        description: isSenior
          ? 'Pets seniores precisam check-up semestral. Considere agendar.'
          : 'Check-up anual ajuda a detectar problemas cedo.',
        action: { label: 'Registrar consulta', href },
        daysUntil: 30,
      });
    }
  } else if (pet.birthdate) {
    // Nunca foi ao vet — sugere primeiro check-up
    const ageDays = (today - parseISO(pet.birthdate).getTime()) / DAY_MS;
    if (ageDays > 60) {
      alerts.push({
        id: 'vet-visit-never',
        severity: 'info',
        category: 'vet_visit',
        emoji: '🩺',
        title: 'Nunca registrou consulta',
        description: 'Pets devem fazer pelo menos uma consulta anual.',
        action: { label: 'Adicionar primeira', href },
        daysUntil: 30,
      });
    }
  }

  return alerts;
}

// ============================================================================
// PESO
// ============================================================================

function weightAlerts({ pet, weights }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!weights || weights.length === 0) return alerts;

  const href = `/pet/${pet.id}/weight`;
  const today = now();
  const sorted = [...weights].sort(
    (a, b) => parseISO(b.weighed_at).getTime() - parseISO(a.weighed_at).getTime(),
  );
  const latest = sorted[0];

  // 1. Faz tempo sem pesar (90+ dias)
  const daysSince = Math.floor((today - parseISO(latest.weighed_at).getTime()) / DAY_MS);
  if (daysSince > 90) {
    alerts.push({
      id: 'weight-stale',
      severity: 'info',
      category: 'weight',
      emoji: '⚖️',
      title: `Sem pesagem há ${Math.floor(daysSince / 30)} ${Math.floor(daysSince / 30) === 1 ? 'mês' : 'meses'}`,
      description: 'Pese mensalmente pra monitorar a saúde do seu pet.',
      action: { label: 'Registrar peso', href },
      daysUntil: 7,
    });
    return alerts;
  }

  // 2. Variação brusca de peso vs pesagem anterior (>15% em < 60 dias)
  if (sorted.length >= 2) {
    const previous = sorted[1];
    const daysBetween = Math.abs(
      (parseISO(latest.weighed_at).getTime() - parseISO(previous.weighed_at).getTime()) / DAY_MS,
    );
    if (daysBetween < 60 && previous.weight_kg > 0) {
      const variation = ((latest.weight_kg - previous.weight_kg) / previous.weight_kg) * 100;
      if (Math.abs(variation) >= 15) {
        const lostOrGained = variation > 0 ? 'ganhou' : 'perdeu';
        alerts.push({
          id: 'weight-jump',
          severity: 'warning',
          category: 'weight',
          emoji: '⚖️',
          title: `${pet.name} ${lostOrGained} ${Math.abs(variation).toFixed(0)}% de peso`,
          description: `De ${previous.weight_kg}kg pra ${latest.weight_kg}kg em ${Math.round(daysBetween)} dias. Vale falar com o vet.`,
          action: { label: 'Ver histórico', href },
          daysUntil: 7,
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// IDADE / CICLO DE VIDA
// ============================================================================

function ageAlerts({ pet }: HealthAlertsContext): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  if (!pet.birthdate) return alerts;

  const ageMonths = (now() - parseISO(pet.birthdate).getTime()) / (DAY_MS * 30);
  const href = `/pet/${pet.id}/health`;

  // Marco etário relevante: 7 anos = idoso (cão/gato)
  if ((pet.species === 'dog' || pet.species === 'cat') && ageMonths >= 84 && ageMonths < 86) {
    alerts.push({
      id: 'age-senior-entry',
      severity: 'info',
      category: 'age',
      emoji: '🎂',
      title: `${pet.name} entrou na fase sênior`,
      description:
        'Pets seniores precisam check-ups semestrais e atenção extra a articulações, rins e visão.',
      action: { label: 'Saiba mais', href },
      daysUntil: 60,
    });
  }

  // Filhote → ainda em fase de imunização
  if ((pet.species === 'dog' || pet.species === 'cat') && ageMonths < 4) {
    alerts.push({
      id: 'age-puppy',
      severity: 'info',
      category: 'age',
      emoji: '🍼',
      title: `${pet.name} é filhote (${Math.floor(ageMonths * 4)} semanas)`,
      description: 'Importante manter série inicial de vacinas em dia.',
      action: { label: 'Ver vacinas', href: `/pet/${pet.id}/vaccinations` },
      daysUntil: 30,
    });
  }

  return alerts;
}

// ============================================================================
// Helpers
// ============================================================================

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
