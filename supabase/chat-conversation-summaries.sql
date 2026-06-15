-- ============================================================================
-- CHAT — RPCs de resumo (Onda 2b: mata o N+1 da lista de conversas)
--
-- Antes fetchConversations fazia ~2N+2 round-trips (1 conversas + 1 profiles +
-- 2 por conversa: ultima msg + count nao-lidas). Aqui: UMA query agregada.
-- Ambas SECURITY DEFINER escopadas em auth.uid() (so dados do proprio usuario;
-- sem IDOR). Idempotente, ASCII-only.
-- ============================================================================

-- Resumo de TODAS as conversas do usuario: ultima msg + contagem de nao-lidas +
-- perfil do outro participante, em 1 query.
create or replace function public.get_conversation_summaries()
returns table (
  id uuid,
  last_message_at timestamptz,
  unread_count int,
  last_message jsonb,
  other_user jsonb
)
language sql security definer stable set search_path = public as $$
  with my_convs as (
    select cp.conversation_id, cp.last_read_at
    from public.conversation_participants cp
    where cp.user_id = auth.uid()
  ),
  last_msg as (
    select distinct on (m.conversation_id)
      m.conversation_id, m.id, m.sender_id, m.content, m.created_at
    from public.messages m
    join my_convs mc on mc.conversation_id = m.conversation_id
    order by m.conversation_id, m.created_at desc
  ),
  unread as (
    select m.conversation_id, count(*)::int as n
    from public.messages m
    join my_convs mc on mc.conversation_id = m.conversation_id
    where m.sender_id <> auth.uid() and m.created_at > mc.last_read_at
    group by m.conversation_id
  )
  select
    c.id,
    c.last_message_at,
    coalesce(u.n, 0) as unread_count,
    case when lm.id is not null then jsonb_build_object(
      'id', lm.id,
      'conversation_id', lm.conversation_id,
      'sender_id', lm.sender_id,
      'content', lm.content,
      'created_at', lm.created_at
    ) end as last_message,
    to_jsonb(p.*) as other_user
  from public.conversations c
  join my_convs mc on mc.conversation_id = c.id
  join public.conversation_participants op
    on op.conversation_id = c.id and op.user_id <> auth.uid()
  join public.profiles p on p.id = op.user_id
  left join last_msg lm on lm.conversation_id = c.id
  left join unread u on u.conversation_id = c.id
  order by c.last_message_at desc;
$$;
revoke all on function public.get_conversation_summaries() from public, anon;
grant execute on function public.get_conversation_summaries() to authenticated;

-- Total de mensagens nao-lidas do usuario (badge no feed/springboard), 1 query.
create or replace function public.unread_message_total()
returns int language sql security definer stable set search_path = public as $$
  select coalesce(count(*), 0)::int
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id and cp.user_id = auth.uid()
  where m.sender_id <> auth.uid() and m.created_at > cp.last_read_at;
$$;
revoke all on function public.unread_message_total() from public, anon;
grant execute on function public.unread_message_total() to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba NOVA):
--   select count(*) from pg_proc where proname in ('get_conversation_summaries','unread_message_total'); -- 2
--   select has_function_privilege('authenticated','public.get_conversation_summaries()','execute'),
--          has_function_privilege('authenticated','public.unread_message_total()','execute');            -- t,t
-- ============================================================================
