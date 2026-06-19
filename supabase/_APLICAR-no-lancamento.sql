-- ============================================================================
-- MAESTRO PET — APLICAR ANTES DO LANÇAMENTO (cole tudo no SQL Editor → Run)
--
-- Consolida as mudanças de banco do endurecimento pré-lançamento. É IDEMPOTENTE:
-- pode rodar mais de uma vez sem problema. Cada bloco também existe no arquivo
-- de origem citado (pra histórico). Rodar UMA vez em produção.
-- ============================================================================


-- 1) CONSENTIMENTO + IDADE (profiles-consent.sql) ----------------------------
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists age_confirmed boolean not null default false;


-- 2) IDEMPOTÊNCIA DO PAGAMENTO (cakto-checkout.sql) --------------------------
-- cada order_id do Cakto só pode virar UMA subscription (webhook reenviado não duplica).
create unique index if not exists subscriptions_cakto_order_uidx
  on public.subscriptions(cakto_order_id) where cakto_order_id is not null;


-- 3) POLICIES DE ADMIN SEM E-MAIL HARDCODED (admin-places.sql / place-photos.sql)
drop policy if exists "admin manage places" on public.places;
create policy "admin manage places" on public.places for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "place_photos delete own or admin" on public.place_photos;
create policy "place_photos delete own or admin" on public.place_photos for delete
  using (auth.uid() = user_id or public.is_admin());


-- 4) LGPD — EXCLUIR CONTA SEM ÓRFÃOS (delete-account-rpc.sql) ----------------
create or replace function public.delete_my_account()
returns json
language plpgsql
security definer
set search_path = public
as $func$
declare
  uid uuid;
  pets_count int;
  posts_count int;
  reports_count int;
  reviews_count int;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Não autenticado';
  end if;

  select count(*) into pets_count from public.pets where owner_id = uid;
  select count(*) into posts_count from public.posts p
    join public.pets pe on pe.id = p.pet_id
    where pe.owner_id = uid;
  select count(*) into reports_count from public.lost_reports where reporter_user_id = uid;
  select count(*) into reviews_count from public.place_reviews where user_id = uid;

  delete from public.posts
    where pet_id in (select id from public.pets where owner_id = uid);

  delete from public.lost_reports where reporter_user_id = uid;
  delete from public.place_reviews where user_id = uid;
  delete from public.memorial_messages where author_user_id = uid;

  delete from public.messages where sender_id = uid;
  delete from public.conversation_participants where user_id = uid;

  begin
    delete from public.conversations c
      where not exists (
        select 1 from public.conversation_participants cp where cp.conversation_id = c.id
      );
  exception when others then null;
  end;

  delete from public.reports where reporter_user_id = uid;
  delete from public.blocked_users where blocker_id = uid or blocked_id = uid;
  delete from public.ai_conversations where user_id = uid;
  delete from public.subscriptions where user_id = uid;

  begin
    delete from public.subscription_events where user_id = uid;
  exception when undefined_table then null;
  end;

  begin
    delete from public.push_tokens where user_id = uid;
  exception when undefined_table then null;
  end;

  delete from public.notifications where user_id = uid;
  delete from public.saved_posts where user_id = uid;

  begin
    delete from public.pet_caretakers where invited_by = uid or user_id = uid;
  exception when undefined_table then null;
  end;

  delete from public.pets where owner_id = uid;
  delete from public.profiles where id = uid;

  return json_build_object(
    'success', true,
    'pets_deleted', pets_count,
    'posts_deleted', posts_count,
    'lost_reports_deleted', reports_count,
    'place_reviews_deleted', reviews_count,
    'note', 'Conta de auth permanece até processamento admin (geralmente 30 dias)'
  );
end;
$func$;
revoke all on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;


-- 5) LGPD — EXPORTAR DADOS COMPLETO (delete-account-rpc.sql) -----------------
create or replace function public.export_my_data()
returns json
language plpgsql
security definer
set search_path = public
as $func$
declare
  uid uuid;
  result json;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Não autenticado';
  end if;

  select json_build_object(
    'export_date', now(),
    'user_id', uid,
    'profile', (select row_to_json(p) from public.profiles p where p.id = uid),
    'pets', (select coalesce(json_agg(row_to_json(pe)), '[]'::json) from public.pets pe where pe.owner_id = uid),
    'posts', (select coalesce(json_agg(row_to_json(po)), '[]'::json) from public.posts po join public.pets pe on pe.id = po.pet_id where pe.owner_id = uid),
    'lost_reports', (select coalesce(json_agg(row_to_json(lr)), '[]'::json) from public.lost_reports lr where lr.reporter_user_id = uid),
    'place_reviews', (select coalesce(json_agg(row_to_json(pr)), '[]'::json) from public.place_reviews pr where pr.user_id = uid),
    'messages_sent', (select coalesce(json_agg(row_to_json(m)), '[]'::json) from public.messages m where m.sender_id = uid),
    'saved_posts', (select coalesce(json_agg(row_to_json(sp)), '[]'::json) from public.saved_posts sp where sp.user_id = uid),
    'blocked_users', (select coalesce(json_agg(row_to_json(bu)), '[]'::json) from public.blocked_users bu where bu.blocker_id = uid),
    'reports_made', (select coalesce(json_agg(row_to_json(r)), '[]'::json) from public.reports r where r.reporter_user_id = uid),
    'notifications', (select coalesce(json_agg(row_to_json(n)), '[]'::json) from public.notifications n where n.user_id = uid),
    'ai_conversations', (select coalesce(json_agg(row_to_json(ac)), '[]'::json) from public.ai_conversations ac where ac.user_id = uid),
    'subscription', (select row_to_json(s) from public.subscriptions s where s.user_id = uid)
  ) into result;

  return result;
end;
$func$;
revoke all on function public.export_my_data from public, anon;
grant execute on function public.export_my_data to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- FIM. Deve retornar "Success. No rows returned". Pronto.
-- ============================================================================
