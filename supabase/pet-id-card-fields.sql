-- ============================================================================
-- PET ID CARD — campos adicionais pra carteirinha digital
-- ============================================================================
-- Todos opcionais. Ficam visíveis na carteirinha quando preenchidos.
-- Importante: não temos opinião médica — só guardamos o que o tutor preencheu.
-- ============================================================================

alter table public.pets
  add column if not exists microchip_number text,
  add column if not exists rga_number text,                 -- Registro Geral Animal (município)
  add column if not exists blood_type text,                 -- DEA 1.1+, DEA 1.1-, etc (declarado pelo tutor)
  add column if not exists allergies text,                  -- texto livre declarado
  add column if not exists known_conditions text,           -- texto livre declarado
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists preferred_vet_name text,
  add column if not exists preferred_vet_phone text,
  -- Token opcional pra "revogar" share — se trocar, links antigos param de funcionar
  add column if not exists id_card_token text unique
    default replace(gen_random_uuid()::text, '-', '');

-- Garante que pets existentes ganham um token
update public.pets
  set id_card_token = replace(gen_random_uuid()::text, '-', '')
  where id_card_token is null;

-- Invariante DURA: todo pet TEM token (a carteirinha pública só resolve por
-- token; sem isso um pet sem token ficaria inacessível pra sempre). NOT NULL +
-- DEFAULT garantem isso no schema, não só por convenção.
alter table public.pets alter column id_card_token set not null;

-- Index para lookup público pelo token
create index if not exists pets_id_card_token_idx
  on public.pets(id_card_token) where id_card_token is not null;

notify pgrst, 'reload schema';
