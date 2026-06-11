-- =============================================================================
-- COMPETIÇÃO MENSAL DA MISSÃO DO DIA — o 1º do mês ganha 1 mês de Pet Pro
-- =============================================================================
-- Os pontos da Missão do Dia (daily_mission_completions.points) já existiam.
-- Aqui eles viram uma CORRIDA MENSAL: soma dos pontos do MÊS CORRENTE (BRT),
-- ranqueada por tutor. No 1º dia do mês seguinte, um cron premia o campeão do
-- mês que fechou com 1 mês de Pro + avisa por notificação e DM do Mozart.
--
-- O Nível de Tutor (lib/tutor-level.ts) continua sendo a soma de VIDA (não
-- zera) — é a jornada. O ranking aqui é mensal (zera todo mês). Coexistem.
--
-- Idempotente.
-- =============================================================================

-- ---------- Histórico de campeões (idempotência do cron) ----------
create table if not exists public.mission_monthly_winners (
  month_start date primary key,                  -- 1º dia do mês premiado (BRT)
  user_id uuid references auth.users(id) on delete set null,  -- null = mês sem ninguém
  points int not null default 0,
  awarded_at timestamptz not null default now()
);
alter table public.mission_monthly_winners enable row level security;
drop policy if exists mmw_read on public.mission_monthly_winners;
create policy mmw_read on public.mission_monthly_winners for select using (true);

-- ---------- Leaderboard do MÊS CORRENTE ----------
create or replace function public.mission_monthly_leaderboard(p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  tutor_avatar text,
  points int,
  completions int,
  rank_position int
) language sql security definer set search_path = public stable as $$
  with mp as (
    select dmc.user_id, sum(dmc.points)::int as points, count(*)::int as completions
    from public.daily_mission_completions dmc
    where dmc.completion_date >= date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date
      and dmc.completion_date < (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month')::date
    group by dmc.user_id
  ),
  ranked as (
    select mp.*, row_number() over (order by mp.points desc, mp.completions desc, mp.user_id asc) as rnk
    from mp
  )
  select r.user_id, coalesce(pr.display_name, 'Tutor'), pr.avatar_url, r.points, r.completions, r.rnk::int
  from ranked r
  left join public.profiles pr on pr.id = r.user_id
  order by r.points desc, r.completions desc, r.user_id asc
  limit p_limit;
$$;
grant execute on function public.mission_monthly_leaderboard(int) to authenticated, anon;

-- ---------- Meu rank do mês corrente ----------
create or replace function public.mission_my_monthly()
returns table (rank int, points int, total_tutors int)
language sql security definer set search_path = public stable as $$
  with mp as (
    select dmc.user_id, sum(dmc.points)::int as points
    from public.daily_mission_completions dmc
    where dmc.completion_date >= date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date
      and dmc.completion_date < (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month')::date
    group by dmc.user_id
  ),
  ranked as (
    select mp.user_id, mp.points, row_number() over (order by mp.points desc, mp.user_id asc) as rnk
    from mp
  )
  select r.rnk::int, r.points, (select count(*)::int from ranked)
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function public.mission_my_monthly() to authenticated;

-- ---------- Premiação do MÊS ANTERIOR (rodada por cron) ----------
create or replace function public.award_mission_monthly_winner()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month_start date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) - interval '1 month')::date;
  v_month_end   date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date))::date - 1;
  v_winner uuid;
  v_points int;
  v_mozart uuid := 'd0c0ffee-0000-4000-8000-00000000cafe';
  v_conv uuid;
begin
  -- Já premiou esse mês? sai (idempotência).
  if exists (select 1 from public.mission_monthly_winners where month_start = v_month_start) then
    return;
  end if;

  -- Campeão do mês anterior (precisa ter pontuado).
  select dmc.user_id, sum(dmc.points)::int
  into v_winner, v_points
  from public.daily_mission_completions dmc
  where dmc.completion_date >= v_month_start and dmc.completion_date <= v_month_end
  group by dmc.user_id
  having sum(dmc.points) > 0
  order by sum(dmc.points) desc, count(*) desc, dmc.user_id asc
  limit 1;

  -- Ninguém pontuou: registra "sem campeão" pra não reprocessar.
  if v_winner is null then
    insert into public.mission_monthly_winners (month_start, user_id, points)
    values (v_month_start, null, 0)
    on conflict (month_start) do nothing;
    return;
  end if;

  -- Concede 1 mês de Pro (replica admin_grant_pro: o cron não tem admin/auth.uid).
  -- O trigger subscriptions_sync_pro atualiza profiles.is_pro automaticamente.
  update public.subscriptions
  set status = 'active', plan = 'monthly', current_period_start = now(),
      current_period_end = now() + interval '30 days', cancel_at_period_end = false,
      granted_by_admin = true, granted_by_admin_email = 'sistema:campeao-missao-mensal',
      granted_at = now(), updated_at = now()
  where user_id = v_winner;
  if not found then
    insert into public.subscriptions
      (user_id, status, plan, current_period_start, current_period_end, granted_by_admin, granted_by_admin_email, granted_at)
    values
      (v_winner, 'active', 'monthly', now(), now() + interval '30 days', true, 'sistema:campeao-missao-mensal', now());
  end if;

  -- Registra o campeão.
  insert into public.mission_monthly_winners (month_start, user_id, points)
  values (v_month_start, v_winner, v_points)
  on conflict (month_start) do nothing;

  -- Notificação in-app.
  insert into public.notifications (user_id, kind, title, body, url, created_at)
  values (v_winner, 'broadcast', 'Você é o campeão do mês! 🏆',
    'você fez mais pontos na Missão do Dia e ganhou 1 mês de Pet Pro! aproveita 🎉', '/pro', now());

  -- DM do Mozart (replica admin_mozart_dm; voz de cachorro fofo, sem travessão).
  select c.id into v_conv
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = v_winner
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = v_mozart
  limit 1;
  if v_conv is null then
    insert into public.conversations (last_message_at) values (now()) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
    values (v_conv, v_winner, '1970-01-01T00:00:00Z'), (v_conv, v_mozart, now());
  end if;
  insert into public.messages (conversation_id, sender_id, content)
  values (v_conv, v_mozart,
    'au au! voce foi o tutor com mais pontos do mes na Missao do Dia e ganhou 1 mes de Pet Pro de presente! to muito feliz por voce. bora manter o ritmo nesse mes tambem! 🏆🐾');
end;
$$;

-- ---------- Cron mensal: dia 1, 04:00 UTC (01:00 BRT) -> premia o mês que fechou ----------
select cron.unschedule('petsocial-mission-monthly')
where exists (select 1 from cron.job where jobname = 'petsocial-mission-monthly');
select cron.schedule('petsocial-mission-monthly', '0 4 1 * *', $$ select public.award_mission_monthly_winner(); $$);
