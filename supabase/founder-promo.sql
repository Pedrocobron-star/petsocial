-- ============================================================================
-- Maestro Pet — Promo "Membros Fundadores" (primeiros 100 ganham 3 meses de Pro)
--
-- Ideia: os 100 primeiros a se cadastrar ganham Pet Pro grátis por 3 meses.
-- Doar Pro NÃO é venda → não precisa de CNPJ/gateway pra isso; serve pra
-- validar o app com beta-testers e criar escassez no lançamento.
--
-- Como funciona:
--   - Todo cadastro REAL recebe um `founder_number` sequencial (ordem de entrada).
--     Contas de sistema (mascote Mozart, personas, seeds @maestropet.*) NÃO
--     consomem número.
--   - Os 100 primeiros (founder_number <= 100) recebem Pet Pro por 3 meses,
--     via subscriptions (status='active', plan='founder', current_period_end
--     = now()+3 meses). O trigger sync_profile_is_pro já liga profiles.is_pro,
--     e o cron expire_subscriptions (subscription-expiry.sql) rebaixa no fim.
--   - O número EXIBIDO ao usuário é `founder_number + 14` (começa em #15 pra não
--     parecer vazio no lançamento) e cresce de verdade a cada cadastro real.
--
-- Tudo idempotente + à prova de exceção (NUNCA bloqueia o cadastro).
-- ============================================================================

-- Offset cosmético do número exibido (real + 14 → começa em #15).
-- Mantido como constante na função my_founder_status() abaixo.

-- 1) Coluna de ordem de cadastro + sequência atômica
alter table public.profiles add column if not exists founder_number int;
create unique index if not exists profiles_founder_number_idx
  on public.profiles(founder_number) where founder_number is not null;
create sequence if not exists public.founder_number_seq;

-- 2) plan='founder' precisa ser aceito pelo check de subscriptions.plan
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'subscriptions_plan_check'
  ) then
    alter table public.subscriptions drop constraint subscriptions_plan_check;
  end if;
  alter table public.subscriptions
    add constraint subscriptions_plan_check
    check (plan in ('monthly','yearly','founder'));
end$$;

-- 3) Atribui o número de fundador + concede Pro aos 100 primeiros
create or replace function public.assign_founder_number()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_email text;
  v_num int;
begin
  -- Já tem número? (idempotência) então não faz nada.
  if new.founder_number is not null then
    return new;
  end if;

  select email into v_email from auth.users where id = new.id;
  -- Pula contas de sistema (mascote/personas/seeds usam @maestropet.*).
  if v_email is null or v_email ilike '%@maestropet.%' then
    return new;
  end if;

  v_num := nextval('public.founder_number_seq');
  update public.profiles set founder_number = v_num where id = new.id;

  -- Os 100 primeiros ganham Pet Pro por 3 meses.
  if v_num <= 100 then
    insert into public.subscriptions (user_id, status, plan, current_period_start, current_period_end, updated_at)
    values (new.id, 'active', 'founder', now(), now() + interval '3 months', now())
    on conflict (user_id) do update
      set status = 'active',
          plan = 'founder',
          current_period_start = now(),
          current_period_end = greatest(
            excluded.current_period_end,
            coalesce(public.subscriptions.current_period_end, excluded.current_period_end)
          ),
          updated_at = now();
  end if;

  return new;
exception when others then
  -- Pontos/promo NUNCA bloqueiam o cadastro.
  return new;
end;
$$;

drop trigger if exists profiles_assign_founder on public.profiles;
create trigger profiles_assign_founder
  after insert on public.profiles
  for each row execute function public.assign_founder_number();

-- 4) Status do fundador PRO USUÁRIO LOGADO (pra tela de parabéns + perfil)
create or replace function public.my_founder_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_num int;
  v_until timestamptz;
begin
  select founder_number into v_num from public.profiles where id = auth.uid();
  if v_num is null then
    return jsonb_build_object('is_founder', false, 'founder_number', null, 'display_number', null);
  end if;
  select current_period_end into v_until
    from public.subscriptions where user_id = auth.uid();
  return jsonb_build_object(
    'is_founder', v_num <= 100,
    'founder_number', v_num,
    'display_number', v_num + 14,
    'pro_until', case when v_num <= 100 then v_until else null end
  );
end;
$$;
revoke all on function public.my_founder_status() from public, anon;
grant execute on function public.my_founder_status() to authenticated;

-- 5) Status PÚBLICO da promo (pra landing — visitante deslogado)
create or replace function public.founder_promo_status()
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'limit', 100,
    'taken', t.taken,
    'remaining', greatest(0, 100 - t.taken),
    'display_count', t.taken + 14,
    'active', (100 - t.taken) > 0
  )
  from (
    select count(*)::int as taken
    from public.profiles
    where founder_number is not null and founder_number <= 100
  ) t;
$$;
revoke all on function public.founder_promo_status() from public;
grant execute on function public.founder_promo_status() to anon, authenticated;

-- ============================================================================
-- FIM. Cadastro real → ganha founder_number; os 100 primeiros ganham 3 meses
-- de Pet Pro automático. Número exibido = founder_number + 14 (começa em #15).
-- ============================================================================
