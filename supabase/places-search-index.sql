-- ============================================================================
-- BUSCA DE LUGARES — índice trigram (pg_trgm)
--
-- A busca usa ilike '%termo%' em name/address. Com leading-wildcard, um índice
-- B-tree não serve; um GIN trigram acelera o ilike e deixa a busca instantânea
-- mesmo com a base crescendo (hoje ~4,6 mil lugares OSM). Idempotente.
-- ============================================================================

create extension if not exists pg_trgm;

create index if not exists places_name_trgm_idx on public.places using gin (name gin_trgm_ops);
create index if not exists places_address_trgm_idx on public.places using gin (address gin_trgm_ops);
