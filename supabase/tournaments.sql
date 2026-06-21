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
  -- Teto fisico por jogo. So existe pra bloquear tampering grosseiro (999999);
  -- NAO e anti-cheat de verdade (jogo casual client-side). Tem que ficar ACIMA
  -- do maximo legitimo: caminho 5 fases x150=750; treats combo 30s pode passar
  -- de 1000; quiz max ~216. Os tetos antigos (600/300/300) REJEITAVAM run bom e
  -- o erro era engolido no client -> score sumia sem aviso.
  v_max := case new.game when 'treats' then 5000 when 'quiz' then 800 when 'caminho' then 1500 else 10000 end;
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
  game text not null check (game in ('treats', 'quiz', 'caminho', 'runner')),
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

-- ---- LIFECYCLE (cron): finaliza + push --------------------------------------
-- ⚠️ public.tournament_lifecycle() e definida de forma CANONICA em push-harden.sql
-- (versao que injeta o header x-petsocial-secret exigido pela edge endurecida).
-- NAO redefinir aqui: reaplicar este arquivo reverteria o segredo e quebraria o
-- push de torneio (edge responde 401). Ver supabase/push-harden.sql.
-- (O cron canonico hoje e petsocial-tournaments */15 — ver push-harden.sql.
-- O schedule 'petsocial-tournament-lifecycle' abaixo e legado; mantido por
-- compatibilidade mas a funcao que ele chama vem de push-harden.sql.)

select cron.unschedule('petsocial-tournament-lifecycle')
where exists (select 1 from cron.job where jobname = 'petsocial-tournament-lifecycle');
select cron.schedule('petsocial-tournament-lifecycle', '7 * * * *', $$ select public.tournament_lifecycle(); $$);

-- ---- SEED: 1 torneio ativo agora (3 dias, Cesta do Mozart, Medio+) ----------
-- REPLAY-SAFE / anti-duplicata: o `where not exists (... ends_at > now())` cobre
-- torneio ATIVO e FUTURO, entao reaplicar este arquivo enquanto ja existe um
-- torneio no ar e no-op (nao cria duplicata). So cria de novo quando NAO ha
-- nenhum torneio vigente — que e o comportamento desejado (manter sempre 1).
insert into public.tournaments(title, game, min_difficulty, starts_at, ends_at)
select 'Torneio Cesta do Mozart', 'treats', 2, now(), now() + interval '3 days'
where not exists (select 1 from public.tournaments where ends_at > now());
