import { adminRunDispatchNow } from '@/lib/scheduled-notifications';
import { supabase } from '@/lib/supabase';

/**
 * Personas — pets fictícios administrados (semeiam o feed). Espelha o sistema
 * de posts do Mozart (lib/mozart-posts.ts), mas pra N personas e SEM tratamento
 * oficial: aparecem como pets comuns. Backend em supabase/personas.sql.
 *
 * REGRA (decisão do dono): conteúdo = rotina pet. NUNCA postar avaliação/elogio
 * do próprio app como se fosse usuário independente, nem impersonar pessoa real.
 */

// UUIDs fixos dos 3 pets-persona (ver supabase/personas.sql).
export const PERSONA_PET_IDS = [
  'c0000001-0000-4000-8000-000000000001',
  'c0000002-0000-4000-8000-000000000002',
  'c0000003-0000-4000-8000-000000000003',
] as const;

export interface PersonaPet {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  bio: string | null;
  birthdate: string | null;
  avatar_url: string | null;
}

export interface PersonaTodayStatus {
  pet_id: string;
  name: string;
  done: boolean;
}

export type PersonaPostStatus = 'draft' | 'scheduled' | 'published';

export interface PersonaPost {
  id: string;
  pet_id: string;
  caption: string;
  media_url: string | null;
  status: PersonaPostStatus;
  scheduled_at: string | null;
  published_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaPostInput {
  pet_id: string;
  caption: string;
  media_url?: string | null;
  status: PersonaPostStatus;
  scheduled_at?: string | null;
}

export async function fetchPersonas(): Promise<PersonaPet[]> {
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, breed, bio, birthdate, avatar_url')
    .in('id', PERSONA_PET_IDS as unknown as string[]);
  if (error) throw error;
  // Mantém a ordem dos UUIDs fixos.
  const rows = (data ?? []) as PersonaPet[];
  return PERSONA_PET_IDS.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as PersonaPet[];
}

export async function fetchPersonaPosts(petId: string): Promise<PersonaPost[]> {
  const { data, error } = await supabase
    .from('persona_posts')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PersonaPost[];
}

export async function createPersonaPost(input: PersonaPostInput): Promise<void> {
  const { error } = await supabase.from('persona_posts').insert({
    pet_id: input.pet_id,
    caption: input.caption.trim(),
    media_url: input.media_url || null,
    status: input.status,
    scheduled_at: input.scheduled_at ?? null,
  });
  if (error) throw error;
}

export async function updatePersonaPost(
  id: string,
  patch: Partial<Omit<PersonaPostInput, 'pet_id'>>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (typeof next.caption === 'string') next.caption = (next.caption as string).trim();
  const { error } = await supabase.from('persona_posts').update(next).eq('id', id);
  if (error) throw error;
}

export async function deletePersonaPost(id: string): Promise<void> {
  const { error } = await supabase.from('persona_posts').delete().eq('id', id);
  if (error) throw error;
}

/** Edita o perfil de uma persona (nome/espécie/raça/bio/nascimento/foto) via RPC admin. */
export async function updatePersonaProfile(input: {
  pet_id: string;
  name: string;
  species: string;
  breed: string | null;
  bio: string | null;
  birthdate: string | null;
  avatar_url: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('admin_update_persona', {
    p_pet_id: input.pet_id,
    p_name: input.name,
    p_species: input.species,
    p_breed: input.breed,
    p_bio: input.bio,
    p_birthdate: input.birthdate,
    p_avatar_url: input.avatar_url,
  });
  if (error) throw error;
}

/** Checklist do Desafio do Dia: cada persona já postou o desafio de hoje? */
export async function fetchPersonasTodayStatus(): Promise<PersonaTodayStatus[]> {
  const { data, error } = await supabase.rpc('personas_today_status');
  if (error) throw error;
  return (data ?? []) as PersonaTodayStatus[];
}

/** Dispara o dispatch na hora (pro "publicar agora" não esperar o cron). */
export async function runPersonaPublishNow(): Promise<void> {
  await adminRunDispatchNow();
}

export const qkPersonas = ['admin', 'personas'] as const;
export const qkPersonasStatus = ['admin', 'personas-status'] as const;
export const qkPersonaPosts = (petId: string) => ['admin', 'persona-posts', petId] as const;
