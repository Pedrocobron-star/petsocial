import { supabase } from './supabase';
import type { Place, PlaceKind, PlaceSpecies } from './types';

/**
 * Helpers de ADMIN pra gerenciar lugares (curadoria do guia pet-friendly).
 * Insert funciona com a policy normal (qualquer autenticado). Update/Delete de
 * QUALQUER lugar precisa da policy "admin manage places" (supabase/admin-places.sql).
 */
export interface PlaceAdminInput {
  name: string;
  kind: PlaceKind;
  species: PlaceSpecies;
  address: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  description: string | null;
  verified: boolean;
}

export async function adminListPlaces(search?: string): Promise<Place[]> {
  let q = supabase.from('places').select('*').order('created_at', { ascending: false }).limit(300);
  if (search && search.trim().length >= 2) q = q.ilike('name', `%${search.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Place[];
}

export async function adminFetchPlace(id: string): Promise<Place> {
  const { data, error } = await supabase.from('places').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Lugar não encontrado');
  return data as Place;
}

export async function adminCreatePlace(input: PlaceAdminInput, userId: string): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .insert({ ...input, added_by_user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Place;
}

export async function adminUpdatePlace(id: string, input: PlaceAdminInput): Promise<void> {
  const { error } = await supabase.from('places').update(input).eq('id', id);
  if (error) throw error;
}

export async function adminDeletePlace(id: string): Promise<void> {
  const { error } = await supabase.from('places').delete().eq('id', id);
  if (error) throw error;
}
