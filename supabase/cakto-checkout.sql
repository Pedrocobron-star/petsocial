-- ============================================================================
-- Maestro Pet — Checkout via CAKTO (Pix + cartão, BR)
--
-- Modelo: o app abre o link de checkout HOSPEDADO do Cakto (com o email do
-- usuário no prefill). Quando o pagamento é aprovado, o Cakto chama o webhook
-- (edge `cakto-webhook`), que valida o secret, loga o evento e ATIVA o Pet Pro
-- pelo EMAIL do comprador — reusando o mesmo caminho do admin_grant_pro
-- (subscriptions.status='active' → trigger sync_profile_is_pro → profiles.is_pro).
--
-- Segurança: as RPCs abaixo SÓ podem ser chamadas pelo service_role (a edge).
-- NUNCA por authenticated/anon (senão qualquer um se daria Pro pelo email).
--
-- Idempotente.
-- ============================================================================

-- 1) Rastrear a origem Cakto na subscription -------------------------------
alter table public.subscriptions add column if not exists cakto_order_id text;

-- Índice ÚNICO parcial: cada order_id do Cakto só pode virar UMA subscription.
-- Fecha o buraco de idempotência (webhook reenviado com mesmo order_id não cria/
-- estende em duplicidade). Parcial (where not null) porque grants do admin/founder
-- não têm order_id e podem coexistir.
create unique index if not exists subscriptions_cakto_order_uidx
  on public.subscriptions(cakto_order_id) where cakto_order_id is not null;

-- 2) Log cru dos eventos do Cakto (auditoria + calibração do parser) --------
create table if not exists public.cakto_events (
  id uuid primary key default gen_random_uuid(),
  event text,
  email text,
  order_id text,
  amount numeric,
  raw jsonb not null,
  matched_user uuid,
  result text,
  created_at timestamptz not null default now()
);
create index if not exists cakto_events_created_idx on public.cakto_events(created_at desc);
alter table public.cakto_events enable row level security;
-- Sem policies → nega anon/authenticated. service_role (edge) ignora RLS.
revoke all on public.cakto_events from anon, authenticated;

-- 3) Ativa o Pet Pro pelo EMAIL do comprador (chamada SÓ pela edge) ----------
create or replace function public.cakto_grant_pro(
  p_email text,
  p_plan text,
  p_days int,
  p_order_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_end timestamptz;
  v_plan text;
  v_rows int;
begin
  if p_email is null or btrim(p_email) = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_email');
  end if;

  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'email_not_found', 'email', p_email);
  end if;

  -- Idempotência: se essa MESMA order já ativou, não estende de novo (retry do Cakto).
  if p_order_id is not null and exists (
    select 1 from public.subscriptions
    where user_id = v_uid and cakto_order_id = p_order_id and status = 'active'
  ) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'user_id', v_uid);
  end if;

  v_plan := case when p_plan = 'yearly' then 'yearly' else 'monthly' end;
  v_end := now() + (coalesce(nullif(p_days, 0), case when v_plan = 'yearly' then 365 else 30 end) || ' days')::interval;

  update public.subscriptions
    set status = 'active',
        plan = v_plan,
        current_period_start = now(),
        current_period_end = v_end,
        cancel_at_period_end = false,
        cakto_order_id = p_order_id,
        updated_at = now()
    where user_id = v_uid;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    insert into public.subscriptions (user_id, status, plan, current_period_start, current_period_end, cakto_order_id)
    values (v_uid, 'active', v_plan, now(), v_end, p_order_id);
  end if;

  return jsonb_build_object('ok', true, 'user_id', v_uid, 'plan', v_plan, 'current_period_end', v_end);
end;
$$;

-- 4) Revoga (refund / chargeback / cancelamento) -----------------------------
create or replace function public.cakto_revoke_pro(p_email text, p_order_id text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid;
  v_rows int;
begin
  select id into v_uid from auth.users where lower(email) = lower(btrim(coalesce(p_email, ''))) limit 1;
  -- fallback: acha pela order id se o email não bater
  if v_uid is null and p_order_id is not null then
    select user_id into v_uid from public.subscriptions where cakto_order_id = p_order_id limit 1;
  end if;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  update public.subscriptions
    set status = 'canceled', cancel_at_period_end = true, updated_at = now()
    where user_id = v_uid;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', true, 'user_id', v_uid, 'updated_rows', v_rows);
end;
$$;

-- 5) Travar: SÓ a edge (service_role) chama. Nunca authenticated/anon. --------
revoke all on function public.cakto_grant_pro(text, text, int, text) from public, anon, authenticated;
grant execute on function public.cakto_grant_pro(text, text, int, text) to service_role;
revoke all on function public.cakto_revoke_pro(text, text) from public, anon, authenticated;
grant execute on function public.cakto_revoke_pro(text, text) to service_role;

-- ============================================================================
-- FIM. A edge cakto-webhook valida o secret, loga em cakto_events e chama
-- cakto_grant_pro / cakto_revoke_pro conforme o evento.
-- ============================================================================
