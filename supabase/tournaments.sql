-- ============================================================================
-- Torneios de Cassino + anti-cheat no game_scores
--
-- Torneio = 1 jogo, janela temporizada, dificuldade minima. O placar e
-- COMPUTADO das pontuacoes que ja entram em game_scores durante a janela —
-- ou seja, o jogador so precisa jogar o jogo no periodo (zero submit novo).
-- Distinto das ligas (semanal, todos os jogos): aqui e evento de 1 jogo com
-- podio + badge. Cron horario finaliza torneios encerrados e dispara push.
--
-- Emoji via chr() pro paste. Resto ASCII.
-- ============================================================================

-- ---- ANTI-CHEAT: protege game_scores (ligas, global, daily e torneio) ------
create or replace function public.game_scores_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_recent int;
begin
  -- teto fisico por jogo (generoso: bloqueia 999999, nao barra jogo legitimo)
  v_max := case new.game when 'treats' then 600 when 'quiz' then 300 when 'caminho' then 300 else 1000 end;
  if new.score < 0 or new.score > v_max then
    raise exception 'pontuacao invalida' using errcode = '22023';
  end if;
  -- anti-spam: no minimo 10s entre submits do mesmo user no mesmo jogo
  -- (qualquer partida legitima dura bem mais que isso)
  select count(*) into v_recent from public.game_scores
    where user_id = new.user_id and game = new.game and created_at > now() - interval '10 seconds';
  if v_recent > 0 then
    raise exception 'aguarde alguns segundos antes de enviar outra pontuacao' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists game_scores_guard_trg on public.game_scores;
create trigger game_scores_guard_trg
  before insert on public.game_scores
  for each row execute function public.game_scores_guard();

-- ---- TABELAS ---------------------------------------------------------------
create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  game text not null check (game in ('treats', 'quiz', 'caminho')),
  min_difficulty smallint not null default 2,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  finalized_at timestamptz,
  start_notified_at timestamptz,
  ending_notified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.tournaments enable row level security;
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to authenticated, anon using (true);

create table if not exists public.tournament_winners (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rank int not null,
  score numeric not null,
  awarded_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);
alter table public.tournament_winners enable row level security;
drop policy if exists tournament_winners_read on public.tournament_winners;
create policy tournament_winners_read on public.tournament_winners for select to authenticated, anon using (true);

-- ---- RPCs (placar computado de game_scores) --------------------------------
-- effective score = score * mult (1.0 / 1.5 / 2.0)

create or replace function public.active_tournament()
returns public.tournaments language sql stable security definer set search_path = public as $$
  select * from public.tournaments
  where starts_at <= now() and ends_at > now()
  order by ends_at asc limit 1;
$$;
grant execute on function public.active_tournament() to authenticated, anon;

create or replace function public.tournament_leaderboard(p_tournament_id uuid, p_limit int default 20)
returns table(user_id uuid, display_name text, tutor_avatar text, score numeric, plays int)
language sql stable security definer set search_path = public as $$
  select gs.user_id, p.display_name, p.avatar_url as tutor_avatar,
         max(gs.score * case coalesce(gs.difficulty, 2) when 1 then 1.0 when 3 then 2.0 else 1.5 end) as score,
         count(*)::int as plays
  from public.game_scores gs
  join public.tournaments t on t.id = p_tournament_id
    and gs.game = t.game
    and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
    and coalesce(gs.difficulty, 2) >= t.min_difficulty
  join public.profiles p on p.id = gs.user_id
  group by gs.user_id, p.display_name, p.avatar_url
  order by score desc
  limit p_limit;
$$;
grant execute on function public.tournament_leaderboard(uuid, int) to authenticated, anon;

create or replace function public.my_tournament_rank(p_tournament_id uuid)
returns table(rank int, score numeric)
language sql stable security definer set search_path = public as $$
  with lb as (
    select gs.user_id,
           max(gs.score * case coalesce(gs.difficulty, 2) when 1 then 1.0 when 3 then 2.0 else 1.5 end) as score
    from public.game_scores gs
    join public.tournaments t on t.id = p_tournament_id
      and gs.game = t.game
      and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
      and coalesce(gs.difficulty, 2) >= t.min_difficulty
    group by gs.user_id
  ), ranked as (
    select user_id, score, row_number() over (order by score desc) as rnk from lb
  )
  select rnk::int, score from ranked where user_id = auth.uid();
