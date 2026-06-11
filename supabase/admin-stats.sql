-- ============================================================================
-- ADMIN STATS — RPCs do dashboard admin (admin_stats + admin_latest_signups)
--
-- ⚠️ RECONSTRUÍDO A PARTIR DO CONTRATO DO CLIENT (app/(app)/admin.tsx interfaces
-- AdminStats + LatestSignup). As versões que rodam HOJE no banco vivo foram
-- aplicadas À MÃO e NÃO estavam versionadas (o dashboard chamava admin_stats /
-- admin_latest_signups sem nenhum .sql no repo — um reset do schema quebraria o
-- painel inteiro). Este arquivo recria o CONTRATO pra um rebuild do zero funcionar.
--
-- Por NÃO ser byte-a-byte a versão hand-applied, NÃO aplique por cima do banco
-- vivo sem conferir (no rebuild não há "vivo", então aqui é seguro). Gate de
-- segurança = is_admin() (igual às outras RPCs admin).
--
-- DEPENDÊNCIAS (tabelas que TAMBÉM precisam existir num rebuild e hoje são
-- hand-applied/orfas — ver [[project_migration_hygiene]]): app_errors,
-- pet_symptoms, pet_diet_logs. Idempotente.
-- ============================================================================

-- ---------- Stats agregados do painel ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_now timestamptz := now();
  v_active_pro int;
  v_total_users int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;

  select count(*) into v_total_users from auth.users;
  select count(distinct user_id) into v_active_pro
    from public.subscriptions where status in ('active','trialing');

  return jsonb_build_object(
    'users', jsonb_build_object(
      'total', v_total_users,
      'new_7d',  (select count(*) from auth.users where created_at >= v_now - interval '7 days'),
      'new_30d', (select count(*) from auth.users where created_at >= v_now - interval '30 days')
    ),
    'pets', jsonb_build_object(
      'total',  (select count(*) from public.pets),
      'new_7d', (select count(*) from public.pets where created_at >= v_now - interval '7 days'),
      'by_species', (select jsonb_object_agg(species, c) from (
                       select coalesce(species,'?') as species, count(*) as c
                       from public.pets group by 1) s)
    ),
    'posts', jsonb_build_object(
      'total',   (select count(*) from public.posts),
      'new_7d',  (select count(*) from public.posts where created_at >= v_now - interval '7 days'),
      'new_24h', (select count(*) from public.posts where created_at >= v_now - interval '24 hours')
    ),
    'health', jsonb_build_object(
      'vaccinations',        (select count(*) from public.vaccinations),
      'symptoms',            (select count(*) from public.pet_symptoms),
      'vet_visits',          (select count(*) from public.vet_visits),
      'medications',         (select count(*) from public.medications),
      'parasite_treatments', (select count(*) from public.parasite_treatments),
      'diet_logs',           (select count(*) from public.pet_diet_logs)
    ),
    'subscriptions', jsonb_build_object(
      'active_pro', v_active_pro,
      'free', greatest(0, v_total_users - v_active_pro)
    ),
    'engagement', jsonb_build_object(
      'likes_24h',     (select count(*) from public.likes where created_at >= v_now - interval '24 hours'),
      'comments_24h',  (select count(*) from public.comments where created_at >= v_now - interval '24 hours'),
      'follows_total', (select count(*) from public.follows)
    ),
    'errors', jsonb_build_object(
      'total_7d',  (select count(*) from public.app_errors where created_at >= v_now - interval '7 days'),
      'last_24h',  (select count(*) from public.app_errors where created_at >= v_now - interval '24 hours')
    ),
    'generated_at', v_now
  );
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ---------- Últimos cadastros (drill-down no painel) ----------
create or replace function public.admin_latest_signups(limit_n int default 10)
returns table (id uuid, email text, created_at timestamptz, pet_count int)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, u.created_at,
         (select count(*)::int from public.pets p where p.owner_id = u.id) as pet_count
  from auth.users u
  order by u.created_at desc
  limit limit_n;
end;
$$;
revoke all on function public.admin_latest_signups(int) from public, anon;
grant execute on function public.admin_latest_signups(int) to authenticated;
