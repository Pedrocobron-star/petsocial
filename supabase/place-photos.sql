-- ============================================================================
-- PLACE_PHOTOS — múltiplas fotos por lugar (galeria), comunidade
--
-- Espelha o padrão de place_reviews (schema.sql). Fotos ficam no bucket PÚBLICO
-- 'posts' (path <user_id>/... pra respeitar a RLS de storage existente); a coluna
-- place_id faz o vínculo. `storage_path` guarda o caminho explícito pra delete
-- confiável (NÃO derivar do URL). DELETE = dono OU admin (moderação).
--
-- Idempotente. Aplicar depois de schema.sql.
-- ============================================================================

create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,                 -- URL pública do bucket 'posts'
  storage_path text not null,        -- "<user_id>/<arquivo>" pra delete confiável
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists place_photos_place_idx on public.place_photos(place_id, created_at desc);

alter table public.place_photos enable row level security;

drop policy if exists "place_photos read all" on public.place_photos;
create policy "place_photos read all" on public.place_photos for select using (true);

drop policy if exists "place_photos insert own" on public.place_photos;
create policy "place_photos insert own" on public.place_photos for insert
  with check (auth.uid() = user_id);

-- Sem UPDATE (foto é imutável; editar = apagar e repostar).
drop policy if exists "place_photos delete own or admin" on public.place_photos;
create policy "place_photos delete own or admin" on public.place_photos for delete
  using (auth.uid() = user_id or public.is_admin());
