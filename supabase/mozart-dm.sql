-- ============================================================================
-- mozart-dm.sql — Admin responde avaliações como Mozart (DM) + expõe user_id.
-- Idempotente. Depende de mozart-profile.sql (conta-bot do Mozart) + is_admin().
-- ============================================================================

-- 1. admin_list_app_ratings ganha user_id (pro admin saber pra quem mandar DM).
drop function if exists public.admin_list_app_ratings(int);
create or replace function public.admin_list_app_ratings(p_limit int default 200)
returns table (
  id uuid, rating int, comment text, trigger_reason text, created_at timestamptz,
  user_id uuid, user_email text, user_name text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select r.id, r.rating, r.comment, r.trigger_reason, r.created_at,
         r.user_id, u.email::text, p.display_name
  from public.app_ratings r
  join auth.users u on u.id = r.user_id
  left join public.profiles p on p.id = r.user_id
  order by r.created_at desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_list_app_ratings(int) from public;
grant execute on function public.admin_list_app_ratings(int) to authenticated;

-- 2. admin_mozart_dm: o Mozart manda uma DM pro usuário (cria/reusa a conversa).
create or replace function public.admin_mozart_dm(p_user uuid, p_message text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_mozart uuid := 'd0c0ffee-0000-4000-8000-00000000cafe';
  v_conv uuid;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user is null or p_user = v_mozart then raise exception 'invalid user'; end if;
  if p_message is null or char_length(trim(p_message)) = 0 then raise exception 'message required'; end if;

  select c.id into v_conv
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = p_user
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = v_mozart
  limit 1;

  if v_conv is null then
    insert into public.conversations (last_message_at) values (now()) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
      values (v_conv, p_user, '1970-01-01T00:00:00Z'), (v_conv, v_mozart, now());
  end if;

  insert into public.messages (conversation_id, sender_id, content) values (v_conv, v_mozart, trim(p_message));
end;
$$;
revoke all on function public.admin_mozart_dm(uuid, text) from public;
grant execute on function public.admin_mozart_dm(uuid, text) to authenticated;

select
  (select count(*) from pg_proc where proname = 'admin_mozart_dm') as has_dm_fn,
  (select count(*) from information_schema.routines where routine_name = 'admin_list_app_ratings') as has_list_fn;
