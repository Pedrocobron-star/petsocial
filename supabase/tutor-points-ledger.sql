-- =============================================================================
-- PONTOS DE TUTOR (PT) — Fase 1: ledger imutável + saúde + social + missão
-- =============================================================================
-- Unifica a pontuação: cada área do app vira PT, numa moeda só. Fase 1 cobre
-- SAÚDE (vacina, vet, peso, antiparasitário), SOCIAL (post) e MISSÃO. Jogos
-- (limitados) e cassino (só pódio) ficam pra fases seguintes.
--
-- Princípios anti-exploit (do red-team):
--  - LEDGER IMUTÁVEL: usuário só LÊ; ninguém deleta/edita linha. delete+readd
--    NÃO refarma (dedup_key único, desacoplado do id da linha de origem).
--  - CRÉDITO ANCORADO em now() BRT, não na data digitada (senão dá pra cadastrar
--    5 anos de vacina e farmar). dedup por período real + cap diário global.
--  - PONTOS NUNCA QUEBRAM A AÇÃO: todo trigger é à prova de exceção (on error
--    do nothing). Salvar vacina/post jamais falha por causa de pontos.
--  - RANKING MENSAL PONDERADO: social conta 70% (protege o prêmio de Pro).
--
-- ⚠️ FONTE ÚNICA das funções da competição mensal (mission_monthly_leaderboard,
-- mission_my_monthly, award_mission_monthly_winner): elas são definidas AQUI, NÃO
-- em mission-monthly-prize.sql (esse arquivo só tem a tabela + o cron). Aplicar
-- ESTE arquivo DEPOIS de mission-monthly-prize.sql, pra estas versões (ledger
-- ponderado + teto) ficarem por cima da tabela que aquele cria.
--
-- Idempotente.
-- =============================================================================

-- ---------- Ledger ----------
create table if not exists public.tutor_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,            -- 'mission' | 'health:vaccine|vet|weight|parasite' | 'social:post'
  points int not null check (points >= 0),
  ref_id uuid,                     -- linha de origem (SEM fk: desacoplado de delete)
  dedup_key text not null unique,  -- impede duplo crédito + aplica cap por período
  created_at timestamptz not null default now()
);
create index if not exists tutor_points_user_idx on public.tutor_points(user_id, created_at desc);

alter table public.tutor_points enable row level security;
drop policy if exists tutor_points_read_own on public.tutor_points;
create policy tutor_points_read_own on public.tutor_points for select using (user_id = auth.uid());
-- Imutável pra usuários: só funções SECURITY DEFINER escrevem.
revoke insert, update, delete on public.tutor_points from authenticated, anon;

-- ---------- Peso por fonte (protege o ranking mensal) ----------
create or replace function public._tp_weight(p_source text)
returns numeric language sql immutable as $$
  select case when p_source like 'social:%' then 0.7 else 1.0 end;
$$;

