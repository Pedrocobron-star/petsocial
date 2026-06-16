-- ============================================================================
-- NOTICIAS Onda A — 16 editorias + 12 tags (N:N) (2026-06-16)
-- ============================================================================
-- (1) Reorganiza as editorias pro conjunto pedido pelo Pedro (16). Upsert por
--     `slug` (ON CONFLICT DO UPDATE) -> preserva o category_id das materias ja
--     existentes (saude/comportamento/nutricao/adocao/produtos/curiosidades
--     continuam com o MESMO slug, so mudam nome/emoji/cor/ordem) e insere as
--     10 novas.
-- (2) Tags fixas por tema/animal: tabela news_tags + juncao N:N
--     news_article_tags. Leitura publica, escrita admin (is_admin()). RPC
--     admin_set_article_tags pra setar as tags de uma materia atomicamente.
-- Idempotente. Nomes/emoji em UTF-8 (aplicado via base64, nao clipboard).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) EDITORIAS (16) — upsert por slug
-- ----------------------------------------------------------------------------
insert into public.news_categories (slug, name, emoji, color, sort_order) values
  ('noticias',          'Notícias',                 '📰', '#2563EB', 1),
  ('saude',             'Saúde e Prevenção',        '🩺', '#0F766E', 2),
  ('nutricao',          'Nutrição',                 '🍖', '#EA580C', 3),
  ('comportamento',     'Comportamento',            '🐾', '#7C3AED', 4),
  ('educacao',          'Educação e Treinamento',   '🎓', '#4F46E5', 5),
  ('higiene',           'Higiene e Cuidados',       '🧼', '#0EA5E9', 6),
  ('filhotes',          'Filhotes',                 '🐶', '#F59E0B', 7),
  ('idosos',            'Pets Idosos',              '🦴', '#78716C', 8),
  ('adocao',            'Adoção e Causas',          '🏠', '#DC2626', 9),
  ('casa-pet',          'Casa Pet',                 '🏡', '#0D9488', 10),
  ('passeios',          'Passeios e Viagens',       '🧳', '#16A34A', 11),
  ('curiosidades',      'Curiosidades',             '✨', '#CA8A04', 12),
  ('mitos',             'Mitos e Verdades',         '🔍', '#9333EA', 13),
  ('racas',             'Raças e Perfis',           '🐕', '#B45309', 14),
  ('produtos',          'Tecnologia e Produtos',    '🛒', '#DB2777', 15),
  ('nao-convencionais', 'Pets Não Convencionais',   '🦜', '#059669', 16)
on conflict (slug) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  color = excluded.color,
  sort_order = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- 2) TAGS (12) + juncao N:N
-- ----------------------------------------------------------------------------
create table if not exists public.news_tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.news_article_tags (
  article_id uuid not null references public.news_articles(id) on delete cascade,
  tag_id uuid not null references public.news_tags(id) on delete cascade,
  primary key (article_id, tag_id)
);
create index if not exists news_article_tags_tag_idx on public.news_article_tags (tag_id);

-- RLS
alter table public.news_tags enable row level security;
alter table public.news_article_tags enable row level security;

-- tags: leitura publica (catalogo fixo, nao sensivel), escrita admin
drop policy if exists news_tags_read on public.news_tags;
create policy news_tags_read on public.news_tags for select using (true);
drop policy if exists news_tags_admin on public.news_tags;
create policy news_tags_admin on public.news_tags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- juncao: leitura publica (so vincula article_id<->tag_id, nada sensivel),
-- escrita admin. (a materia em si segue gated por news_articles_read.)
drop policy if exists news_article_tags_read on public.news_article_tags;
create policy news_article_tags_read on public.news_article_tags for select using (true);
drop policy if exists news_article_tags_admin on public.news_article_tags;
create policy news_article_tags_admin on public.news_article_tags for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- seed das 12 tags fixas
insert into public.news_tags (slug, name, sort_order) values
  ('cachorros',     'Cachorros',     1),
  ('gatos',         'Gatos',         2),
  ('filhotes',      'Filhotes',      3),
  ('idosos',        'Idosos',        4),
  ('adocao',        'Adoção',        5),
  ('alimentacao',   'Alimentação',   6),
  ('saude',         'Saúde',         7),
  ('comportamento', 'Comportamento', 8),
  ('apartamento',   'Apartamento',   9),
  ('viagem',        'Viagem',        10),
  ('calor',         'Calor',         11),
  ('frio',          'Frio',          12)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ----------------------------------------------------------------------------
-- 3) RPC admin: seta as tags de uma materia de forma atomica (delete + insert)
-- ----------------------------------------------------------------------------
create or replace function public.admin_set_article_tags(p_article_id uuid, p_tag_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  delete from public.news_article_tags where article_id = p_article_id;
  if array_length(p_tag_ids, 1) is not null then
    insert into public.news_article_tags (article_id, tag_id)
    select p_article_id, unnest(p_tag_ids)
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.admin_set_article_tags(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_article_tags(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba nova):
--   select count(*) from public.news_categories;                 -- 16
--   select slug, name, emoji from public.news_categories order by sort_order;
--   select count(*) from public.news_tags;                       -- 12
--   select proname from pg_proc where proname='admin_set_article_tags';
-- ============================================================================
