-- ============================================================================
-- JOGOS v2 — ranking SEMANAL + "sua posição #N" (instiga a jogar)
-- Idempotente. Rodar no SQL Editor.
-- ============================================================================

-- Ranking com período: 'all' (geral) ou 'week' (semana corrente, date_trunc).
-- Dropa a versão antiga (2 args) pra recriar com p_period (default 'all',
-- então a chamada antiga de 2 args continua funcionando).
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
  achieved_at timestamptz
) language sql security definer set search_path = public as $$
  with filtered as (
    select gs.user_id, gs.pet_id, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game = p_game
      and (p_period <> 'week' or gs.created_at >= date_trunc('week', now()))
  ),
  best as (
    select distinct on (f.user_id) f.user_id, f.pet_id, f.score, f.created_at
    from filtered f
    order by f.user_id, f.score desc, f.created_at asc
  )
  select b.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
         pr.avatar_url as tutor_avatar,
         b.pet_id,
         p.name as pet_name,
         p.avatar_url as pet_avatar,
         b.score,
         b.created_at as achieved_at
  from best b
  left join public.profiles pr on pr.id = b.user_id
  left join public.pets p on p.id = b.pet_id
  order by b.score desc, b.created_at asc
  limit p_limit;
$$;
grant execute on function public.game_leaderboard(text, int, text) to authenticated, anon;

-- Posição do usuário ATUAL (mesmo fora do top): rank + melhor score + total de jogadores.
create or replace function public.game_my_rank(p_game text, p_period text default 'all')
returns table (rank bigint, score int, total bigint)
language sql security definer set search_path = public as $$
  with best as (
    select distinct on (gs.user_id) gs.user_id, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game = p_game
      and (p_period <> 'week' or gs.created_at >= date_trunc('week', now()))
    order by gs.user_id, gs.score desc, gs.created_at asc
  ),
  ranked as (
    select user_id, score, row_number() over (order by score desc, created_at asc) as rnk
    from best
  )
  select r.rnk as rank, r.score, (select count(*) from best) as total
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function public.game_my_rank(text, text) to authenticated;

notify pgrst, 'reload schema';
