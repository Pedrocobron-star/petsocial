-- ============================================================================
-- DESAFIO DIARIO -- leaderboard do dia (jogo + dificuldade fixos pelo dia).
-- Mostra SO os scores de HOJE no fuso BR (America/Sao_Paulo) pra aquele
-- jogo + dificuldade exatos. Dificuldade e fixa no desafio, entao o ranking
-- usa o score BRUTO (sem multiplicador). Idempotente, ASCII-only (seguro pra
-- colar via clipboard).
-- ============================================================================

-- 1) leaderboard do desafio diario: melhor score por usuario HOJE (BR),
--    ordenado por score bruto desc, depois created_at asc (desempate: quem
--    fez o score primeiro fica na frente).
create or replace function public.game_daily_leaderboard(
  p_game text,
  p_difficulty smallint,
  p_limit int default 20
)
returns table (
  user_id uuid,
  display_name text,
  tutor_avatar text,
  pet_id uuid,
  pet_name text,
  score int,
  achieved_at timestamptz
) language sql security definer set search_path = public as $$
  with filtered as (
    select gs.user_id, gs.pet_id, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game = p_game
      and gs.difficulty = p_difficulty
      and (gs.created_at at time zone 'America/Sao_Paulo')::date
          = (now() at time zone 'America/Sao_Paulo')::date
  ),
  best as (
    select distinct on (f.user_id)
      f.user_id, f.pet_id, f.score, f.created_at
    from filtered f
    order by f.user_id, f.score desc, f.created_at asc
  )
  select b.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
         pr.avatar_url as tutor_avatar,
         b.pet_id,
         p.name as pet_name,
         b.score,
         b.created_at as achieved_at
  from best b
  left join public.profiles pr on pr.id = b.user_id
  left join public.pets p on p.id = b.pet_id
  order by b.score desc, b.created_at asc
  limit p_limit;
$$;
grant execute on function public.game_daily_leaderboard(text, smallint, int) to authenticated, anon;

-- 2) "seu resultado de hoje" no desafio diario: melhor score, rank, total e
--    se o tutor ja jogou hoje (played). Sempre retorna exatamente uma linha:
--    quem nao jogou recebe (null, null, total, false) via o union all.
create or replace function public.game_daily_my_result(
  p_game text,
  p_difficulty smallint
)
returns table (
  best_score int,
  rank bigint,
  total bigint,
  played boolean
) language sql security definer set search_path = public as $$
  with filtered as (
    select gs.user_id, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game = p_game
      and gs.difficulty = p_difficulty
      and (gs.created_at at time zone 'America/Sao_Paulo')::date
          = (now() at time zone 'America/Sao_Paulo')::date
  ),
  best as (
    select distinct on (user_id) user_id, score, created_at
    from filtered
    order by user_id, score desc, created_at asc
  ),
  ranked as (
    select user_id, score,
           row_number() over (order by score desc, created_at asc) as rnk
    from best
  )
  select r.score as best_score,
         r.rnk as rank,
         (select count(*) from best) as total,
         true as played
  from ranked r
  where r.user_id = auth.uid()
  union all
  select null::int, null::bigint, (select count(*) from best), false
  where not exists (select 1 from filtered where user_id = auth.uid());
$$;
grant execute on function public.game_daily_my_result(text, smallint) to authenticated;

notify pgrst, 'reload schema';
