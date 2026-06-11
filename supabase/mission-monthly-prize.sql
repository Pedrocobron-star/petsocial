-- =============================================================================
-- COMPETIÇÃO MENSAL — o 1º do mês ganha 1 mês de Pet Pro
-- =============================================================================
-- ⚠️ ATENÇÃO — ORDEM DE APLICAÇÃO / FONTE ÚNICA DA VERDADE
--
-- As FUNÇÕES desta competição (mission_monthly_leaderboard, mission_my_monthly,
-- award_mission_monthly_winner) VIVEM EM `supabase/tutor-points-ledger.sql`, que
-- é a versão CANÔNICA: ela soma o LEDGER unificado `tutor_points` PONDERADO
-- (social pesa 0.7) com o teto diário de 120 PT — não mais a soma crua de
-- `daily_mission_completions.points`.
--
-- Este arquivo guarda APENAS: (1) a tabela de idempotência `mission_monthly_winners`
-- e (2) o agendamento do cron. NÃO redefina aqui as funções: se este arquivo for
-- reaplicado DEPOIS do ledger, ele NÃO pode reverter a lógica ponderada.
--
-- Aplicar este arquivo ANTES de tutor-points-ledger.sql (a tabela precisa existir
-- pro ledger referenciar; o ledger então define/atualiza as funções por cima).
--
-- Idempotente.
-- =============================================================================

-- ---------- Histórico de campeões (idempotência do cron) ----------
create table if not exists public.mission_monthly_winners (
  month_start date primary key,                  -- 1º dia do mês premiado (BRT)
  user_id uuid references auth.users(id) on delete set null,  -- null = mês sem ninguém
  points int not null default 0,
  note text,                                     -- auditoria: 'ok' / motivo de ficar sem campeão
  awarded_at timestamptz not null default now()
);
alter table public.mission_monthly_winners add column if not exists note text;
alter table public.mission_monthly_winners enable row level security;
drop policy if exists mmw_read on public.mission_monthly_winners;
create policy mmw_read on public.mission_monthly_winners for select using (true);

-- ---------- Funções da competição ----------
-- DEFINIDAS EM supabase/tutor-points-ledger.sql (versão ponderada + teto + ledger).
-- mission_monthly_leaderboard(int), mission_my_monthly(), award_mission_monthly_winner().
-- Mantidas FORA daqui de propósito, pra um reapply deste arquivo nunca reverter.

-- ---------- Cron mensal: dia 1, 04:00 UTC (01:00 BRT) -> premia o mês que fechou ----------
-- Chama a função canônica por nome (resolvida em tempo de execução).
select cron.unschedule('petsocial-mission-monthly')
where exists (select 1 from cron.job where jobname = 'petsocial-mission-monthly');
select cron.schedule('petsocial-mission-monthly', '0 4 1 * *', $$ select public.award_mission_monthly_winner(); $$);
