/**
 * Cálculo do Score de Saúde — pontuação 0-100 baseada em 5 dimensões da saúde.
 *
 * Extraído de health-score-card.tsx pra ser reutilizável: o card original
 * usa essa função, e o snapshot mensal (pet_health_snapshots) usa a mesma
 * lógica pra manter consistência.
 *
 * Dimensões com peso (total = 100):
 *  - Vacinas: 30
 *  - Vermífugo/Pulga: 25
 *  - Remédios: 20
 *  - Consultas: 15
 *  - Peso: 10
 *
 * Status por dimensão: ok=100, warn=50, bad=0, na=ignorado.
 * Score final = média ponderada das dimensões com dados (normalizado).
 */

import { differenceInMonths, parseISO } from 'date-fns';

import type { ParasiteSummary } from './queries';
import type { HealthSummary } from './types';

export type ScoreStatus = 'ok' | 'warn' | 'bad' | 'na';

export interface ScoreComponent {
  key: 'vaccines' | 'parasites' | 'medications' | 'vet_visits' | 'weight';
  label: string;
  status: ScoreStatus;
  detail: string;
}

export interface ComputedHealthScore {
  score: number;
  components: ScoreComponent[];
}

const WEIGHTS: Record<ScoreComponent['key'], number> = {
  vaccines: 30,
  parasites: 25,
  medications: 20,
  vet_visits: 15,
  weight: 10,
};

const STATUS_VALUE: Record<ScoreStatus, number> = {
  ok: 100,
  warn: 50,
  bad: 0,
  na: -1,
};

export function computeHealthScore(
  summary: HealthSummary,
  parasiteSummary: ParasiteSummary | undefined,
): ComputedHealthScore {
  const components: ScoreComponent[] = [];

  // Vacinas
  if (summary.next_vaccine) {
    const d = summary.next_vaccine.days_until;
    if (d <= 0) {
      components.push({
        key: 'vaccines',
        label: 'Vacinas',
        status: 'bad',
        detail: `${summary.next_vaccine.name} vencida`,
      });
    } else if (d <= 7) {
      components.push({
        key: 'vaccines',
        label: 'Vacinas',
        status: 'warn',
        detail: `Próxima em ${d}d`,
      });
    } else {
      components.push({ key: 'vaccines', label: 'Vacinas', status: 'ok', detail: 'Em dia' });
    }
  } else if (summary.vaccinations_count > 0) {
    components.push({ key: 'vaccines', label: 'Vacinas', status: 'ok', detail: 'Em dia' });
  } else {
    components.push({ key: 'vaccines', label: 'Vacinas', status: 'na', detail: 'Sem registro' });
  }

  // Parasitas
  if (parasiteSummary && parasiteSummary.total > 0) {
    if (parasiteSummary.overdue > 0) {
      components.push({
        key: 'parasites',
        label: 'Vermífugo/Pulga',
        status: 'bad',
        detail: `${parasiteSummary.overdue} atrasado${parasiteSummary.overdue > 1 ? 's' : ''}`,
      });
    } else if (parasiteSummary.next_due && parasiteSummary.next_due.days_until <= 7) {
      components.push({
        key: 'parasites',
        label: 'Vermífugo/Pulga',
        status: 'warn',
        detail: `Próximo em ${parasiteSummary.next_due.days_until}d`,
      });
    } else {
      components.push({
        key: 'parasites',
        label: 'Vermífugo/Pulga',
        status: 'ok',
        detail: 'Em dia',
      });
    }
  } else {
    components.push({
      key: 'parasites',
      label: 'Vermífugo/Pulga',
      status: 'na',
      detail: 'Sem registro',
    });
  }

  // Remédios
  if (summary.active_medications_count > 0) {
    if (summary.due_medications_today > 0) {
      components.push({
        key: 'medications',
        label: 'Remédios',
        status: 'warn',
        detail: `${summary.due_medications_today} hoje`,
      });
    } else {
      components.push({
        key: 'medications',
        label: 'Remédios',
        status: 'ok',
        detail: `${summary.active_medications_count} ativo${summary.active_medications_count > 1 ? 's' : ''}`,
      });
    }
  } else {
    // Sem remédio ativo = NEUTRO (ignorado no score), não 100% "de graça":
    // assim o score se concentra nas dimensões de prevenção (vacina/vermífugo/
    // consulta) que de fato refletem cuidado. Pet saudável não é penalizado.
    components.push({
      key: 'medications',
      label: 'Remédios',
      status: 'na',
      detail: 'Sem ativos',
    });
  }

  // Consultas
  if (summary.last_vet_visit) {
    const months = differenceInMonths(new Date(), parseISO(summary.last_vet_visit.visited_at));
    if (months >= 12) {
      components.push({
        key: 'vet_visits',
        label: 'Consultas',
        status: 'warn',
        detail: 'Última > 1 ano',
      });
    } else {
      components.push({
        key: 'vet_visits',
        label: 'Consultas',
        status: 'ok',
        detail: `Há ${months}m`,
      });
    }
  } else {
    components.push({
      key: 'vet_visits',
      label: 'Consultas',
      status: 'na',
      detail: 'Sem registro',
    });
  }

  // Peso
  if (summary.latest_weight) {
    components.push({
      key: 'weight',
      label: 'Peso',
      status: 'ok',
      detail: `${summary.latest_weight.weight_kg}kg`,
    });
  } else {
    components.push({ key: 'weight', label: 'Peso', status: 'na', detail: 'Sem registro' });
  }

  // Essenciais sem registro PENALIZAM (contam 0) em vez de serem ignoradas —
  // assim o score reflete cobertura real e cada registro novo o faz subir
  // (vacina, vermífugo, consulta). Não-essenciais 'na' (peso) seguem ignoradas.
  // Pet 100% vazio cai no estado "comece aqui" (a UI nem mostra o %).
  const ESSENTIAL = new Set<ScoreComponent['key']>(['vaccines', 'parasites', 'vet_visits']);
  let totalWeight = 0;
  let weightedSum = 0;
  for (const c of components) {
    const w = WEIGHTS[c.key];
    let v = STATUS_VALUE[c.status];
    if (v < 0) {
      if (!ESSENTIAL.has(c.key)) continue;
      v = 0;
    }
    totalWeight += w;
    weightedSum += w * v;
  }
  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  return { score, components };
}

/** Current month em formato 'YYYY-MM'. */
export function currentMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Decrementa N meses sobre uma chave 'YYYY-MM'. */
export function shiftMonthKey(key: string, deltaMonths: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return currentMonthKey(d);
}

/** Label amigável pra um mês 'YYYY-MM'. */
export function monthLabel(key: string): string {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const [y, m] = key.split('-').map(Number);
  return `${months[m - 1]}/${String(y).slice(2)}`;
}