$$;
grant execute on function public.my_tournament_rank(uuid) to authenticated;

-- lista campeoes de um torneio (pra exibir o podio final)
create or replace function public.tournament_podium(p_tournament_id uuid)
returns table(rank int, user_id uuid, display_name text, tutor_avatar text, score numeric)
language sql stable security definer set search_path = public as $$
  select w.rank, w.user_id, p.display_name, p.avatar_url, w.score
  from public.tournament_winners w
  join public.profiles p on p.id = w.user_id
  where w.tournament_id = p_tournament_id
  order by w.rank asc;
$$;
grant execute on function public.tournament_podium(uuid) to authenticated, anon;

-- ---- LIFECYCLE (cron horario): finaliza + push -----------------------------
create or replace function public.tournament_lifecycle()
returns void language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
  v_uids uuid[];
begin
  -- 1) finaliza torneios encerrados -> top 10 vira tournament_winners + push
  for t in select * from public.tournaments where ends_at <= now() and finalized_at is null loop
    insert into public.tournament_winners(tournament_id, user_id, rank, score)
    select t.id, lb.user_id, row_number() over (order by lb.score desc), lb.score
    from (
      select gs.user_id,
             max(gs.score * case coalesce(gs.difficulty, 2) when 1 then 1.0 when 3 then 2.0 else 1.5 end) as score
      from public.game_scores gs
      where gs.game = t.game
        and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
        and coalesce(gs.difficulty, 2) >= t.min_difficulty
      group by gs.user_id
    ) lb
    order by lb.score desc
    limit 10
    on conflict do nothing;

    update public.tournaments set finalized_at = now() where id = t.id;

    select array_agg(user_id) into v_uids from public.tournament_winners where tournament_id = t.id;
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(127942) || ' Torneio encerrado!',
        'body', 'Veja onde voce ficou no podio de ' || t.title || '.',
        'url', '/games', 'tag', 'tournament-end'));
    end if;
  end loop;

  -- 2) torneios que comecaram (ultimas 2h, nao avisados) -> push geral
  for t in select * from public.tournaments
           where starts_at <= now() and starts_at > now() - interval '2 hours' and start_notified_at is null loop
    select array_agg(distinct user_id) into v_uids from public.push_subscriptions;
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(127942) || ' Novo torneio no Cassino!',
        'body', t.title || ' comecou. Jogue e dispute o podio!',
        'url', '/games', 'tag', 'tournament-start'));
    end if;
    update public.tournaments set start_notified_at = now() where id = t.id;
  end loop;

  -- 3) acabando em ~1h -> push pros participantes
  for t in select * from public.tournaments
           where ends_at > now() and ends_at <= now() + interval '1 hour' and ending_notified_at is null loop
    select array_agg(distinct gs.user_id) into v_uids
    from public.game_scores gs
    where gs.game = t.game
      and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
      and coalesce(gs.difficulty, 2) >= t.min_difficulty
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = gs.user_id);
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(9203) || ' Torneio acaba em 1h!',
        'body', 'Ultima chance de subir no podio de ' || t.title || '.',
        'url', '/games', 'tag', 'tournament-ending'));
    end if;
    update public.tournaments set ending_notified_at = now() where id = t.id;
  end loop;
end;
$$;

select cron.unschedule('petsocial-tournament-lifecycle')
where exists (select 1 from cron.job where jobname = 'petsocial-tournament-lifecycle');
select cron.schedule('petsocial-tournament-lifecycle', '7 * * * *', $$ select public.tournament_lifecycle(); $$);

-- ---- SEED: 1 torneio ativo agora (3 dias, Pega o Petisco, Medio+) ----------
insert into public.tournaments(title, game, min_difficulty, starts_at, ends_at)
select 'Torneio Pega o Petisco', 'treats', 2, now(), now() + interval '3 days'
where not exists (select 1 from public.tournaments where ends_at > now());
