-- ============================================================================
-- Maestro Pet — Expiração de assinatura (fim do "Pro vitalício")
--
-- Problema: o webhook do Cakto ATIVA o Pro (subscriptions.status='active' +
-- current_period_end = now()+período), mas NADA rebaixa quando o período acaba.
-- Como o pagamento é AVULSO (sem renovação automática), quem paga 1x ficava Pro
-- pra sempre = vazamento de receita.
--
-- Solução: função expire_subscriptions() que volta pra 'free' toda assinatura
-- 'active'/'trialing' cujo current_period_end já passou. O trigger
-- sync_profile_is_pro (admin-grant-pro.sql) já zera profiles.is_pro no UPDATE.
-- Grants PERMANENTES do admin têm current_period_end NULL → NUNCA expiram (a
-- comparação `< now()` é falsa pra NULL). Grants temporários do admin expiram
-- no fim do prazo (que é o esperado). cancel_at_period_end é respeitado de graça
-- (só expira quando o período realmente termina).
--
-- Idempotente. Cron diário.
-- ============================================================================

create or replace function public.expire_subscriptions()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update public.subscriptions
    set status = 'free', updated_at = now()
    where status in ('active', 'trialing')
      and current_period_end is not null
      and current_period_end < now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Só o cron/servidor chama (não expõe a usuários).
revoke all on function public.expire_subscriptions() from public, anon, authenticated;

-- Cron diário às 05:00 UTC (02:00 BRT). Reagenda de forma idempotente.
select cron.unschedule(jobid) from cron.job where jobname = 'petsocial-expire-subs';
select cron.schedule('petsocial-expire-subs', '0 5 * * *', $$select public.expire_subscriptions();$$);

-- Roda uma vez agora pra limpar qualquer Pro já vencido.
select public.expire_subscriptions();

-- ============================================================================
-- FIM. Diário: assinaturas vencidas voltam a 'free' e is_pro=false automático.
-- ============================================================================
