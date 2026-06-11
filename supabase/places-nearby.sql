-- ============================================================================
-- PLACES_NEARBY — busca "mais perto primeiro" no servidor
--
-- Com milhares de lugares (import do OSM), ordenar/limitar no client esconde
-- quase tudo. Esta função ordena por distância NO BANCO e devolve só os N mais
-- próximos da posição do usuário (já com avg_rating/review_count da view
-- place_stats). Distância = euclidiana em graus com a longitude ponderada por
-- cos(lat) — barata e correta pra RANQUEAR numa região (não precisa de PostGIS).
--
-- SECURITY INVOKER (places tem SELECT público), read-only. Idempotente.
-- ============================================================================

create or replace function public.places_nearby(
  p_lat double precision,
  p_lng double precision,
  p_kind text default null,
  p_search text default null,
  p_limit int default 200
)
returns table (
  id uuid,
  name text,
  kind text,
  species text,
  description text,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  hours text,
  photo_url text,
  added_by_user_id uuid,
  verified boolean,
  created_at timestamptz,
  updated_at timestamptz,
  source text,
  osm_id text,
  avg_rating numeric,
  review_count int
)
language sql
stable
as $$
  select
    p.id, p.name, p.kind, p.species, p.description, p.address, p.city, p.state,
    p.latitude, p.longitude, p.phone, p.website, p.hours, p.photo_url,
    p.added_by_user_id, p.verified, p.created_at, p.updated_at, p.source, p.osm_id,
    coalesce(st.avg_rating, 0) as avg_rating,
    coalesce(st.review_count, 0) as review_count
  from public.places p
  left join public.place_stats st on st.place_id = p.id
  where p.latitude is not null
    and p.longitude is not null
    and (p_kind is null or p.kind = p_kind)
    and (
      p_search is null
      or p.name ilike '%' || p_search || '%'
      or p.address ilike '%' || p_search || '%'
    )
  order by
    (p.latitude - p_lat) ^ 2
    + ((p.longitude - p_lng) * cos(radians(p_lat))) ^ 2 asc
  limit least(greatest(p_limit, 1), 500);
$$;

grant execute on function public.places_nearby(double precision, double precision, text, text, int) to anon, authenticated;
