-- ============================================================================
-- LIGAS SEMANAIS -- pontos efetivos da SEMANA atual (fuso BR, comeca segunda).
-- points = soma de score * multiplicador de dificuldade (Facil 1.0, Medio 1.5,
-- Dificil 2.0) dos scores desta semana, por tutor. Reseta sozinho toda segunda
-- (filtro pela semana corrente). Idempotente, ASCII-only.
-- ============================================================================

create or replace function public.game_weekly_rank()
returns table (points int, rank bigint, total bigint)
language sql security definer set search_path = public stable as $$
  with wk as (
    select gs.user_id,
           sum(gs.score * case coalesce(gs.difficulty, 2)
                            when 1 then 1.0 when 3 then 2.0 else 1.5 end) as pts
    from public.game_scores gs
    where (gs.created_at at time zone 'America/Sao_Paulo')
          >= date_trunc('week', (now() at time zone 'America/Sao_Paulo'))
    group by gs.user_id
  ),
  ranked as (
    select user_id, round(pts)::int as pts,
           row_number() over (order by pts desc, user_id asc) as rnk
    from wk
  )
  select r.pts, r.rnk, (select count(*) from ranked) as total
  from ranked r
  where r.user_id = auth.uid();
$$;
grant execute on function public.game_weekly_rank() to authenticated;

-- placar da liga da semana (top N por pontos efetivos da semana, com tutor)
create or replace function public.game_weekly_leaderboard(p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  tutor_avatar text,
  points int
) language sql security definer set search_path = public stable as $$
  with wk as (
    select gs.user_id,
           sum(gs.score * case coalesce(gs.difficulty, 2)
                            when 1 then 1.0 when 3 then 2.0 else 1.5 end) as pts
    from public.game_scores gs
    where (gs.created_at at time zone 'America/Sao_Paulo')
          >= date_trunc('week', (now() at time zone 'America/Sao_Paulo'))
    group by gs.user_id
  )
  select w.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
         pr.avatar_url as tutor_avatar,
         round(w.pts)::int as points
  from wk w
  left join public.profiles pr on pr.id = w.user_id
  order by w.pts desc, w.user_id asc
  limit p_limit;
$$;
grant execute on function public.game_weekly_leaderboard(int) to authenticated, anon;

notify pgrst, 'reload schema';
