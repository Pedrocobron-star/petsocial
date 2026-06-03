-- ============================================================================
-- PET AGENDA — eventos, rotinas e lembretes do pet
-- ============================================================================
-- Diferenciais da nossa agenda vs. Google Calendar:
--   • Cada evento vinculado ao pet (avatar, cor, contexto)
--   • Templates prontos de rotinas (banho mensal, escolinha semanal, etc)
--   • Logs pós-evento (mood + foto + custo) → vira diário visual
--   • Auto-sincronia com vacinas/parasitas/vet (read-only, sem duplo registro)
--   • Conquistas baseadas em pontualidade
-- ============================================================================

-- Evento agendado (template de recorrência ou ocorrência única)
create table if not exists public.pet_events (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,

  -- Categoria geral
  kind text not null check (kind in (
    'bath',           -- banho
    'grooming',       -- tosa / spa
    'school',         -- escolinha / creche / adestramento
    'walk',           -- passeio
    'vet_visit',      -- consulta agendada
    'feeding',        -- ração / alimentação especial
    'training',       -- treino em casa
    'playdate',       -- encontro com amigo
    'nail_trim',      -- corte de unha
    'ear_cleaning',   -- limpeza de ouvido
    'tooth_brushing', -- escovação dental
    'custom'          -- qualquer outro
  )),

  -- Conteúdo
  title text not null,
  description text,
  location text,
  emoji text,

  -- Quando
  starts_at timestamptz not null,
  duration_minutes int,                   -- duração estimada (nullable)
  all_day boolean not null default false,

  -- Recorrência (formato simples: "weekly", "monthly", "every:30d", "every:90d", etc)
  recurrence_rule text,
  recurrence_end_at timestamptz,          -- termina em (nullable = pra sempre)

  -- Lembretes — minutos antes do evento
  -- Default: 1 dia antes + na hora. Ex: [1440, 0]
  reminder_minutes int[] default array[1440, 0]::int[],

  -- Custo estimado (R$). Usado pra projeção mensal.
  estimated_cost numeric(10,2),

  -- Cor pra UI (opcional, sobrescreve cor padrão do tipo)
  color text,

  -- Para integração com outras features
  linked_meetup_id uuid references public.meetups(id) on delete set null,

  -- Estado
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pet_events_pet_idx on public.pet_events(pet_id, starts_at);
create index if not exists pet_events_active_idx on public.pet_events(pet_id, active, starts_at) where active = true;

-- Log de cada ocorrência (completed/skipped) com mood + foto + custo real
-- Recurring events: cada ocorrência completed gera um log separado.
create table if not exists public.pet_event_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.pet_events(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,

  -- Qual ocorrência? (data prevista da ocorrência, não a real)
  occurrence_date date not null,

  -- Status
  status text not null default 'done' check (status in ('done', 'skipped')),
  completed_at timestamptz default now(),

  -- Mood pós-evento — 1 (chorou 😢) a 5 (amou 🤩)
  mood int check (mood between 1 and 5),

  -- Notas + foto opcional
  notes text,
  photo_url text,

  -- Custo real (pode diferir do estimado)
  actual_cost numeric(10,2),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pet_event_logs_unique
  on public.pet_event_logs(event_id, occurrence_date);
create index if not exists pet_event_logs_pet_idx
  on public.pet_event_logs(pet_id, occurrence_date desc);

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.pet_events enable row level security;
alter table public.pet_event_logs enable row level security;

-- pet_events
drop policy if exists "pet_events read all" on public.pet_events;
create policy "pet_events read all" on public.pet_events for select using (true);

drop policy if exists "pet_events insert own pet" on public.pet_events;
create policy "pet_events insert own pet" on public.pet_events for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = pet_events.pet_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "pet_events update own pet" on public.pet_events;
create policy "pet_events update own pet" on public.pet_events for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_events.pet_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "pet_events delete own pet" on public.pet_events;
create policy "pet_events delete own pet" on public.pet_events for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_events.pet_id and pets.owner_id = auth.uid()
    )
  );

-- pet_event_logs
drop policy if exists "pet_event_logs read all" on public.pet_event_logs;
create policy "pet_event_logs read all" on public.pet_event_logs for select using (true);

drop policy if exists "pet_event_logs insert own pet" on public.pet_event_logs;
create policy "pet_event_logs insert own pet" on public.pet_event_logs for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = pet_event_logs.pet_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "pet_event_logs update own pet" on public.pet_event_logs;
create policy "pet_event_logs update own pet" on public.pet_event_logs for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_event_logs.pet_id and pets.owner_id = auth.uid()
    )
  );

drop policy if exists "pet_event_logs delete own pet" on public.pet_event_logs;
create policy "pet_event_logs delete own pet" on public.pet_event_logs for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_event_logs.pet_id and pets.owner_id = auth.uid()
    )
  );

-- Triggers updated_at
drop trigger if exists pet_events_set_updated_at on public.pet_events;
create trigger pet_events_set_updated_at
  before update on public.pet_events
  for each row execute function public.set_updated_at();

drop trigger if exists pet_event_logs_set_updated_at on public.pet_event_logs;
create trigger pet_event_logs_set_updated_at
  before update on public.pet_event_logs
  for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
