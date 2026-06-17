-- ============================================================================
-- Maestro Pet — Salvar / Ler depois (bookmark de MATÉRIA)
--
-- Item 3 do jornal: o usuário salva uma matéria pra ler depois e vê tudo numa
-- lista "Salvas". Espelha exatamente o padrão de `saved_posts` (RLS dono-only).
--
-- Idempotente.
-- ============================================================================

create table if not exists public.saved_articles (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.news_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
create index if not exists saved_articles_user_idx on public.saved_articles(user_id, created_at desc);

alter table public.saved_articles enable row level security;

drop policy if exists "saved_articles read own" on public.saved_articles;
create policy "saved_articles read own" on public.saved_articles
  for select using (auth.uid() = user_id);

drop policy if exists "saved_articles insert own" on public.saved_articles;
create policy "saved_articles insert own" on public.saved_articles
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_articles delete own" on public.saved_articles;
create policy "saved_articles delete own" on public.saved_articles
  for delete using (auth.uid() = user_id);
