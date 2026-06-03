-- ============================================================================
-- PARASITE TREATMENTS (vermífugo, anti-pulga, antiparasitário)
-- ============================================================================
-- Cada produto tem intervalo de reaplicação próprio (Bravecto 90d, NexGard 30d,
-- Seresto 240d, Drontal 90d, etc), então gravamos o cálculo de next_due_at
-- no momento do registro pra evitar lookup runtime.

create table if not exists public.parasite_treatments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  -- Categoria geral do tratamento
  kind text not null check (kind in ('internal', 'external', 'heartworm', 'combined')),
  -- Nome do produto (Bravecto, NexGard, Simparic, Seresto, Drontal, Vermivet, etc)
  product_name text not null,
  -- ID opcional do produto no nosso catálogo frontend (ex: 'bravecto', 'nexgard')
  product_slug text,
  -- Datas
  applied_at date not null default current_date,
  next_due_at date,                                   -- calculado: applied_at + interval_days
  -- Intervalo em dias usado pra calcular next_due_at (preservado se produto sair do catálogo)
  interval_days int,
  -- Metadata clínica
  vet_name text,
  dose text,                                          -- ex: "1 comprimido", "1ml"
  weight_kg_at_treatment numeric(5,2),                -- útil pra dosagem por peso
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parasite_treatments_pet_idx
  on public.parasite_treatments(pet_id, applied_at desc);
create index if not exists parasite_treatments_due_idx
  on public.parasite_treatments(pet_id, next_due_at)
  where next_due_at is not null;

alter table public.parasite_treatments enable row level security;

drop policy if exists "parasite_treatments read all" on public.parasite_treatments;
create policy "parasite_treatments read all"
  on public.parasite_treatments for select using (true);

drop policy if exists "parasite_treatments insert own pet" on public.parasite_treatments;
create policy "parasite_treatments insert own pet"
  on public.parasite_treatments for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = parasite_treatments.pet_id
        and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "parasite_treatments update own pet" on public.parasite_treatments;
create policy "parasite_treatments update own pet"
  on public.parasite_treatments for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = parasite_treatments.pet_id
        and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "parasite_treatments delete own pet" on public.parasite_treatments;
create policy "parasite_treatments delete own pet"
  on public.parasite_treatments for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = parasite_treatments.pet_id
        and pets.owner_id = auth.uid()
    )
  );

drop trigger if exists parasite_treatments_set_updated_at on public.parasite_treatments;
create trigger parasite_treatments_set_updated_at
  before update on public.parasite_treatments
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
