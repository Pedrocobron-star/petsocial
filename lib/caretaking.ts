/**
 * Co-tutores — lado do CUIDADOR (quem foi convidado).
 *
 * O lado do dono (convidar, papéis, revogar) vive em lib/queries.ts + a tela
 * caretakers. Aqui é a visão de quem ajuda a cuidar: a lista de pets que a
 * pessoa cuida (via RPC caretaker_shared_pets), pra ver saúde + agenda.
 */

import { supabase } from './supabase';

export interface SharedPet {
  pet_id: string;
  name: string;
  species: string;
  breed: string | null;
  avatar_url: string | null;
  role: 'caregiver' | 'viewer';
  owner_name: string | null;
}

export const CARETAKER_ROLE_LABEL: Record<SharedPet['role'], string> = {
  caregiver: 'Cuidador',
  viewer: 'Visualizador',
};

/** Pets que eu ajudo a cuidar (caretaker aceito). */
export async function fetchSharedPets(): Promise<SharedPet[]> {
  const { data, error } = await supabase.rpc('caretaker_shared_pets');
  if (error) return [];
  return (data ?? []) as SharedPet[];
}

export function speciesEmoji(species: string): string {
  return (
    {
      dog: '🐶', cat: '🐱', bird: '🐦', rabbit: '🐰',
      reptile: '🦎', rodent: '🐹', fish: '🐟', other: '🐾',
    }[species] ?? '🐾'
  );
}
