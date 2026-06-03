/**
 * Endosso veterinário — co-assinatura da carteirinha/prontuário.
 *
 * Fluxo: tutor gera um pedido (token) → manda o link /endorse/{token} pro vet →
 * vet abre SEM login, vê o pet, e endossa com nome + CRMV → carteirinha mostra
 * o selo "✓ Endossado por Dra. X · CRMV-SP 12345".
 *
 * Framing honesto: é um ENDOSSO (vet se identifica e confirma os dados), não uma
 * assinatura digital ICP-Brasil. Adiciona credibilidade, não validade legal
 * certificada.
 */

import { supabase } from './supabase';

// ============================================================================
// Tipos
// ============================================================================

export type EndorsementScope = 'carteirinha' | 'vacinas' | 'prontuario';
export type EndorsementStatus = 'pending' | 'signed' | 'revoked';

export interface VetEndorsement {
  id: string;
  created_at: string;
  pet_id: string;
  token: string;
  scope: EndorsementScope;
  status: EndorsementStatus;
  vet_name: string | null;
  crmv_number: string | null;
  crmv_state: string | null;
  vet_notes: string | null;
  signed_at: string | null;
}

/** Resultado do endorse_fetch — o que o vet vê na tela pública. */
export interface EndorseFetchResult {
  found: boolean;
  status?: EndorsementStatus;
  scope?: EndorsementScope;
  pet?: {
    name: string;
    species: string;
    breed: string | null;
    birthdate: string | null;
    microchip_number: string | null;
    rga_number: string | null;
    sinpatinhas_id: string | null;
  };
  tutor?: { display_name: string | null };
  vaccines?: {
    name: string;
    applied_at: string;
    next_dose_at: string | null;
    vet_name: string | null;
  }[];
  endorsement?: {
    vet_name: string;
    crmv_number: string;
    crmv_state: string | null;
    signed_at: string;
  } | null;
}

// ============================================================================
// Tutor (autenticado)
// ============================================================================

/** Gera um pedido de endosso e retorna o token público. */
export async function createEndorsementRequest(
  petId: string,
  scope: EndorsementScope = 'carteirinha',
): Promise<string> {
  const { data, error } = await supabase.rpc('create_endorsement_request', {
    p_pet_id: petId,
    p_scope: scope,
  });
  if (error) throw error;
  return data as string;
}

/** Lista os endossos de um pet (pra mostrar o selo na carteirinha). */
export async function fetchPetEndorsements(petId: string): Promise<VetEndorsement[]> {
  const { data, error } = await supabase
    .from('vet_endorsements')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as VetEndorsement[];
}

/** O endosso assinado mais recente de um pet (ou null). */
export async function fetchLatestSignedEndorsement(
  petId: string,
): Promise<VetEndorsement | null> {
  const { data, error } = await supabase
    .from('vet_endorsements')
    .select('*')
    .eq('pet_id', petId)
    .eq('status', 'signed')
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data ?? null) as VetEndorsement | null;
}

/** Revoga um endosso (tutor). */
export async function revokeEndorsement(id: string): Promise<void> {
  const { error } = await supabase
    .from('vet_endorsements')
    .update({ status: 'revoked' })
    .eq('id', id);
  if (error) throw error;
}

// ============================================================================
// Vet (anônimo, via token)
// ============================================================================

/** Busca o resumo do pet pelo token (tela pública do vet). */
export async function fetchEndorsementByToken(token: string): Promise<EndorseFetchResult> {
  const { data, error } = await supabase.rpc('endorse_fetch', { p_token: token });
  if (error) return { found: false };
  return (data ?? { found: false }) as EndorseFetchResult;
}

/** Submete o endosso (vet anônimo). */
export async function submitEndorsement(input: {
  token: string;
  vetName: string;
  crmvNumber: string;
  crmvState?: string;
  vetNotes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('endorse_submit', {
    p_token: input.token,
    p_vet_name: input.vetName,
    p_crmv_number: input.crmvNumber,
    p_crmv_state: input.crmvState ?? null,
    p_vet_notes: input.vetNotes ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as { ok: boolean; error?: string };
}

// ============================================================================
// Helpers de exibição
// ============================================================================

/** Formata o selo: "Dra. Carla · CRMV-SP 12345". */
export function formatEndorsementBadge(e: {
  vet_name: string | null;
  crmv_number: string | null;
  crmv_state: string | null;
}): string {
  const crmv = e.crmv_number
    ? `CRMV${e.crmv_state ? '-' + e.crmv_state : ''} ${e.crmv_number}`
    : '';
  return [e.vet_name, crmv].filter(Boolean).join(' · ');
}

/** Estados brasileiros pra o picker de CRMV. */
export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;
