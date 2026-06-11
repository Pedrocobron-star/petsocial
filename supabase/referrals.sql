-- ============================================================================
-- REFERRALS — convide amigos, ambos ganham 7 dias de Pet Pro
--
-- Fluxo:
--  1. Cada user tem um referral_code (gerado on-demand).
--  2. Visitante abre /welcome?ref=CODE -> codigo salvo no localStorage.
--  3. Ao criar conta, o client chama claim_referral(code) -> grava referred_by.
--  4. Quando o indicado cria o 1o PET, um trigger da +7 dias de Pro pra AMBOS
--     (uma vez so). A concessao ESTENDE a assinatura existente (nunca encurta
--     quem ja e Pro pago) reusando a tabela subscriptions + trigger is_pro.
--
-- Tudo ASCII (sem acento/emoji) pra sobreviver ao paste via clipboard.
-- ============================================================================

-- ---- colunas no profiles --------------------------------------------------
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists referral_reward_granted boolean not null default false;

create unique index if not exists profiles_referral_code_key
  on public.profiles(referral_code) where referral_code is not null;
create index if not exists profiles_referred_by_idx
  on public.profiles(referred_by) where referred_by is not null;

-- ---- gerador de codigo (6 chars, sem caracteres ambiguos) -----------------
create or replace function public.gen_referral_code()
returns text language plpgsql as $$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- sem I O L 0 1
  v_code text;
  v_try int := 0;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
    v_try := v_try + 1;
    if v_try > 25 then
      v_code := v_code || floor(random() * 90 + 10)::text;
      exit;
    end if;
  end loop;
  return v_code;
end;
$$;

-- ---- pega ou cria o codigo do caller --------------------------------------
create or replace function public.get_or_create_my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select referral_code into v_code from public.profiles where id = v_uid;
  if v_code is null then
    v_code := public.gen_referral_code();
    update public.profiles set referral_code = v_code where id = v_uid;
  end if;
  return v_code;
end;
$$;
grant execute on function public.get_or_create_my_referral_code() to authenticated;

-- ---- registra quem indicou (chamado pelo client logo apos signup) ---------
create or replace function public.claim_referral(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_code is null or length(trim(p_code)) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;

  select referred_by into v_existing from public.profiles where id = v_uid;
  if v_existing is not null then
    return jsonb_build_object('ok', false, 'reason', 'already_set');
  end if;

  select id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'code_not_found');
  end if;
  if v_referrer = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'self');
  end if;

  update public.profiles set referred_by = v_referrer where id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

-- ---- concessao interna de Pro que ESTENDE (nunca encurta) -----------------
-- NAO exposta a clients (so trigger interno chama). Reusa subscriptions, entao
-- o trigger subscriptions_sync_pro cuida do profiles.is_pro.
create or replace function public._referral_grant_pro(p_user_id uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz;
  v_base timestamptz;
  v_found boolean;
begin
  select current_period_end into v_end from public.subscriptions where user_id = p_user_id;
  v_found := found;
  -- estende a partir do fim atual se ainda valido; senao a partir de agora
  v_base := case when v_end is not null and v_end > now() then v_end else now() end;

  if v_found then
    update public.subscriptions
    set status = 'active',
        current_period_end = v_base + (p_days || ' days')::interval,
        cancel_at_period_end = false,
        updated_at = now()
    where user_id = p_user_id;
  else
    insert into public.subscriptions (
      user_id, status, plan, current_period_start, current_period_end,
      granted_by_admin, granted_by_admin_email, granted_at
    ) values (
      p_user_id, 'active', 'monthly', now(), now() + (p_days || ' days')::interval,
      true, 'referral-reward', now()
    );
  end if;
end;
$$;
revoke all on function public._referral_grant_pro(uuid, int) from public;

-- ---- recompensa no 1o pet do indicado -------------------------------------
-- ⚠️ DEFINICAO CANONICA movida para supabase/referral-antifraud.sql (2026-06-11).
-- Aquela versao apenas MARCA a indicacao como pendente (referral_pending_since);
-- a concessao de Pro acontece no cron process_referral_rewards (carencia >=3d +
-- teto rolante 10/30d + prova de atividade). NAO redefinir a funcao aqui —
-- reaplicar este arquivo reverteria o anti-fraude (voltaria a conceder Pro na
-- hora, sem teto). O trigger pets_referral_reward (abaixo) continua aqui e
-- aponta pra funcao canonica; aplique referral-antifraud.sql por cima depois.

drop trigger if exists pets_referral_reward on public.pets;
create trigger pets_referral_reward
  after insert on public.pets
  for each row execute function public.referral_reward_on_first_pet();

-- ---- stats pro card de convite --------------------------------------------
create or replace function public.my_referral_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_invited int;
  v_converted int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select referral_code into v_code from public.profiles where id = v_uid;
  if v_code is null then
    v_code := public.gen_referral_code();
    update public.profiles set referral_code = v_code where id = v_uid;
  end if;
  select count(*) into v_invited from public.profiles where referred_by = v_uid;
  select count(*) into v_converted from public.profiles where referred_by = v_uid and referral_reward_granted = true;
  return jsonb_build_object('code', v_code, 'invited', v_invited, 'converted', v_converted);
end;
$$;
grant execute on function public.my_referral_stats() to authenticated;
