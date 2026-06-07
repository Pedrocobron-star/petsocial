-- Placar geral combinado do Cassino Pet.
-- Pontuacao geral de um tutor = soma do MELHOR score efetivo de cada jogo.
-- Score efetivo = score * multiplicador da dificuldade (Facil 1.0, Medio 1.5,
-- Dificil 2.0), exatamente a mesma regra do game_leaderboard por jogo. Isso
-- premia quem manda bem nos tres jogos, nao so em um.
--
-- ASCII-safe (clipboard do PowerShell corrompe acentos). Tudo create or replace
-- (nao-destrutivo) -> nao dispara o dialog "Potential issue detected".

create or replace function public.game_global_leaderboard(p_limit int default 30)
returns table (
  user_id uuid,
  display_name text,
  tutor_avatar text,
  total_score int,
  games_played int
) language sql security definer set search_path = public stable as $$
  with eff as (
    select gs.user_id, gs.game,
           max(gs.score * case coalesce(gs.difficulty, 2)
                            when 1 then 1.0 when 3 then 2.0 else 1.5 end) as best_eff
    from public.game_scores gs
    group by gs.user_id, gs.game
  ),
  agg as (
    select user_id,
           sum(best_eff) as total_eff,
           count(*)::int as games_played
    from eff
    group by user_id
  )
  select a.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
         pr.avatar_url as tutor_avatar,
         round(a.total_eff)::int as total_score,
         a.games_played
  from agg a
  left join public.profiles pr on pr.id = a.user_id
  order by a.total_eff desc, a.games_played desc, a.user_id asc
  limit p_limit;
$$;
grant execute on function public.game_global_leaderboard(int) to authenticated, anon;

-- Posicao do tutor logado no placar geral.
create or replace function public.game_global_my_rank()
returns table (rank bigint, total_score int, total bigint)
language sql security definer set search_path = public stable as $$
  with eff as (
    select gs.user_id, gs.game,
           max(gs.score * case coalesce(gs.difficulty, 2)
                            when 1 then 1.0 when 3 then 2.0 else 1.5 end) as best_eff
    from public.game_scores gs
    group by gs.user_id, gs.game
  ),
  agg as (
    select user_id, sum(best_eff) as total_eff
    from eff
    group by user_id
  ),
  ranked as (
    select user_id,
           round(total_eff)::int as total_score,
           row_number() over (order by total_eff desc, user_id asc) as rnk
    from agg
  )
  select r.rnk, r.total_score, (select count(*) from ranked) as total
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function public.game_global_my_rank() to authenticated;
