-- ============================================================================
-- Maestro Pet — Limite de pets no SERVIDOR (anti-bypass)
--
-- Free → 1 pet · Pro → até 6. Antes a checagem vivia só no client (new.tsx),
-- então um cliente customizado / chamada direta na API criaria pets ilimitados.
-- Este trigger BEFORE INSERT trava no banco.
--
-- Isenções: admin (pra testar) e contas internas @maestropet.* (Mozart/personas
-- são seed administrado e não devem cair no limite, nem quebrar re-seed).
-- Pets já existentes acima do limite NÃO são apagados (grandfather): o trigger
-- só bloqueia NOVOS inserts.
--
-- Idempotente.
-- ============================================================================

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
  -- Admin sempre passa
  v_email := auth.jwt() ->> 'email';
  if exists (select 1 from public.admins where email = v_email) then
    return new;
  end if;

  -- Contas internas (Mozart / personas) não entram no limite
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

-- ============================================================================
-- FIM. Free: 2º pet bloqueado (pet_limit_reached). Pro: até 6. Admin/internas: livre.
-- ============================================================================
