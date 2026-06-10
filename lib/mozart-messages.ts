import { supabase } from '@/lib/supabase';

/**
 * Mensagens programadas do Mozart (mascote oficial). São as DMs de boas-vindas
 * enviadas automaticamente pra cada novo tutor, na ordem `sort_order`.
 * Escrita gated por RLS (is_admin); leitura pública.
 */

export interface MozartMessage {
  id: string;
  content: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface MozartMessageInput {
  content: string;
  sort_order: number;
  active: boolean;
}

export async function fetchMozartMessages(): Promise<MozartMessage[]> {
  const { data, error } = await supabase
    .from('mozart_messages')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as MozartMessage[];
}

export async function createMozartMessage(input: MozartMessageInput): Promise<void> {
  const { error } = await supabase.from('mozart_messages').insert({
    content: input.content.trim(),
    sort_order: input.sort_order,
    active: input.active,
  });
  if (error) throw error;
}

export async function updateMozartMessage(
  id: string,
  patch: Partial<MozartMessageInput>,
): Promise<void> {
  const next: Record<string, unknown> = { ...patch };
  if (typeof next.content === 'string') next.content = (next.content as string).trim();
  const { error } = await supabase.from('mozart_messages').update(next).eq('id', id);
  if (error) throw error;
}

export async function deleteMozartMessage(id: string): Promise<void> {
  const { error } = await supabase.from('mozart_messages').delete().eq('id', id);
  if (error) throw error;
}

export const qkMozartMessages = ['admin', 'mozart-messages'] as const;
