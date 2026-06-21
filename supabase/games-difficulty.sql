-- ============================================================================
-- JOGOS v3 -- DIFICULDADE (tiers 1/2/3) + multiplicador no ranking + grau maximo
-- Idempotente. Coluna difficulty nullable: scores legados (NULL) contam como
-- Medio (2) no calculo. Multiplicador aplicado SO no RPC (recalibravel sem
-- migrar dados). Script ASCII-only (seguro pra colar via clipboard).
-- ============================================================================

-- 1) coluna de dificuldade (1=Facil, 2=Medio, 3=Dificil; NULL = score legado)
alter table public.game_scores
  add column if not exists difficulty smallint check (difficulty in (1, 2, 3));

-- 2) CHECK de game (inclui 'caminho' e 'runner'; runner tambem liberado em games-runner.sql)
alter table public.game_scores drop constraint if exists game_scores_game_check;
alter table public.game_scores add constraint game_scores_game_check
  check (game in ('treats', 'quiz', 'caminho', 'runner'));

create index if not exists game_scores_game_diff_idx
  on public.game_scores(game, difficulty, score desc);

-- 3) leaderboard: ordena por score EFETIVO = score * mult(dificuldade).
--    mult: Facil 1.0, Medio 1.5, Dificil 2.0; legado (NULL) conta como Medio.
drop function if exists public.game_leaderboard(text, int);
drop function if exists public.game_leaderboard(text, int, text);
create or replace function public.game_leaderboard(
  p_game text,
  p_limit int default 20,
  p_period text default 'all'
)
returns table (
  user_id uuid,
  display_name text,
  tutor_avatar text,
  pet_id uuid,
  pet_name text,
  pet_avatar text,
  score int,
  difficulty smallint,
  achieved_at timestamptz
) language sql security definer set search_path = public as $$
  with filtered as (
    select gs.user_id, gs.pet_id, gs.score, gs.difficulty, gs.created_at,
           gs.score * case coalesce(gs.difficulty, 2)
                        when 1 then 1.0 when 3 then 2.0 else 1.5 end as eff
    from public.game_scores gs
    where gs.game = p_game
      and (p_period <> 'week' or (gs.created_at at time zone 'America/Sao_Paulo') >= date_trunc('week', (now() at time zone 'America/Sao_Paulo')))
  ),
  best as (
    select distinct on (f.user_id)
      f.user_id, f.pet_id, f.score, f.difficulty, f.created_at, f.eff
    from filtered f
    order by f.user_id, f.eff desc, f.created_at asc
  )
  select b.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
         pr.avatar_url as tutor_avatar,
         b.pet_id,
         p.name as pet_name,
         p.avatar_url as pet_avatar,
         b.score,
         b.difficulty,
         b.created_at as achieved_at
  from best b
  left join public.profiles pr on pr.id = b.user_id
  left join public.pets p on p.id = b.pet_id
  order by b.eff desc, b.created_at asc
  limit p_limit;
$$;
grant execute on function public.game_leaderboard(text, int, text) to authenticated, anon;

-- 4) "sua posicao": rank por score efetivo (mesma regra do leaderboard)
create or replace function public.game_my_rank(p_game text, p_period text default 'all')
returns table (rank bigint, score int, total bigint)
language sql security definer set search_path = public as $$
  with filtered as (
    select gs.user_id, gs.score, gs.created_at,
           gs.score * case coalesce(gs.difficulty, 2)
                        when 1 then 1.0 when 3 then 2.0 else 1.5 end as eff
    from public.game_scores gs
    where gs.game = p_game
      and (p_period <> 'week' or (gs.created_at at time zone 'America/Sao_Paulo') >= date_trunc('week', (now() at time zone 'America/Sao_Paulo')))
  ),
  best as (
    select distinct on (user_id) user_id, score, created_at, eff
    from filtered
    order by user_id, eff desc, created_at asc
  ),
  ranked as (
    select user_id, score, row_number() over (order by eff desc, created_at asc) as rnk
    from best
  )
  select r.rnk as rank, r.score, (select count(*) from best) as total
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function public.game_my_rank(text, text) to authenticated;

-- 5) grau maximo alcancado pelo tutor num jogo (trofeu de progressao)
create or replace function public.game_max_difficulty(p_game text)
returns smallint language sql security definer set search_path = public as $$
  select max(coalesce(difficulty, 2))::smallint from public.game_scores
  where game = p_game and user_id = auth.uid();
$$;
grant execute on function public.game_max_difficulty(text) to authenticated;

notify pgrst, 'reload schema';
