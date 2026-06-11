-- ============================================================================
-- ROTEIRO PET — SQL consolidada (rode UMA vez no Supabase SQL Editor).
-- Idempotente e aditiva. Junta tudo que estava pendente:
--   1) Hardening de DM bloqueado
--   2) Categorias novas de lugares (restaurante/café/evento/praia) + exemplos
--   3) meetups.place_id  (vincular evento a um lugar do guia)
--   4) place_favorites   (lugares salvos → agenda/roteiro)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) DM bloqueado: ⚠️ DEFINICAO CANONICA em supabase/block-dm-hardening.sql.
--    has_block_between / enforce_dm_block / trg_enforce_dm_block NAO sao mais
--    redefinidos aqui (eram identicos a aquele arquivo, mas dois donos = footgun
--    de manutencao). Rode block-dm-hardening.sql pra essa feature. As secoes
--    2-5 abaixo (lugares/meetups/place_favorites/species) sao UNICAS deste arquivo.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2) Categorias novas de lugares + exemplos
-- ----------------------------------------------------------------------------
alter table public.places drop constraint if exists places_kind_check;
alter table public.places add constraint places_kind_check
  check (kind in (
    'vet','pet_shop','hotel','daycare','park','grooming','training',
    'restaurant','cafe','event','beach','other'
  ));

insert into public.places (name, kind, description, address, city, verified)
select v.name, v.kind, v.description, v.address, v.city, true
from (values
  ('Quintal do Cão Bistrô', 'restaurant', 'Restaurante com varanda pet friendly, petiscos e água fresca pros bichos.', 'R. Harmonia, 123 - Vila Madalena', 'São Paulo'),
  ('Empório Pet & Comida', 'restaurant', 'Mesas externas que aceitam cães de todos os portes. Menu pet opcional.', 'R. dos Pinheiros, 456 - Pinheiros', 'São Paulo'),
  ('Café com Patas', 'cafe', 'Cafeteria aconchegante que recebe pets no salão. Tem tapete e comedouro.', 'R. Vergueiro, 789 - Vila Mariana', 'São Paulo'),
  ('Au Au Coffee', 'cafe', 'Café especial com área pet e biscoitos caninos da casa.', 'R. Joaquim Floriano, 100 - Itaim Bibi', 'São Paulo'),
  ('Feira Adote um Focinho', 'event', 'Feira mensal de adoção responsável + bazar pet. Todo 2º domingo do mês.', 'Parque Ibirapuera - Portão 3', 'São Paulo'),
  ('Cãominhada Solidária', 'event', 'Caminhada em grupo com os pets pra arrecadar ração pra ONGs.', 'Parque do Povo - Itaim', 'São Paulo'),
  ('Praia da Baleia (área pet)', 'beach', 'Trecho que permite cães na coleira fora do horário de pico. Leve sacolinha!', 'Praia da Baleia - São Sebastião', 'São Sebastião'),
  ('Praia do Tombo (faixa pet)', 'beach', 'Cães permitidos em horários específicos; confira a sinalização local.', 'Praia do Tombo - Guarujá', 'Guarujá')
) as v(name, kind, description, address, city)
where not exists (select 1 from public.places p where p.name = v.name);

-- ----------------------------------------------------------------------------
-- 3) Eventos acontecem EM lugares (meetups.place_id)
-- ----------------------------------------------------------------------------
alter table public.meetups
  add column if not exists place_id uuid references public.places(id) on delete set null;
create index if not exists meetups_place_idx on public.meetups(place_id);

-- ----------------------------------------------------------------------------
-- 4) Lugares salvos (favoritos) → agenda/roteiro pet
-- ----------------------------------------------------------------------------
create table if not exists public.place_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists place_favorites_user_idx on public.place_favorites(user_id);
alter table public.place_favorites enable row level security;
drop policy if exists "place_favorites own" on public.place_favorites;
create policy "place_favorites own" on public.place_favorites for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 5) Espécie a que o lugar atende: 'all' (todos) / 'dog' / 'cat' / 'other'
-- ----------------------------------------------------------------------------
alter table public.places
  add column if not exists species text not null default 'all';
alter table public.places drop constraint if exists places_species_check;
alter table public.places add constraint places_species_check
  check (species in ('all', 'dog', 'cat', 'other'));
-- Tagueia alguns exemplos pra dar variedade ao filtro (idempotente; resto = 'all')
update public.places set species = 'dog'
  where name in ('Praia da Baleia (área pet)', 'Praia do Tombo (faixa pet)', 'Creche Cãopanheiros')
    and species = 'all';
