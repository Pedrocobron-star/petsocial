import { supabase } from './supabase';

/**
 * Pontos de Tutor (PT) — leitura do ledger imutável (supabase/tutor-points-ledger.sql).
 * O total VITALÍCIO alimenta o Nível de Tutor; o extrato mostra de onde vêm.
 */

export interface TutorPointEntry {
  id: string;
  source: string; // 'mission' | 'health:vaccine|vet|weight|parasite' | 'social:post'
  points: number;
  created_at: string;
}

export const qkMyTutorPoints = ['tutor-points', 'total'] as const;
export const qkMyTutorLedger = ['tutor-points', 'ledger'] as const;

/** Total vitalício de PT do usuário (alimenta o Nível de Tutor). */
export async function fetchMyTutorPoints(): Promise<number> {
  const { data, error } = await supabase.rpc('my_tutor_points');
  if (error) return 0;
  return (data as number | null) ?? 0;
}

/** Extrato: últimas entradas do ledger (RLS já filtra pro próprio usuário). */
export async function fetchMyTutorLedger(limit = 60): Promise<TutorPointEntry[]> {
  const { data, error } = await supabase
    .from('tutor_points')
    .select('id, source, points, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as TutorPointEntry[] | null) ?? [];
}

/** Rótulo amigável + emoji por fonte de PT. */
export function tutorSourceLabel(source: string): { emoji: string; label: string } {
  switch (source) {
    case 'mission':
      return { emoji: '🎯', label: 'Missão do Dia' };
    case 'health:vaccine':
      return { emoji: '💉', label: 'Vacina registrada' };
    case 'health:vet':
      return { emoji: '🏥', label: 'Consulta no vet' };
    case 'health:weight':
      return { emoji: '⚖️', label: 'Peso atualizado' };
    case 'health:parasite':
      return { emoji: '💊', label: 'Vermífugo / antipulga' };
    case 'social:post':
      return { emoji: '📸', label: 'Post no feed' };
    default:
      return { emoji: '⭐', label: 'Pontos' };
  }
}