-- ---------- Concede PT (best-effort, cap diário global, idempotente) ----------
create or replace function public._award_tutor_points(
  p_user uuid, p_source text, p_points int, p_ref uuid, p_dedup text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_today int;
  v_cap int := 120;            -- teto diário global (BRT) — backstop anti-farm
  v_grant int;
  v_day_start timestamptz := (date_trunc('day', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo');
begin
  if p_user is null or p_points is null or p_points <= 0 or p_dedup is null then return; end if;
  if exists (select 1 from public.tutor_points where dedup_key = p_dedup) then return; end if;
  select coalesce(sum(points), 0) into v_today
  from public.tutor_points
  where user_id = p_user and created_at >= v_day_start;
  v_grant := least(p_points, greatest(0, v_cap - v_today));
  if v_grant <= 0 then return; end if;
  insert into public.tutor_points (user_id, source, points, ref_id, dedup_key)
  values (p_user, p_source, v_grant, p_ref, p_dedup)
  on conflict (dedup_key) do nothing;
exception when others then
  return;  -- pontos NUNCA bloqueiam a ação principal
end;
$$;

-- ---------- Helpers de data BRT ----------
-- (inline nos triggers via to_char(now() at time zone 'America/Sao_Paulo', ...))

-- ---------- Triggers de SAÚDE ----------
create or replace function public._tp_on_vaccination()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mon text := to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM');
begin
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is not null then
    perform public._award_tutor_points(v_owner, 'health:vaccine', 40, new.id,
      'health:vaccine:' || new.pet_id::text || ':' || lower(coalesce(trim(new.name), '')) || ':' || v_mon);
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_vaccination on public.vaccinations;
create trigger tp_vaccination after insert on public.vaccinations
for each row execute function public._tp_on_vaccination();

create or replace function public._tp_on_vet_visit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_day text := to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD');
begin
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is not null then
    perform public._award_tutor_points(v_owner, 'health:vet', 30, new.id,
      'health:vet:' || new.pet_id::text || ':' || v_day);
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_vet_visit on public.vet_visits;
create trigger tp_vet_visit after insert on public.vet_visits
for each row execute function public._tp_on_vet_visit();

create or replace function public._tp_on_weight()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mon text := to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM');
begin
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is not null then
    perform public._award_tutor_points(v_owner, 'health:weight', 15, new.id,
      'health:weight:' || new.pet_id::text || ':' || v_mon);  -- 1x por pet por mês BRT
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_weight on public.weight_records;
create trigger tp_weight after insert on public.weight_records
for each row execute function public._tp_on_weight();

create or replace function public._tp_on_parasite()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mon text := to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM');
begin
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is not null then
    perform public._award_tutor_points(v_owner, 'health:parasite', 20, new.id,
      'health:parasite:' || new.pet_id::text || ':' || v_mon);  -- 1x por pet por mês BRT
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_parasite on public.parasite_treatments;
create trigger tp_parasite after insert on public.parasite_treatments
for each row execute function public._tp_on_parasite();

-- ---------- Trigger de SOCIAL (post próprio, não-repost, 1x/dia) ----------
create or replace function public._tp_on_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_day text := to_char((now() at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD');
begin
  if new.reposted_from is not null then return new; end if;  -- repost não pontua
  select owner_id into v_owner from public.pets where id = new.pet_id;
  if v_owner is not null then
    perform public._award_tutor_points(v_owner, 'social:post', 5, new.id,
      'social:post:' || v_owner::text || ':' || v_day);
  end if;
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_post on public.posts;
create trigger tp_post after insert on public.posts
for each row execute function public._tp_on_post();

-- ---------- Trigger de MISSÃO (espelha a completion no ledger) ----------
create or replace function public._tp_on_mission_completion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._award_tutor_points(new.user_id, 'mission', new.points, new.id,
    'mission:' || new.user_id::text || ':' || new.completion_date::text);
  return new;
exception when others then return new;
end;
$$;
drop trigger if exists tp_mission on public.daily_mission_completions;
create trigger tp_mission after insert on public.daily_mission_completions
for each row execute function public._tp_on_mission_completion();

-- ---------- Backfill das missões JÁ cumpridas (legítimas, dadas e capadas) ----------
-- Saúde antiga NÃO é backfillada de propósito (anti-farm de histórico).
insert into public.tutor_points (user_id, source, points, ref_id, dedup_key, created_at)
select c.user_id, 'mission', c.points, c.id,
       'mission:' || c.user_id::text || ':' || c.completion_date::text, c.created_at
from public.daily_mission_completions c
on conflict (dedup_key) do nothing;

-- ---------- Total VITALÍCIO de PT (alimenta o Nível de Tutor) ----------
create or replace function public.my_tutor_points()
returns int language sql security definer set search_path = public stable as $$
  select coalesce(sum(points), 0)::int from public.tutor_points where user_id = auth.uid();
$$;
grant execute on function public.my_tutor_points() to authenticated;

-- =============================================================================
-- Ranking MENSAL agora lê o LEDGER (ponderado) — não mais só missão.
-- =============================================================================
create or replace function public.mission_monthly_leaderboard(p_limit int default 50)
returns table (
  user_id uuid, display_name text, tutor_avatar text,
  points int, completions int, rank_position int
) language sql security definer set search_path = public stable as $$
  with mp as (
    select tp.user_id,
           round(sum(tp.points * public._tp_weight(tp.source)))::int as points,
           count(*) filter (where tp.source = 'mission')::int as completions
    from public.tutor_points tp
    where tp.created_at >= (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo')
    group by tp.user_id
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

create or replace function public.mission_my_monthly()
returns table (rank int, points int, total_tutors int)
language sql security definer set search_path = public stable as $$
  with mp as (
    select tp.user_id, round(sum(tp.points * public._tp_weight(tp.source)))::int as points
    from public.tutor_points tp
    where tp.created_at >= (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo')
    group by tp.user_id
  ),
  ranked as (
    select mp.user_id, mp.points, row_number() over (order by mp.points desc, mp.user_id asc) as rnk
    from mp
  )
  select r.rnk::int, r.points, (select count(*)::int from ranked)
  from ranked r where r.user_id = auth.uid();
$$;
grant execute on function public.mission_my_monthly() to authenticated;

-- =============================================================================
-- Premiação mensal: campeão = maior PT PONDERADO do mês anterior (lê o ledger),
-- COM GATE ANTI-SYBIL na elegibilidade (o prêmio vale 1 mês de Pro de verdade).
-- Itera candidatos por PT desc e premia o 1o ELEGIVEL (nao o topo cego). NUNCA
-- bloqueia nenhuma acao do app — so escolhe pra quem o premio vai.
-- =============================================================================
-- coluna de auditoria do resultado (porque um mes ficou sem campeao)
alter table public.mission_monthly_winners add column if not exists note text;

create or replace function public.award_mission_monthly_winner()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_m_start timestamptz := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month') at time zone 'America/Sao_Paulo';
  v_m_end   timestamptz := (date_trunc('month', (now() at time zone 'America/Sao_Paulo'))) at time zone 'America/Sao_Paulo';
  v_month_start date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) - interval '1 month')::date;
  v_winner uuid;
  v_points int;
  v_mozart uuid := 'd0c0ffee-0000-4000-8000-00000000cafe';
  v_conv uuid;
  -- gate anti-Sybil (constantes tunaveis; ver [[security_referral_hole]])
  c_min_account_age constant interval := interval '14 days';  -- conta nao recem-criada so pra ganhar
  c_min_active_days constant int := 8;   -- PT em >= N dias DISTINTOS do mes (presenca distribuida)
  c_min_engagers    constant int := 3;   -- >= K OUTROS users distintos curtiram/comentaram (Sybil de 1 conta nao forja)
  r record;
  v_checked int := 0;
  v_active_days int;
  v_engagers int;
begin
  if exists (select 1 from public.mission_monthly_winners where month_start = v_month_start) then
    return;
  end if;

  -- Candidatos por PT ponderado desc; premia o 1o que passar nos 3 criterios.
  for r in
    select tp.user_id as uid, round(sum(tp.points * public._tp_weight(tp.source)))::int as pts
    from public.tutor_points tp
    where tp.created_at >= v_m_start and tp.created_at < v_m_end
    group by tp.user_id
    having round(sum(tp.points * public._tp_weight(tp.source))) > 0
    order by round(sum(tp.points * public._tp_weight(tp.source))) desc, count(*) desc, tp.user_id asc
    limit 50
  loop
    v_checked := v_checked + 1;

    -- (1) idade minima da conta
    if not exists (
      select 1 from public.profiles pr
      where pr.id = r.uid and pr.created_at <= now() - c_min_account_age
    ) then continue; end if;

    -- (2) atividade DISTRIBUIDA: PT em >= N dias distintos do mes (BRT)
    select count(distinct (tp.created_at at time zone 'America/Sao_Paulo')::date)
    into v_active_days
    from public.tutor_points tp
    where tp.user_id = r.uid and tp.created_at >= v_m_start and tp.created_at < v_m_end;
    if v_active_days < c_min_active_days then continue; end if;

    -- (3) engajamento de OUTROS users reais nos posts do candidato no mes
    select count(distinct other_uid) into v_engagers from (
      select p2.owner_id as other_uid
      from public.likes l
      join public.posts po on po.id = l.post_id
      join public.pets pw on pw.id = po.pet_id and pw.owner_id = r.uid
      join public.pets p2 on p2.id = l.pet_id
      where l.created_at >= v_m_start and l.created_at < v_m_end and p2.owner_id <> r.uid
      union
      select p2.owner_id
      from public.comments cm
      join public.posts po on po.id = cm.post_id
      join public.pets pw on pw.id = po.pet_id and pw.owner_id = r.uid
      join public.pets p2 on p2.id = cm.pet_id
      where cm.created_at >= v_m_start and cm.created_at < v_m_end and p2.owner_id <> r.uid
    ) e;
    if v_engagers < c_min_engagers then continue; end if;

    -- passou nos 3: e o campeao
    v_winner := r.uid;
    v_points := r.pts;
    exit;
  end loop;

  if v_winner is null then
    insert into public.mission_monthly_winners (month_start, user_id, points, note)
    values (v_month_start, null, 0,
      case when v_checked = 0 then 'ninguem pontuou'
           else 'sem candidato elegivel: '||v_checked||' checados barrados pelo gate anti-Sybil (Pedro pode premiar manual no admin se for legitimo)' end)
    on conflict (month_start) do nothing;
    return;
  end if;

  -- Concede 1 mês de Pro (upsert direto; trigger sincroniza profiles.is_pro).
  update public.subscriptions
  set status = 'active', plan = 'monthly', current_period_start = now(),
      current_period_end = now() + interval '30 days', cancel_at_period_end = false,
      granted_by_admin = true, granted_by_admin_email = 'sistema:campeao-pt-mensal',
      granted_at = now(), updated_at = now()
  where user_id = v_winner;
  if not found then
    insert into public.subscriptions
      (user_id, status, plan, current_period_start, current_period_end, granted_by_admin, granted_by_admin_email, granted_at)
    values
      (v_winner, 'active', 'monthly', now(), now() + interval '30 days', true, 'sistema:campeao-pt-mensal', now());
  end if;

  insert into public.mission_monthly_winners (month_start, user_id, points, note)
  values (v_month_start, v_winner, v_points, 'ok') on conflict (month_start) do nothing;

  insert into public.notifications (user_id, kind, title, body, url, created_at)
  values (v_winner, 'broadcast', 'Você é o campeão do mês! 🏆',
    'você fez mais Pontos de Tutor este mês e ganhou 1 mês de Pet Pro! aproveita 🎉', '/pro', now());

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
    'au au! voce foi o tutor com mais Pontos de Tutor do mes e ganhou 1 mes de Pet Pro de presente! to muito feliz por voce. bora manter o ritmo! 🏆🐾');
end;
$$;
