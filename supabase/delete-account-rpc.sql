-- ============================================================================
-- DELETE ACCOUNT (LGPD) — self-service exclusão de conta
-- ============================================================================
-- Apaga todos os dados pessoais do user atual. O registro em auth.users
-- permanece (requer service_role pra deletar) — admin processa periodicamente.
--
-- O usuário pode chamar essa função e o profile dele + cascades pegam o resto.
-- Pets/posts são deletados explicitamente (owner_id de auth.users, sem cascade direto).
-- ============================================================================

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

  -- Counts pra retornar transparência (LGPD: usuário tem direito de saber o que foi apagado)
  select count(*) into pets_count from public.pets where owner_id = uid;
  select count(*) into posts_count from public.posts p
    join public.pets pe on pe.id = p.pet_id
    where pe.owner_id = uid;
  select count(*) into reports_count from public.lost_reports where reporter_user_id = uid;
  select count(*) into reviews_count from public.place_reviews where user_id = uid;

  -- Apaga tudo que tem owner_id = uid (RLS bypass via security definer)
  -- Ordem importa: filhos primeiro pra evitar conflito de FK quando não houver cascade.

  -- Posts (cascadeiam post_media, likes, comments, hashtag links via FKs)
  delete from public.posts
    where pet_id in (select id from public.pets where owner_id = uid);

  -- Conteúdo social próprio do user
  delete from public.lost_reports where reporter_user_id = uid;
  delete from public.place_reviews where user_id = uid;
  delete from public.memorial_messages where author_user_id = uid;

  -- Mensagens em conversas (mantém a conversa pro outro lado se houver)
  delete from public.messages where sender_id = uid;
  delete from public.conversation_participants where user_id = uid;

  -- Reports / blocks feitos pelo user
  delete from public.reports where reporter_user_id = uid;
  delete from public.blocked_users where blocker_id = uid or blocked_id = uid;

  -- AI conversations (cascade via user_id)
  delete from public.ai_conversations where user_id = uid;

  -- Subscription do user
  delete from public.subscriptions where user_id = uid;

  -- Notifications recebidas
  delete from public.notifications where user_id = uid;

  -- Saved posts
  delete from public.saved_posts where user_id = uid;

  -- Caretakers convites (se a tabela existe)
  begin
    delete from public.pet_caretakers where invited_by = uid or user_id = uid;
  exception when undefined_table then
    null;
  end;

  -- Pets (por último, cascadeiam vaccinations, medications, vet_visits,
  -- weight_records, parasite_treatments, pet_events via ON DELETE CASCADE)
  delete from public.pets where owner_id = uid;

  -- Profile (último — assim qualquer query que ainda referencie já tá limpa)
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

-- ============================================================================
-- EXPORT DATA (LGPD) — retorna JSON com todos os dados do user
-- ============================================================================
-- Direito de portabilidade: usuário pode pegar uma cópia dos próprios dados.
-- Retorna JSON consolidado com profile, pets, posts (sem fotos), reviews, etc.

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
    'profile', (
      select row_to_json(p) from public.profiles p where p.id = uid
    ),
    'pets', (
      select json_agg(row_to_json(pe))
      from public.pets pe where pe.owner_id = uid
    ),
    'posts', (
      select json_agg(row_to_json(po))
      from public.posts po
      join public.pets pe on pe.id = po.pet_id
      where pe.owner_id = uid
    ),
    'lost_reports', (
      select json_agg(row_to_json(lr))
      from public.lost_reports lr where lr.reporter_user_id = uid
    ),
    'place_reviews', (
      select json_agg(row_to_json(pr))
      from public.place_reviews pr where pr.user_id = uid
    ),
    'subscription', (
      select row_to_json(s) from public.subscriptions s where s.user_id = uid
    )
  ) into result;

  return result;
end;
$func$;

revoke all on function public.export_my_data from public, anon;
grant execute on function public.export_my_data to authenticated;

notify pgrst, 'reload schema';
