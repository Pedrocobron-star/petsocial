-- ============================================================================
-- MAESTRO PET — CORREÇÕES 2 (cole no SQL Editor → Run). Idempotente.
-- Bugs achados na caça pós-lançamento que dependem do banco:
--   N) trigger de limite de post não contava 'trialing' como Pro (barrava trial).
--   O) limite de pets só existia no client (bypassável via API) → trigger novo.
-- ============================================================================

-- N) Post limit reconhece trial de Pro (free-tier-limits.sql) -----------------
create or replace function public.enforce_free_post_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_count int;
  v_email text;
begin
  if new.reposted_from is not null then
    return new;
  end if;
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is null then
    return new;
  end if;
  v_email := auth.jwt() ->> 'email';
  if exists (select 1 from public.admins where email = v_email) then
    return new;
  end if;
  -- Pro passa direto (active OU trialing)
  if exists (
    select 1 from public.subscriptions
    where user_id = v_owner and status in ('active', 'trialing')
  ) then
    return new;
  end if;
  select count(*) into v_count
  from public.posts po
  join public.pets pe on pe.id = po.pet_id
  where pe.owner_id = v_owner
    and po.created_at >= date_trunc('day', now())
    and po.reposted_from is null;
  if v_count >= 1 then
    raise exception 'free_post_limit_reached'
      using hint = 'Plano gratuito permite 1 post por dia. Vire Pet Pro pra postar sem limites.',
            errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_enforce_free_limit on public.posts;
create trigger posts_enforce_free_limit
  before insert on public.posts
  for each row execute function public.enforce_free_post_limit();


-- O) Limite de pets no servidor (pet-limit.sql) -------------------------------
create or replace function public.enforce_pet_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
  v_email text;
  v_owner_email text;
  v_is_pro boolean;
  v_limit int;
begin
  v_email := auth.jwt() ->> 'email';
  if exists (select 1 from public.admins where email = v_email) then
    return new;
  end if;
  select email into v_owner_email from auth.users where id = new.owner_id;
  if v_owner_email like '%@maestropet.%' then
    return new;
  end if;
  v_is_pro := exists (
    select 1 from public.subscriptions
    where user_id = new.owner_id and status in ('active', 'trialing')
  );
  v_limit := case when v_is_pro then 6 else 1 end;
  select count(*) into v_count from public.pets where owner_id = new.owner_id;
  if v_count >= v_limit then
    raise exception 'pet_limit_reached'
      using hint = 'Plano gratuito permite 1 pet. Vire Pet Pro pra ter até 6.',
            errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists pets_enforce_limit on public.pets;
create trigger pets_enforce_limit
  before insert on public.pets
  for each row execute function public.enforce_pet_limit();

notify pgrst, 'reload schema';
-- ============================================================================
-- FIM. "Success. No rows returned".
-- ============================================================================
