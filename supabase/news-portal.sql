-- ============================================================================
-- PORTAL DE NOTICIAS (Jornal Pet) -- CMS manual.
-- Categorias + materias. Leitura publica das materias publicadas; escrita so
-- pra admin (via is_admin(), mesma trava do resto do painel). Arquitetado pra
-- automacao por IA depois (campos status/published_at ja prontos).
-- ASCII-only no SQL executavel; nomes com acento via chr() (clipboard-safe).
-- ============================================================================

-- 1) categorias
create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  emoji text not null default chr(128240),  -- newspaper
  color text not null default '#EC4899',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2) materias
create table if not exists public.news_articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  category_id uuid references public.news_categories(id) on delete set null,
  title text not null,
  dek text,                              -- linha de apoio / subtitulo
  cover_url text,
  body text not null default '',         -- paragrafos separados por linha em branco
  author_name text not null default 'Redacao Maestro Pet',
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_featured boolean not null default false,
  affiliate_products jsonb not null default '[]'::jsonb,  -- [{label,url,store,price,image_url}]
  view_count int not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists news_articles_pub_idx on public.news_articles (status, published_at desc);
create index if not exists news_articles_cat_idx on public.news_articles (category_id, published_at desc);
create index if not exists news_articles_featured_idx on public.news_articles (is_featured, published_at desc);

-- 3) RLS
alter table public.news_categories enable row level security;
alter table public.news_articles enable row level security;

-- categorias: leitura publica (anon + auth), escrita admin
drop policy if exists news_categories_read on public.news_categories;
create policy news_categories_read on public.news_categories for select using (true);
drop policy if exists news_categories_admin on public.news_categories;
create policy news_categories_admin on public.news_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- materias: publico le so publicadas; admin tudo (inclui rascunho)
drop policy if exists news_articles_read on public.news_articles;
create policy news_articles_read on public.news_articles for select
  using (status = 'published');
drop policy if exists news_articles_admin on public.news_articles;
create policy news_articles_admin on public.news_articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 4) contador de views (publicado), seguro
create or replace function public.news_increment_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.news_articles set view_count = view_count + 1
  where id = p_id and status = 'published';
$$;
grant execute on function public.news_increment_view(uuid) to authenticated, anon;

-- 5) seed das categorias (nomes com acento via chr(): chr(231)=c-cedilha,
--    chr(227)=a-til, chr(250)=u-agudo)
insert into public.news_categories (slug, name, emoji, color, sort_order) values
  ('saude',        'Sa' || chr(250) || 'de & Bem-estar',         chr(129658),                '#0F766E', 1),
  ('comportamento','Comportamento',                              chr(128062),                '#7C3AED', 2),
  ('nutricao',     'Nutri' || chr(231) || chr(227) || 'o',       chr(127830),                '#EA580C', 3),
  ('adocao',       'Ado' || chr(231) || chr(227) || 'o & Causas',chr(127968),                '#DC2626', 4),
  ('produtos',     'Produtos & Reviews',                         chr(128717) || chr(65039),  '#DB2777', 5),
  ('curiosidades', 'Curiosidades',                               chr(10024),                 '#CA8A04', 6)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
