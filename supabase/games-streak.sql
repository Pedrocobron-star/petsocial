-- ============================================================================
-- STREAK DIARIO + META DO DIA (estilo Duolingo). Derivado de game_scores,
-- SEM tabela nova. Fuso BR (America/Sao_Paulo) pro "dia" do tutor estar certo.
-- current_streak: dias seguidos jogados; continua "vivo" se o ultimo jogo foi
--   hoje OU ontem (em risco), vira 0 quando passa um dia inteiro sem jogar.
-- played_today: ja jogou hoje? plays_today/daily_goal: meta de partidas do dia.
-- ============================================================================
create or replace function public.game_streak()
returns table (
  current_streak int,
  played_today   boolean,
  best_streak    int,
  plays_today    int,
  daily_goal     int
)
language sql
security definer
set search_path = public
stable
as $$
  with days as (
    select distinct (gs.created_at at time zone 'America/Sao_Paulo')::date as d
    from public.game_scores gs
    where gs.user_id = auth.uid()
  ),
  today as (
    select (now() at time zone 'America/Sao_Paulo')::date as today_d
  ),
  grouped as (
    select d, d - (row_number() over (order by d))::int as grp
    from days
  ),
  runs as (
    select grp, count(*)::int as len, max(d) as run_end
    from grouped
    group by grp
  ),
  today_run as (
    select r.len
    from runs r, today t
    where r.run_end >= t.today_d - 1
    order by r.run_end desc
    limit 1
  ),
  plays as (
    select count(*)::int as n
    from public.game_scores gs, today t
    where gs.user_id = auth.uid()
      and (gs.created_at at time zone 'America/Sao_Paulo')::date = t.today_d
  )
  select
    coalesce((select len from today_run), 0)               as current_streak,
    exists (select 1 from days, today where d = today_d)   as played_today,
    coalesce((select max(len) from runs), 0)               as best_streak,
    coalesce((select n from plays), 0)                     as plays_today,
    3                                                      as daily_goal;
$$;
revoke all on function public.game_streak() from public, anon;
grant execute on function public.game_streak() to authenticated;

notify pgrst, 'reload schema';
