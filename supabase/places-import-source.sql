-- ============================================================================
-- PLACES: origem + osm_id — pra importar lugares reais do OpenStreetMap (ODbL)
--
-- `source`  : 'user' (cadastrado por um tutor) | 'osm' (importado do OpenStreetMap)
-- `osm_id`  : "<type>/<id>" do OSM (ex.: "node/1603479311"); UNIQUE pra o import
--             ser idempotente (ON CONFLICT (osm_id) DO NOTHING). NULL pros 'user'
--             (no Postgres, UNIQUE permite múltiplos NULL → não atrapalha).
--
-- Atribuição: dados © OpenStreetMap contributors, sob ODbL. O mapa já mostra o
-- crédito do OSM. Idempotente. Aplicar depois de schema.sql.
-- ============================================================================

alter table public.places
  add column if not exists source text not null default 'user',
  add column if not exists osm_id text;

create unique index if not exists places_osm_id_key on public.places(osm_id);
