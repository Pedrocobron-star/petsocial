-- ============================================================================
-- Maestro Pet -- Admin: visibilidade operacional (Erros, Banidos, Fundadores)
-- RPCs SECURITY DEFINER, gate por is_admin(). Idempotente. ASCII-only.
-- (Log de auditoria nao precisa de RPC: admin_audit ja e legivel via RLS.)
-- ============================================================================

-- ---- ERROS: lista app_errors com email do user (drill-down) ----------------
create or replace function public.admin_list_errors(
  p_limit int default 100, p_offset int default 0, p_search text default null
)
returns table (
  id uuid, created_at timestamptz, message text, route text,
  platform text, app_version text, user_id uuid, email text, stack text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select e.id, e.created_at, e.message, e.route, e.platform, e.app_version,
           e.user_id, u.email::text, e.stack
    from public.app_errors e
    left join auth.users u on u.id = e.user_id
    where (p_search is null
           or e.message ilike '%' || p_search || '%'
           or e.route ilike '%' || p_search || '%')
    order by e.created_at desc
    limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end;
$$;
revoke all on function public.admin_list_errors(int, int, text) from public, anon;
grant execute on function public.admin_list_errors(int, int, text) to authenticated;

-- ---- BANIDOS: lista usuarios com banned_at preenchido ----------------------
create or replace function public.admin_list_banned_users(
  p_limit int default 100, p_offset int default 0, p_search text default null
)
returns table (
  id uuid, email text, display_name text, banned_at timestamptz, banned_reason text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.banned_at, p.banned_reason
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.banned_at is not null
      and (p_search is null
           or u.email ilike '%' || p_search || '%'
           or p.display_name ilike '%' || p_search || '%')
    order by p.banned_at desc
    limit greatest(1, least(p_limit, 500)) offset greatest(0, p_offset);
end;
$$;
revoke all on function public.admin_list_banned_users(int, int, text) from public, anon;
grant execute on function public.admin_list_banned_users(int, int, text) to authenticated;

-- ---- FUNDADORES: resumo da promo dos 100 primeiros -------------------------
create or replace function public.admin_founder_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_taken int;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  select count(*) into v_taken from public.profiles
    where founder_number is not null and founder_number <= 100;
  return jsonb_build_object(
    'limit', 100,
    'taken', v_taken,
    'remaining', greatest(0, 100 - v_taken),
    'display_count', v_taken + 14,
    'pro_active', (select count(*) from public.subscriptions
                    where plan = 'founder' and status = 'active' and current_period_end > now()),
    'expired', (select count(*) from public.subscriptions
                  where plan = 'founder' and (status <> 'active' or current_period_end <= now()))
  );
end;
$$;
revoke all on function public.admin_founder_overview() from public, anon;
grant execute on function public.admin_founder_overview() to authenticated;

-- ---- FUNDADORES: lista dos 100 (numero, email, ate quando tem Pro) ---------
create or replace function public.admin_list_founders(
  p_limit int default 120, p_offset int default 0
)
returns table (
  founder_number int, id uuid, email text, display_name text,
  pro_until timestamptz, pro_active boolean
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select p.founder_number, p.id, u.email::text, p.display_name,
           s.current_period_end as pro_until,
           coalesce(s.status = 'active' and s.current_period_end > now(), false) as pro_active
    from public.profiles p
    join auth.users u on u.id = p.id
    left join lateral (
      select status, current_period_end from public.subscriptions
      where user_id = p.id and plan = 'founder'
      order by current_period_end desc nulls last limit 1
    ) s on true
    where p.founder_number is not null and p.founder_number <= 100
    order by p.founder_number asc
    limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end;
$$;
revoke all on function public.admin_list_founders(int, int) from public, anon;
grant execute on function public.admin_list_founders(int, int) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba nova):
--   select count(*) from pg_proc where proname in
--     ('admin_list_errors','admin_list_banned_users','admin_founder_overview','admin_list_founders'); -- 4
-- ============================================================================
