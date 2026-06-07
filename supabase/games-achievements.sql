-- ============================================================================
-- Stats de jogo do tutor (pras conquistas do Cassino Pet). Idempotente.
-- distinct_games = quantos jogos diferentes ele jogou; max_difficulty = maior
-- grau pontuado (legado conta como Medio/2; 0 se nunca jogou).
-- ============================================================================
create or replace function public.game_player_stats()
returns table (distinct_games int, max_difficulty smallint)
language sql security definer set search_path = public as $$
  select
    count(distinct game)::int as distinct_games,
    coalesce(max(coalesce(difficulty, 2)), 0)::smallint as max_difficulty
  from public.game_scores
  where user_id = auth.uid();
$$;
grant execute on function public.game_player_stats() to authenticated;

notify pgrst, 'reload schema';
