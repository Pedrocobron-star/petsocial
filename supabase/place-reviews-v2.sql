-- ============================================================================
-- PLACE_REVIEWS v2 — avaliações estilo Google Maps: fotos + notas por categoria
--
-- Adiciona à place_reviews:
--  - photo_urls text[]  → fotos que o usuário sobe NA avaliação (bucket público
--    'posts', path <uid>/... pra respeitar a RLS de storage existente)
--  - 4 sub-notas opcionais (1..5): atendimento, custo-benefício, limpeza,
--    pet-friendly. Todas NULLABLE (a nota geral `rating` continua obrigatória).
--
-- A média geral (view place_stats) usa só `rating` → NÃO é afetada. As médias
-- por categoria são calculadas no client a partir das reviews.
--
-- Idempotente. Aplicar depois de schema.sql.
-- ============================================================================

alter table public.place_reviews
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists rating_service smallint check (rating_service between 1 and 5),
  add column if not exists rating_price smallint check (rating_price between 1 and 5),
  add column if not exists rating_cleanliness smallint check (rating_cleanliness between 1 and 5),
  add column if not exists rating_petfriendly smallint check (rating_petfriendly between 1 and 5);
