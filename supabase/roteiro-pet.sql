-- ============================================================================
-- ROTEIRO PET — SQL consolidada (rode UMA vez no Supabase SQL Editor).
-- Idempotente e aditiva. Junta tudo que estava pendente:
--   1) Hardening de DM bloqueado
--   2) Categorias novas de lugares (restaurante/café/evento/praia) + exemplos
--   3) meetups.place_id  (vincular evento a um lugar do guia)
--   4) place_favorites   (lugares salvos → agenda/roteiro)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) DM: impedir mensagem entre usuários bloqueados (nos 2 sentidos)
-- ----------------------------------------------------------------------------
create or replace function public.has_block_between(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
grant execute on function public.has_block_between(uuid, uuid) to authenticated;

create or replace function public.enforce_dm_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare other_id uuid;
begin
  select user_id into other_id
    from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.sender_id
    limit 1;
  if other_id is not null and public.has_block_between(new.sender_id, other_id) then
    raise exception 'Não é possível enviar: há bloqueio entre os usuários.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_dm_block on public.messages;
create trigger trg_enforce_dm_block before insert on public.messages
  for each row execute function public.enforce_dm_block();

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
