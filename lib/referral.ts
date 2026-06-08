/**
 * Convide amigos — ambos ganham 7 dias de Pet Pro quando o indicado cria o 1o pet.
 *
 * Fluxo no client:
 *  - /welcome?ref=CODE -> storePendingRef() (localStorage, web).
 *  - antes de criar o 1o pet -> claimReferral(ref) grava referred_by no banco.
 *  - o trigger pets_referral_reward concede +7 dias pra ambos (uma vez).
 */

import { Platform } from 'react-native';

import { shareBaseUrl } from './share';
import { supabase } from './supabase';

const REF_KEY = 'petsocial.ref';

export interface ReferralStats {
  code: string;
  invited: number;
  converted: number;
}

/** Codigo do user (gera on-demand no banco). */
export async function getMyReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_or_create_my_referral_code');
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function getMyReferralStats(): Promise<ReferralStats | null> {
  const { data, error } = await supabase.rpc('my_referral_stats');
  if (error || !data) return null;
  return data as ReferralStats;
}

/** Registra quem indicou o user atual. Idempotente (no-op se ja setado). */
export async function claimReferral(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_referral', { p_code: code });
  if (error) return false;
  return !!(data as { ok?: boolean } | null)?.ok;
}

export function referralLink(code: string): string {
  return `${shareBaseUrl()}/welcome?ref=${encodeURIComponent(code)}`;
}

// ---- localStorage (web) p/ capturar o ?ref antes do signup ----------------
export function storePendingRef(code: string): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(REF_KEY, code.trim().toUpperCase());
  } catch {
    // localStorage indisponivel — ignora
  }
}

export function readPendingRef(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return window.localStorage?.getItem(REF_KEY) ?? null;
  } catch {
    return null;
  }
}

export function clearPendingRef(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(REF_KEY);
  } catch {
    // ignora
  }
}
