-- ============================================================================
-- JOGOS · placares + ranking público ("Las Vegas dos pets")
-- Rode UMA vez no Supabase SQL Editor. Idempotente.
-- ============================================================================
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  game text not null check (game in ('treats', 'quiz')),
  score int not null check (score >= 0),
  created_at timestamptz not null default now()
);
create index if not exists game_scores_game_score_idx on public.game_scores(game, score desc);
create index if not exists game_scores_user_idx on public.game_scores(user_id);

alter table public.game_scores enable row level security;
drop policy if exists "game_scores read all" on public.game_scores;
create policy "game_scores read all" on public.game_scores for select using (true);
drop policy if exists "game_scores insert own" on public.game_scores;
create policy "game_scores insert own" on public.game_scores
  for insert with check (auth.uid() = user_id);

-- Ranking público: melhor score por usuário, com nome do tutor + pet.
create or replace function public.game_leaderboard(p_game text, p_limit int default 20)
returns table (
  user_id uuid,
  display_name text,
  pet_id uuid,
  pet_name text,
  pet_avatar text,
  score int,
  achieved_at timestamptz
) language sql security definer set search_path = public as $$
  with best as (
    select distinct on (gs.user_id) gs.user_id, gs.pet_id, gs.score, gs.created_at
    from public.game_scores gs
    where gs.game = p_game
    order by gs.user_id, gs.score desc, gs.created_at asc
  )
  select b.user_id,
         coalesce(pr.display_name, 'Tutor') as display_name,
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
grant execute on function public.game_leaderboard(text, int) to authenticated, anon;
