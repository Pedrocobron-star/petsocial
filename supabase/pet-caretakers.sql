-- ============================================================================
-- PET CARETAKERS — compartilhamento com família, dog walker, pet sitter
-- ============================================================================
-- O dono convida outras pessoas via email/código. Caretakers podem:
--   • viewer: ver agenda, logs e fotos (read-only)
--   • caregiver: viewer + marcar eventos como feito + adicionar logs/fotos
-- O dono nunca perde controle: pode remover caretaker a qualquer momento.
-- ============================================================================

create table if not exists public.pet_caretakers (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  -- Quem é o caretaker (preenchido depois que aceita o convite)
  user_id uuid references auth.users(id) on delete cascade,
  -- Email do convidado (pra antes do aceite)
  invited_email text,
  -- Token usado pra aceitar via link
  invite_token text not null default replace(gen_random_uuid()::text, '-', ''),
  -- Papel
  role text not null default 'caregiver' check (role in ('viewer', 'caregiver')),
  -- Quem convidou (sempre o owner do pet)
  invited_by uuid not null references auth.users(id) on delete cascade,
  -- Status
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  accepted_at timestamptz,
  -- Apelido visual (ex: "Marido", "Mãe", "Petshop Doggy")
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pet_caretakers_pet_idx
  on public.pet_caretakers(pet_id);
create index if not exists pet_caretakers_user_idx
  on public.pet_caretakers(user_id) where user_id is not null;
create unique index if not exists pet_caretakers_token_idx
  on public.pet_caretakers(invite_token);
-- Um mesmo user_id só pode ter 1 caretaker ativo por pet
create unique index if not exists pet_caretakers_unique_user_pet
  on public.pet_caretakers(pet_id, user_id) where user_id is not null and status = 'accepted';

alter table public.pet_caretakers enable row level security;

-- Helper: dado um pet, retorna true se viewer é caretaker aceito (qualquer role)
create or replace function public.is_caretaker_of(pet_uuid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.pet_caretakers
    where pet_id = pet_uuid
      and user_id = auth.uid()
      and status = 'accepted'
  );
$$;

-- Helper: caregiver level (pode escrever)
create or replace function public.is_caregiver_of(pet_uuid uuid)
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from public.pet_caretakers
    where pet_id = pet_uuid
      and user_id = auth.uid()
      and status = 'accepted'
      and role = 'caregiver'
  );
$$;

-- Helper: owner ou caretaker (pra leitura)
create or replace function public.can_view_pet(pet_uuid uuid)
returns boolean
language sql
stable
security definer
as $$
  select
    exists (select 1 from public.pets where id = pet_uuid and owner_id = auth.uid())
    or public.is_caretaker_of(pet_uuid);
$$;

-- ============================================================================
-- RLS pet_caretakers
-- ============================================================================
-- Read: owner do pet OU o próprio user_id da row
drop policy if exists "pet_caretakers read" on public.pet_caretakers;
create policy "pet_caretakers read" on public.pet_caretakers for select
  using (
    auth.uid() = user_id
    or auth.uid() = invited_by
    or exists (
      select 1 from public.pets
      where pets.id = pet_caretakers.pet_id and pets.owner_id = auth.uid()
    )
  );

-- Insert: só o owner pode convidar
drop policy if exists "pet_caretakers invite" on public.pet_caretakers;
create policy "pet_caretakers invite" on public.pet_caretakers for insert
  with check (
    auth.uid() = invited_by
    and exists (
      select 1 from public.pets
      where pets.id = pet_caretakers.pet_id and pets.owner_id = auth.uid()
    )
  );

-- Update: owner pode mudar role/status; caretaker pode aceitar/declinar a própria row
drop policy if exists "pet_caretakers update" on public.pet_caretakers;
create policy "pet_caretakers update" on public.pet_caretakers for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.pets
      where pets.id = pet_caretakers.pet_id and pets.owner_id = auth.uid()
    )
  );

-- Delete: só o owner pode remover (revoke)
drop policy if exists "pet_caretakers delete" on public.pet_caretakers;
create policy "pet_caretakers delete" on public.pet_caretakers for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_caretakers.pet_id and pets.owner_id = auth.uid()
    )
  );

drop trigger if exists pet_caretakers_set_updated_at on public.pet_caretakers;
create trigger pet_caretakers_set_updated_at
  before update on public.pet_caretakers
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Expandir RLS de pet_events e pet_event_logs pra incluir caretakers
-- ============================================================================
-- pet_events: caregivers podem inserir/editar/concluir; viewers só ler
drop policy if exists "pet_events insert own pet" on public.pet_events;
create policy "pet_events insert own pet" on public.pet_events for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = pet_events.pet_id and pets.owner_id = auth.uid()
    )
    or public.is_caregiver_of(pet_events.pet_id)
  );

drop policy if exists "pet_events update own pet" on public.pet_events;
create policy "pet_events update own pet" on public.pet_events for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_events.pet_id and pets.owner_id = auth.uid()
    )
    or public.is_caregiver_of(pet_events.pet_id)
  );

-- pet_event_logs: caregivers podem registrar/editar logs
drop policy if exists "pet_event_logs insert own pet" on public.pet_event_logs;
create policy "pet_event_logs insert own pet" on public.pet_event_logs for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = pet_event_logs.pet_id and pets.owner_id = auth.uid()
    )
    or public.is_caregiver_of(pet_event_logs.pet_id)
  );

drop policy if exists "pet_event_logs update own pet" on public.pet_event_logs;
create policy "pet_event_logs update own pet" on public.pet_event_logs for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = pet_event_logs.pet_id and pets.owner_id = auth.uid()
    )
    or public.is_caregiver_of(pet_event_logs.pet_id)
  );

-- ============================================================================
-- RPC pra aceitar convite via token (sem precisar saber o pet_id antes)
-- ============================================================================
create or replace function public.accept_caretaker_invite(token text)
returns uuid
language plpgsql
security definer
as $$
declare
  v_row public.pet_caretakers;
begin
  -- Busca convite pendente pelo token
  select * into v_row from public.pet_caretakers
    where invite_token = token and status = 'pending'
    limit 1;
  if v_row.id is null then
    raise exception 'Convite inválido ou já usado';
  end if;
  -- Atualiza pra aceito vinculando ao usuário atual
  update public.pet_caretakers
    set user_id = auth.uid(), status = 'accepted', accepted_at = now()
    where id = v_row.id;
  return v_row.pet_id;
end;
$$;

revoke all on function public.accept_caretaker_invite from public, anon;
grant execute on function public.accept_caretaker_invite to authenticated;

notify pgrst, 'reload schema';
