-- ============================================================================
-- REFERRAL ANTI-FRAUDE (Fase 2) — teto + carencia + atividade real
--
-- PROBLEMA (auditoria 2026-06-11): a recompensa de 7 dias de Pro era concedida
-- INSTANTANEAMENTE no 1o pet do indicado, pro indicado E pro indicador, SEM
-- TETO e EMPILHANDO. N contas-fantasma = 7*N dias de Pro de graca pro indicador.
-- Criar 1 pet (unico requisito) e trivial e nao prova atividade real.
--
-- SOLUCAO (escolhida pelo Pedro: "teto + carencia"):
--  1. O 1o pet NAO concede mais na hora: so marca a indicacao como PENDENTE.
--  2. Um cron diario converte as pendentes que passaram pela CARENCIA (>=3 dias)
--     E provaram ATIVIDADE REAL (ganharam algum Ponto de Tutor — criar pet NAO
--     da PT, entao um shell vazio nunca converte; precisa postar/registrar
--     saude/cumprir missao).
--  3. TETO ROLANTE no indicador: no max 10 indicacoes premiadas por 30 dias.
--     O indicado (user novo real) sempre ganha; o indicador so ganha se < teto.
--
-- Mantem a regra dura: criar pet NUNCA falha por causa disso (trigger leve;
-- cron por fora, idempotente, a prova de excecao por linha).
--
-- Constantes tunaveis: CARENCIA = 3 dias, TETO = 10 por 30 dias.
-- Tudo ASCII (sem acento/emoji) pra sobreviver ao paste via clipboard.
-- Idempotente. Aplicar DEPOIS de referrals.sql e de tutor-points-ledger.sql.
-- ============================================================================

-- ---- colunas de controle --------------------------------------------------
-- referral_pending_since: quando a indicacao virou elegivel (1o pet). Inicia a carencia.
-- referral_rewarded_at:   quando o cron concedeu (usado pro teto rolante do indicador).
alter table public.profiles add column if not exists referral_pending_since timestamptz;
alter table public.profiles add column if not exists referral_rewarded_at timestamptz;

create index if not exists profiles_referral_pending_idx
  on public.profiles(referral_pending_since)
  where referral_pending_since is not null and referral_reward_granted = false;
create index if not exists profiles_referral_rewarded_idx
  on public.profiles(referred_by, referral_rewarded_at)
  where referral_rewarded_at is not null;

-- ---- trigger do 1o pet: agora so MARCA pendente (nao concede) --------------
create or replace function public.referral_reward_on_first_pet()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := new.owner_id;
  v_referrer uuid;
  v_granted boolean;
  v_pet_count int;
begin
  -- AFTER insert: a contagem ja inclui esta linha; 1 = primeiro pet
  select count(*) into v_pet_count from public.pets where owner_id = v_owner;
  if v_pet_count <> 1 then return new; end if;

  select referred_by, referral_reward_granted
    into v_referrer, v_granted
    from public.profiles where id = v_owner;

  if v_referrer is null or v_granted then return new; end if;

  -- NAO concede na hora. Marca pendente: a carencia + atividade real sao
  -- conferidas pelo cron process_referral_rewards(). coalesce = idempotente.
  update public.profiles
    set referral_pending_since = coalesce(referral_pending_since, now())
    where id = v_owner;
  return new;
exception when others then
  -- pontos/recompensa NUNCA quebram o cadastro do pet
  return new;
end;
$$;

-- (o trigger pets_referral_reward ja existe de referrals.sql e aponta pra esta funcao)

-- ---- cron: converte pendentes maduras + ativas, com teto no indicador -----
create or replace function public.process_referral_rewards()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_ref_count int;
  c_carencia constant interval := interval '3 days';
  c_cap constant int := 10;            -- max indicacoes premiadas por indicador
  c_cap_window constant interval := interval '30 days';
begin
  -- Normaliza contas in-between (tem indicador, nao premiada, ja tem pet, sem
  -- carimbo de pendencia) — ex.: criadas antes desta migracao. Inicia a carencia agora.
  update public.profiles p
    set referral_pending_since = now()
    where p.referred_by is not null
      and p.referral_reward_granted = false
      and p.referral_pending_since is null
      and exists (select 1 from public.pets pt where pt.owner_id = p.id);

  for r in
    select p.id as indicado, p.referred_by as referrer
    from public.profiles p
    where p.referred_by is not null
      and p.referral_reward_granted = false
      and p.referral_pending_since is not null
      and p.referral_pending_since <= now() - c_carencia          -- CARENCIA
      and exists (select 1 from public.tutor_points tp where tp.user_id = p.id)  -- ATIVIDADE REAL
  loop
    begin
      -- TETO ROLANTE: quantas indicacoes deste indicador foram premiadas nos ultimos 30d
      select count(*) into v_ref_count
        from public.profiles
        where referred_by = r.referrer
          and referral_rewarded_at is not null
          and referral_rewarded_at >= now() - c_cap_window;

      -- O indicado (user novo real) sempre ganha os 7 dias.
      perform public._referral_grant_pro(r.indicado, 7);

      -- O indicador so ganha se ainda nao bateu o teto na janela.
      if v_ref_count < c_cap then
        perform public._referral_grant_pro(r.referrer, 7);
      end if;

      update public.profiles
        set referral_reward_granted = true, referral_rewarded_at = now()
        where id = r.indicado;
    exception when others then
      -- uma linha problematica nunca trava o lote
      null;
    end;
  end loop;
end;
$$;
revoke all on function public.process_referral_rewards() from public;

-- ---- cron diario (10:00 BRT = 13:00 UTC) ----------------------------------
select cron.unschedule('petsocial-referral-rewards')
where exists (select 1 from cron.job where jobname = 'petsocial-referral-rewards');
select cron.schedule('petsocial-referral-rewards', '0 13 * * *', $$ select public.process_referral_rewards(); $$);
