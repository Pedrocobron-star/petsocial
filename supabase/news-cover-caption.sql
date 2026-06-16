-- ============================================================================
-- NOTICIAS Onda B — legenda da capa (2026-06-16)
-- ============================================================================
-- Imagens no MEIO do corpo + suas legendas vivem no proprio `body` via sintaxe
-- markdown ![legenda](url) (parseada no client) — nao precisam de coluna. So a
-- legenda da CAPA precisa de uma coluna propria.
-- Idempotente.
-- ============================================================================

alter table public.news_articles
  add column if not exists cover_caption text;

notify pgrst, 'reload schema';

-- READ-BACK:
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='news_articles' and column_name='cover_caption'; -- 1 row
