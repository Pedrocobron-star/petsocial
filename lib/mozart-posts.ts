import { adminRunDispatchNow } from '@/lib/scheduled-notifications';
import { supabase } from '@/lib/supabase';

/**
 * Posts do Mozart (mascote oficial) no feed. O admin organiza aqui (rascunho /
 * agendado / publicado); o cron `petsocial-dispatch` publica os agendados como
 * posts reais do pet oficial do Mozart. "Publicar agora" roda o dispatch na hora.
 * Escrita gated por RLS (is_admin).
 */

export type MozartPostStatus = 'draft' | 'scheduled' | 'published';

export interface MozartPost {
  id: string;
  caption: string;
  media_url: string | null;
  status: MozartPostStatus;
  scheduled_at: string | null;
  published_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MozartPostInput {
  caption: string;
  media_url?: string | null;
  status: MozartPostStatus;
  scheduled_at?: string | null;
}

export async function fetchMozartPosts(): Promise<MozartPost[]> {
  const { data, error } = await supabase
    .from('mozart_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as MozartPost[];
}

export async function createMozartPost(input: MozartPostInput): Promise<void> {
  const { error } = await supabase.from('mozart_posts').insert({
    caption: input.caption.trim(),
    media_url: input.media_url || null,
    status: input.status,
    scheduled_at: input.scheduled_at ?? null,
  });
  if (error) throw error;
}

export async function updateMozartPost(id: string, patch: Partial<MozartPostInput>): Promise<void> {
  const next: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (typeof next.caption === 'string') next.caption = (next.caption as string).trim();
  const { error } = await supabase.from('mozart_posts').update(next).eq('id', id);
  if (error) throw error;
}

export async function deleteMozartPost(id: string): Promise<void> {
  const { error } = await supabase.from('mozart_posts').delete().eq('id', id);
  if (error) throw error;
}

/** Dispara o cron de publicação na hora (pro "publicar agora" não esperar). */
export async function runMozartPublishNow(): Promise<void> {
  await adminRunDispatchNow();
}

export const qkMozartPosts = ['admin', 'mozart-posts'] as const;
