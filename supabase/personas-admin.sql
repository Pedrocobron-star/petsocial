-- ============================================================================
-- Maestro Pet — Admin de Personas: editar perfil + checklist do Desafio do Dia
--
-- As 3 personas pertencem a tutores @maestropet.app, NÃO ao admin (Pedro), então
-- o client dele não consegue UPDATE direto em pets/profiles delas (RLS owner-only).
-- Por isso 2 RPCs SECURITY DEFINER gated por is_admin(), com WHITELIST dos 3
-- UUIDs (pra não virarem "editar/ver qualquer pet"). Padrão do admin-grant-pro.sql.
-- Idempotente. Aplicar via Management API (ver supabase_sql_apply).
-- ============================================================================

-- 1) Editar o perfil de uma persona (como um pet real).
create or replace function public.admin_update_persona(
  p_pet_id uuid,
  p_name text,
  p_species text,
  p_breed text,
  p_bio text,
  p_birthdate date,
  p_avatar_url text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_pet_id not in (
    'c0000001-0000-4000-8000-000000000001',
    'c0000002-0000-4000-8000-000000000002',
    'c0000003-0000-4000-8000-000000000003'
  ) then
    raise exception 'not_a_persona' using errcode = '42501';
  end if;

  update public.pets set
    name = coalesce(nullif(trim(p_name), ''), name),
    species = coalesce(p_species, species),
    breed = nullif(trim(p_breed), ''),
    bio = nullif(trim(p_bio), ''),
    birthdate = p_birthdate,
    avatar_url = nullif(trim(p_avatar_url), ''),
    updated_at = now()
  where id = p_pet_id;

  -- Espelha foto/bio no tutor-persona (o feed mostra o pet, mas mantém coerente).
  update public.profiles pr set
    avatar_url = nullif(trim(p_avatar_url), ''),
    bio = coalesce(nullif(trim(p_bio), ''), pr.bio)
  from public.pets pe
  where pe.id = p_pet_id and pr.id = pe.owner_id;
end;
$$;
revoke all on function public.admin_update_persona(uuid, text, text, text, text, date, text) from public, anon;
grant execute on function public.admin_update_persona(uuid, text, text, text, text, date, text) to authenticated;

-- 2) Checklist do Desafio do Dia: cada persona já postou o desafio de hoje?
--    (procura um persona_posts agendado/publicado HOJE em BRT com a hashtag do dia)
create or replace function public.personas_today_status()
returns table (pet_id uuid, name text, done boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_day int := extract(day from (now() at time zone 'America/Sao_Paulo'))::int;
  v_tag text;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select hashtag into v_tag from public.daily_missions
    where day_of_month = v_day and active = true limit 1;

  return query
  select p.id, p.name,
    (v_tag is not null and exists (
      select 1 from public.persona_posts pp
      where pp.pet_id = p.id
        and pp.status in ('scheduled', 'published')
        and (coalesce(pp.scheduled_at, pp.created_at) at time zone 'America/Sao_Paulo')::date
            = (now() at time zone 'America/Sao_Paulo')::date
        and lower(pp.caption) like '%#' || lower(v_tag) || '%'
    )) as done
  from public.pets p
  where p.id in (
    'c0000001-0000-4000-8000-000000000001',
    'c0000002-0000-4000-8000-000000000002',
    'c0000003-0000-4000-8000-000000000003'
  )
  order by p.id;
end;
$$;
revoke all on function public.personas_today_status() from public, anon;
grant execute on function public.personas_today_status() to authenticated;

-- ============================================================================
-- FIM. O painel admin/personas usa admin_update_persona (editar perfil) e
-- personas_today_status (checklist N/3 do desafio do dia).
-- ============================================================================
