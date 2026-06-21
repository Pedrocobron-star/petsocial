-- ============================================================================
-- Maestro Pet -- Admin: remover DM denunciada (fecha gap de moderacao).
-- reports ja aceita target_kind='message', mas faltava o delete (so o
-- remetente/destinatario apagavam via RLS). Idempotente. ASCII.
-- ============================================================================
create or replace function public.admin_delete_message(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.messages where id = p_message_id;
  update public.reports set status = 'actioned'
    where target_kind = 'message' and target_id = p_message_id and status in ('open', 'reviewed');
  perform public.log_admin_action('delete', 'message', p_message_id::text);
end;
$$;
revoke all on function public.admin_delete_message(uuid) from public, anon;
grant execute on function public.admin_delete_message(uuid) to authenticated;

notify pgrst, 'reload schema';
-- READ-BACK: select count(*) from pg_proc where proname = 'admin_delete_message'; -- 1
