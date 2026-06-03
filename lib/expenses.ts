/**
 * Controle de gastos do pet.
 *
 * Tutor registra ração, vet, banho, remédio, etc. e vê quanto custa por mês/ano.
 * Agregação client-side (por mês + categoria). RLS owner.
 */

import { supabase } from './supabase';

export type ExpenseCategory =
  | 'racao'
  | 'vet'
  | 'banho_tosa'
  | 'medicamento'
  | 'acessorio'
  | 'seguro'
  | 'hospedagem'
  | 'adestramento'
  | 'outro';

export interface PetExpense {
  id: string;
  created_at: string;
  pet_id: string;
  owner_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  spent_on: string; // YYYY-MM-DD
}

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; emoji: string; color: string }[] = [
  { key: 'racao', label: 'Ração & comida', emoji: '🥣', color: '#F97316' },
  { key: 'vet', label: 'Veterinário', emoji: '🩺', color: '#2563EB' },
  { key: 'medicamento', label: 'Remédios', emoji: '💊', color: '#16A34A' },
  { key: 'banho_tosa', label: 'Banho & tosa', emoji: '🛁', color: '#0891B2' },
  { key: 'acessorio', label: 'Acessórios', emoji: '🦴', color: '#9333EA' },
  { key: 'hospedagem', label: 'Hospedagem', emoji: '🏨', color: '#DB2777' },
  { key: 'adestramento', label: 'Adestramento', emoji: '🎾', color: '#CA8A04' },
  { key: 'seguro', label: 'Seguro/plano', emoji: '🛡️', color: '#64748B' },
  { key: 'outro', label: 'Outros', emoji: '🎁', color: '#78716C' },
];

export function expenseCategoryMeta(c: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((x) => x.key === c) ?? EXPENSE_CATEGORIES[8];
}

/** Formata em reais (R$ 1.234,56). */
export function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// CRUD
// ============================================================================

export async function fetchExpenses(petId: string): Promise<PetExpense[]> {
  const { data, error } = await supabase
    .from('pet_expenses')
    .select('*')
    .eq('pet_id', petId)
    .order('spent_on', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return [];
  return ((data ?? []) as PetExpense[]).map((e) => ({ ...e, amount: Number(e.amount) }));
}

export async function createExpense(input: {
  petId: string;
  ownerId: string;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  spentOn?: string | null;
}): Promise<PetExpense> {
  const { data, error } = await supabase
    .from('pet_expenses')
    .insert({
      pet_id: input.petId,
      owner_id: input.ownerId,
      category: input.category,
      amount: input.amount,
      description: input.description || null,
      spent_on: input.spentOn || new Date().toISOString().slice(0, 10),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { ...(data as PetExpense), amount: Number((data as PetExpense).amount) };
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('pet_expenses').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Agregação
// ============================================================================

export type ExpensePeriod = 'month' | '3m' | 'year' | 'all';

export const PERIOD_LABEL: Record<ExpensePeriod, string> = {
  month: 'Este mês',
  '3m': '3 meses',
  year: 'Este ano',
  all: 'Tudo',
};

function periodStart(period: ExpensePeriod, now: Date): Date | null {
  const d = new Date(now);
  if (period === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (period === '3m') return new Date(d.getFullYear(), d.getMonth() - 2, 1);
  if (period === 'year') return new Date(d.getFullYear(), 0, 1);
  return null; // all
}

export interface ExpenseSummary {
  total: number;
  byCategory: { category: ExpenseCategory; total: number }[]; // desc
  count: number;
  /** Média mensal estimada no período (pra "all"/"year" dá uma noção). */
  monthlyAvg: number | null;
}

/** Resume os gastos de um período. `now` injetado pra evitar Date.now em testes. */
export function summarizeExpenses(
  expenses: PetExpense[],
  period: ExpensePeriod,
  now: Date,
): ExpenseSummary {
  const start = periodStart(period, now);
  const filtered = start
    ? expenses.filter((e) => new Date(e.spent_on + 'T00:00:00') >= start)
    : expenses;

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  const byCatMap = new Map<ExpenseCategory, number>();
  for (const e of filtered) byCatMap.set(e.category, (byCatMap.get(e.category) ?? 0) + e.amount);
  const byCategory = Array.from(byCatMap.entries())
    .map(([category, t]) => ({ category, total: t }))
    .sort((a, b) => b.total - a.total);

  // Média mensal: divide pelo nº de meses cobertos
  let monthlyAvg: number | null = null;
  if (filtered.length > 0) {
    const months =
      period === 'month'
        ? 1
        : period === '3m'
          ? 3
          : period === 'year'
            ? now.getMonth() + 1
            : monthsSpan(filtered);
    monthlyAvg = months > 0 ? total / months : total;
  }

  return { total, byCategory, count: filtered.length, monthlyAvg };
}

function monthsSpan(expenses: PetExpense[]): number {
  if (expenses.length === 0) return 1;
  let min = expenses[0].spent_on;
  let max = expenses[0].spent_on;
  for (const e of expenses) {
    if (e.spent_on < min) min = e.spent_on;
    if (e.spent_on > max) max = e.spent_on;
  }
  const [y1, m1] = min.split('-').map(Number);
  const [y2, m2] = max.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}
