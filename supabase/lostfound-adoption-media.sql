-- =============================================================================
-- Achados (lost_reports) e Adoção (adoption_listings): até 10 fotos + 1 vídeo
-- =============================================================================
-- Antes: Achados tinha 1 foto (`photo_url text`); Adoção tinha fotos em
-- `image_urls text[]` mas sem vídeo. Pedro pediu até 10 fotos + 1 vídeo nos dois.
--
-- Achados: adiciona `image_urls text[]` (galeria) + `video_url text`. A coluna
-- antiga `photo_url` continua (compat com reports já existentes; a tela de
-- detalhe usa image_urls quando houver, senão cai no photo_url).
-- Adoção: adiciona só `video_url text` (já tinha image_urls).
--
-- Idempotente.
-- =============================================================================

alter table public.adoption_listings add column if not exists video_url text;

alter table public.lost_reports add column if not exists image_urls text[] not null default '{}';
alter table public.lost_reports add column if not exists video_url text;
