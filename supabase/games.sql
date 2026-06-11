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

-- ⚠️ game_leaderboard: DEFINICAO CANONICA em supabase/games-difficulty.sql (v3,
-- assinatura (text,int,text) com period + tutor_avatar + difficulty + ranking
-- por score efetivo). NAO redefinir aqui — esta versao antiga (text,int) tem
-- assinatura DIFERENTE, entao reaplicar cria uma SOBRECARGA que deixa a chamada
-- do PostgREST ambigua e quebra o frontend (lib/games.ts le entry.difficulty).
-- Este arquivo continua sendo a fonte da TABELA game_scores + indices + RLS acima.
