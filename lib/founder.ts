import { supabase } from './supabase';

/**
 * Promo "Membros Fundadores": os 100 primeiros a se cadastrar ganham 3 meses
 * de Pet Pro grátis. Backend em supabase/founder-promo.sql.
 */

export interface FounderStatus {
  is_founder: boolean;
  founder_number: number | null;
  /** Número exibido ao usuário (= founder_number + 14, começa em #15). */
  display_number: number | null;
  pro_until?: string | null;
}

export interface FounderPromo {
  limit: number;
  taken: number;
  remaining: number;
  /** Contagem exibida (= taken + 14) pra não parecer vazio no lançamento. */
  display_count: number;
  active: boolean;
}

/** Status do fundador pro usuário logado (tela de parabéns). */
export async function fetchMyFounderStatus(): Promise<FounderStatus> {
  const { data, error } = await supabase.rpc('my_founder_status');
  if (error) throw error;
  return (data ?? { is_founder: false, founder_number: null, display_number: null }) as FounderStatus;
}

/** Status público da promo (landing — funciona deslogado). */
export async function fetchFounderPromo(): Promise<FounderPromo> {
  const { data, error } = await supabase.rpc('founder_promo_status');
  if (error) throw error;
  return data as FounderPromo;
}

export const qkFounder = {
  me: ['founder', 'me'] as const,
  promo: ['founder', 'promo'] as const,
};
