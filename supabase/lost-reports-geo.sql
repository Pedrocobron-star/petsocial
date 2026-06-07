-- ============================================================================
-- ACHADOS & PERDIDOS · geolocalização (captura + raio) — idempotente
-- Lat/long OPCIONAIS no reporte; distância é calculada no cliente (haversine).
-- ============================================================================
alter table public.lost_reports add column if not exists latitude double precision;
alter table public.lost_reports add column if not exists longitude double precision;

notify pgrst, 'reload schema';
