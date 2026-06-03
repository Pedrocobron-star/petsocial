-- Fix: recursão infinita nas policies de chat.
-- Substitui as policies "read" por uma função SECURITY DEFINER que bypassa RLS.

create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

drop policy if exists "conversations read own" on public.conversations;
create policy "conversations read own" on public.conversations for select
  using (public.is_conversation_participant(id));

drop policy if exists "conv_participants read own" on public.conversation_participants;
create policy "conv_participants read own" on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages read own" on public.messages;
create policy "messages read own" on public.messages for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own" on public.messages for insert
  with check (auth.uid() = sender_id and public.is_conversation_participant(conversation_id));
