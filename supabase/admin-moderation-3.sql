-- ============================================================================
-- Maestro Pet -- Moderacao avancada: MUTE (suspensao TEMPORARIA, volta sozinho)
-- Estende o ban: alem de banned_at, agora muted_until > now() tambem bloqueia
-- postar/comentar/DM. Reusa os triggers existentes (so recria as funcoes).
-- Idempotente. ASCII. Aplicar depois de admin-moderation.sql.
-- ============================================================================

alter table public.profiles add column if not exists muted_until timestamptz;
alter table public.profiles add column if not exists muted_reason text;

-- enforce em posts/comments (owner via pet): bloqueia se banido OU silenciado
create or replace function public.enforce_not_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.pets pe
    join public.profiles pr on pr.id = pe.owner_id
    where pe.id = new.pet_id
      and (pr.banned_at is not null or pr.muted_until > now())
  ) then
    raise exception 'Conta suspensa: nao e possivel publicar agora.' using errcode = 'P0001';
  end if;
  return new;
exception when others then
  if sqlerrm like 'Conta suspensa%' then raise; end if;
  return new;
end;
$$;

-- enforce em messages (pelo sender): bloqueia se banido OU silenciado
create or replace function public.enforce_not_banned_sender()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.profiles pr
    where pr.id = new.sender_id
      and (pr.banned_at is not null or pr.muted_until > now())
  ) then
    raise exception 'Conta suspensa: nao e possivel enviar mensagens.' using errcode = 'P0001';
  end if;
  return new;
exception when others then
  if sqlerrm like 'Conta suspensa%' then raise; end if;
  return new;
end;
$$;

-- admin silencia/remove silencio (p_hours null/<=0 = remover). is_admin gated.
create or replace function public.admin_mute_user(p_user_id uuid, p_hours int, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_hours is null or p_hours <= 0 then
    update public.profiles set muted_until = null, muted_reason = null where id = p_user_id;
    perform public.log_admin_action('unmute', 'user', p_user_id::text);
  else
    update public.profiles
      set muted_until = now() + (p_hours || ' hours')::interval, muted_reason = p_reason
      where id = p_user_id;
    perform public.log_admin_action('mute', 'user', p_user_id::text, jsonb_build_object('hours', p_hours, 'reason', p_reason));
  end if;
end;
$$;
revoke all on function public.admin_mute_user(uuid, int, text) from public, anon;
grant execute on function public.admin_mute_user(uuid, int, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK: select count(*) from pg_proc where proname = 'admin_mute_user'; -- 1
--   select pg_get_functiondef('public.enforce_not_banned'::regproc) ilike '%muted_until%'; -- t
-- ============================================================================
