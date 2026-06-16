-- ============================================================================
-- PET PRIVATE — fecha vazamento de PII médica (2026-06-16)
-- ============================================================================
-- Problema (auditoria adversarial dos Perfis): a RLS de `pets` e
-- `using (auth.uid() is not null)` => QUALQUER usuario logado le TODAS as
-- colunas de QUALQUER pet via `select('*')` (fetchPet) ou direto pela REST API
-- (`/rest/v1/pets?select=*`). Isso inclui microchip, RGA, tipo sanguineo,
-- alergias, condicoes, contato de emergencia (nome+fone), vet (nome+fone),
-- SinPatinhas e o id_card_token. A blindagem v100 so cobriu as SUB-tabelas de
-- saude; esses campos moram na propria `pets`. O token e uma capability: quem
-- le o token de outro pet chama o RPC publico e puxa toda a PII. Mesmo classe
-- do IDOR do chat.
--
-- Fix: mover os 10 campos sensiveis + o id_card_token pra uma tabela-filha
-- `pet_private` com RLS DONO-ONLY. As funcoes publicas (public_pet_card,
-- endorse_fetch) sao SECURITY DEFINER => leem pet_private ignorando RLS, entao
-- a carteirinha publica (QR) e o fluxo de endosso continuam funcionando. O
-- visitante logado nao le mais nada sensivel de pets.
--
-- ROLLOUT SEGURO (nunca deixar prod quebrado):
--   * Migration A (este arquivo, parte 1): ADITIVA. Cria pet_private, backfill,
--     RLS, triggers de espelhamento pets->pet_private (mantem sincronizado
--     durante o rollout do client, SEM clobber), e aponta as 2 funcoes definer
--     pra pet_private. As colunas continuam em `pets` (furo ainda aberto), mas
--     nada quebra: leitura/escrita do client v147 segue valida.
--   * Deploy client v148: le/escreve PII em pet_private.
--   * Migration B (parte 2, rodar SO depois de v148 verificado): DROPA as 11
--     colunas de `pets` (dado preservado em pet_private) + dropa os triggers.
--     >>> AQUI O FURO FECHA. <<<
--
-- Idempotente, ASCII-only.
--
-- >>> STATUS: Migration A + Migration B APLICADAS em 2026-06-16 (verificado ao
--     vivo: dono le pet_private, visitante bloqueado [42501], carteirinha
--     publica via RPC ok, 0 colunas sensiveis restantes em pets). <<<
--
-- AVISO ao re-rodar: a SECAO 4 (triggers de espelhamento) era TRANSITORIA e ja
-- foi dropada pela Migration B. NAO re-execute a secao 4 contra o schema atual:
-- a funcao/triggers referenciam colunas (NEW.microchip_number etc.) que NAO
-- existem mais em pets => daria erro. As secoes 1-3, 5 e 6 seguem idempotentes.
-- PENDENTE: redeploy da edge function share-meta (`supabase functions deploy
-- share-meta --no-verify-jwt`) pra OG de link de carteirinha resolver o token
-- via pet_private (ate la, preview de link compartilhado cai no generico).
-- ============================================================================

-- ============================================================================
-- PARTE 1 — MIGRATION A (aditiva, aplicar agora)
-- ============================================================================

-- 1) Tabela-filha
create table if not exists public.pet_private (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  microchip_number text,
  rga_number text,
  blood_type text,
  allergies text,
  known_conditions text,
  emergency_contact_name text,
  emergency_contact_phone text,
  preferred_vet_name text,
  preferred_vet_phone text,
  sinpatinhas_id text,
  id_card_token text unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Backfill a partir de pets (idempotente)
insert into public.pet_private (
  pet_id, microchip_number, rga_number, blood_type, allergies, known_conditions,
  emergency_contact_name, emergency_contact_phone, preferred_vet_name,
  preferred_vet_phone, sinpatinhas_id, id_card_token
)
select
  id, microchip_number, rga_number, blood_type, allergies, known_conditions,
  emergency_contact_name, emergency_contact_phone, preferred_vet_name,
  preferred_vet_phone, sinpatinhas_id, id_card_token
from public.pets
on conflict (pet_id) do nothing;

-- Invariante: todo pet_private TEM token (a carteirinha publica so resolve por
-- token). Backfill defensivo + NOT NULL.
update public.pet_private
  set id_card_token = replace(gen_random_uuid()::text, '-', '')
  where id_card_token is null;
alter table public.pet_private alter column id_card_token set not null;

create unique index if not exists pet_private_id_card_token_idx
  on public.pet_private(id_card_token);

-- 3) RLS DONO-ONLY (visitante nao le nada; co-tutor tambem nao — a carteirinha
--    e gerida pelo dono e exposta publicamente so via token/RPC definer)
alter table public.pet_private enable row level security;

drop policy if exists pet_private_owner_all on public.pet_private;
create policy pet_private_owner_all on public.pet_private
  for all to authenticated
  using (
    exists (select 1 from public.pets p
            where p.id = pet_private.pet_id and p.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.pets p
            where p.id = pet_private.pet_id and p.owner_id = auth.uid())
  );

revoke all on public.pet_private from anon;
grant select, insert, update, delete on public.pet_private to authenticated;

-- 4) Triggers de espelhamento pets -> pet_private (so durante a transicao).
--    SECURITY DEFINER pra inserir/atualizar pet_private independente de RLS.
--    INSERT: cria a linha-espelho pra todo pet novo (qualquer versao de client).
--    UPDATE: so dispara quando uma coluna SENSIVEL muda em `pets` (cliente v147).
--      => o client v148 escreve PII so em pet_private e NAO toca pets.<sensivel>,
--         entao updates de base (nome, bio) NAO disparam o trigger e NAO
--         sobrescrevem (clobber) a PII fresca do pet_private. Sem dupla-verdade.
create or replace function public.pets_mirror_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  insert into public.pet_private (
    pet_id, microchip_number, rga_number, blood_type, allergies, known_conditions,
    emergency_contact_name, emergency_contact_phone, preferred_vet_name,
    preferred_vet_phone, sinpatinhas_id, id_card_token
  )
  values (
    NEW.id, NEW.microchip_number, NEW.rga_number, NEW.blood_type, NEW.allergies,
    NEW.known_conditions, NEW.emergency_contact_name, NEW.emergency_contact_phone,
    NEW.preferred_vet_name, NEW.preferred_vet_phone, NEW.sinpatinhas_id,
    coalesce(NEW.id_card_token, replace(gen_random_uuid()::text, '-', ''))
  )
  on conflict (pet_id) do update set
    microchip_number        = excluded.microchip_number,
    rga_number              = excluded.rga_number,
    blood_type              = excluded.blood_type,
    allergies               = excluded.allergies,
    known_conditions        = excluded.known_conditions,
    emergency_contact_name  = excluded.emergency_contact_name,
    emergency_contact_phone = excluded.emergency_contact_phone,
    preferred_vet_name      = excluded.preferred_vet_name,
    preferred_vet_phone     = excluded.preferred_vet_phone,
    sinpatinhas_id          = excluded.sinpatinhas_id,
    -- NUNCA sobrescreve o token no update (gerido em pet_private)
    updated_at              = now();
  return NEW;
end;
$f$;

drop trigger if exists pets_mirror_private_ins on public.pets;
create trigger pets_mirror_private_ins
  after insert on public.pets
  for each row execute function public.pets_mirror_private();

drop trigger if exists pets_mirror_private_upd on public.pets;
create trigger pets_mirror_private_upd
  after update on public.pets
  for each row
  when (
       NEW.microchip_number        is distinct from OLD.microchip_number
    or NEW.rga_number              is distinct from OLD.rga_number
    or NEW.blood_type              is distinct from OLD.blood_type
    or NEW.allergies               is distinct from OLD.allergies
    or NEW.known_conditions        is distinct from OLD.known_conditions
    or NEW.emergency_contact_name  is distinct from OLD.emergency_contact_name
    or NEW.emergency_contact_phone is distinct from OLD.emergency_contact_phone
    or NEW.preferred_vet_name      is distinct from OLD.preferred_vet_name
    or NEW.preferred_vet_phone     is distinct from OLD.preferred_vet_phone
    or NEW.sinpatinhas_id          is distinct from OLD.sinpatinhas_id
  )
  execute function public.pets_mirror_private();

-- 5) public_pet_card — le PII de pet_private (definer, por token). Base (nome,
--    especie, foto) continua vindo de pets. Mantem selo de endosso.
create or replace function public.public_pet_card(p_token text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $func$
declare
  result json;
begin
  if p_token is null or length(p_token) = 0 then
    return null;
  end if;

  select json_build_object(
    'pet', json_build_object(
      'id', p.id,
      'name', p.name,
      'species', p.species,
      'breed', p.breed,
      'birthdate', p.birthdate,
      'avatar_url', p.avatar_url,
      'microchip_number', pv.microchip_number,
      'rga_number', pv.rga_number,
      'sinpatinhas_id', pv.sinpatinhas_id,
      'blood_type', pv.blood_type,
      'allergies', pv.allergies,
      'known_conditions', pv.known_conditions,
      'emergency_contact_name', pv.emergency_contact_name,
      'emergency_contact_phone', pv.emergency_contact_phone,
      'preferred_vet_name', pv.preferred_vet_name,
      'preferred_vet_phone', pv.preferred_vet_phone,
      'id_card_token', pv.id_card_token
    ),
    'tutor', json_build_object(
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url
    ),
    'endorsement', (
      select json_build_object(
        'vet_name', ve.vet_name,
        'crmv_number', ve.crmv_number,
        'crmv_state', ve.crmv_state,
        'signed_at', ve.signed_at
      )
      from public.vet_endorsements ve
      where ve.pet_id = p.id and ve.status = 'signed'
      order by ve.signed_at desc nulls last
      limit 1
    )
  ) into result
  from public.pet_private pv
  join public.pets p on p.id = pv.pet_id
  left join public.profiles pr on pr.id = p.owner_id
  where pv.id_card_token = p_token
  limit 1;

  return result; -- null se nao achou
end;
$func$;

revoke all on function public.public_pet_card(text) from public;
grant execute on function public.public_pet_card(text) to anon, authenticated;

-- 6) endorse_fetch — le microchip/rga/sinpatinhas de pet_private (definer)
create or replace function public.endorse_fetch(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_result jsonb;
  v_pet_id uuid;
  v_status text;
begin
  select pet_id, status into v_pet_id, v_status
  from public.vet_endorsements where token = p_token;

  if v_pet_id is null then
    return jsonb_build_object('found', false);
  end if;

  select jsonb_build_object(
    'found', true,
    'status', v_status,
    'scope', (select scope from public.vet_endorsements where token = p_token),
    'pet', (
      select jsonb_build_object(
        'name', p.name, 'species', p.species, 'breed', p.breed, 'birthdate', p.birthdate,
        'microchip_number', pv.microchip_number, 'rga_number', pv.rga_number,
        'sinpatinhas_id', pv.sinpatinhas_id
      )
      from public.pets p
      left join public.pet_private pv on pv.pet_id = p.id
      where p.id = v_pet_id
    ),
    'tutor', (select jsonb_build_object('display_name', pr.display_name)
              from public.pets pe join public.profiles pr on pr.id = pe.owner_id
              where pe.id = v_pet_id),
    'vaccines', coalesce((select jsonb_agg(jsonb_build_object(
        'name', name, 'applied_at', applied_at, 'next_dose_at', next_dose_at, 'vet_name', vet_name
      ) order by applied_at desc)
      from public.vaccinations where pet_id = v_pet_id), '[]'::jsonb),
    'endorsement', (select jsonb_build_object(
        'vet_name', vet_name, 'crmv_number', crmv_number, 'crmv_state', crmv_state,
        'signed_at', signed_at
      ) from public.vet_endorsements where token = p_token and status = 'signed')
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.endorse_fetch(text) from public;
grant execute on function public.endorse_fetch(text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba NOVA) — confirmar Migration A:
--   select count(*) from public.pet_private;                 -- == count(pets)
--   select count(*) from public.pets;
--   select count(*) from public.pet_private where id_card_token is null;  -- 0
--   -- token espelhado bate com pets:
--   select count(*) from public.pets p join public.pet_private pv on pv.pet_id=p.id
--     where p.id_card_token is distinct from pv.id_card_token;            -- 0
--   -- funcoes recriadas:
--   select proname from pg_proc where proname in ('public_pet_card','endorse_fetch','pets_mirror_private');
-- ============================================================================


-- ============================================================================
-- PARTE 2 — MIGRATION B (rodar SO DEPOIS de v148 deployado e verificado ao vivo)
-- >>> Fecha o furo. Dado preservado em pet_private. <<<
-- ============================================================================
-- -- Drop dos triggers de espelhamento (a funcao referencia colunas que vao sumir)
-- drop trigger if exists pets_mirror_private_ins on public.pets;
-- drop trigger if exists pets_mirror_private_upd on public.pets;
-- drop function if exists public.pets_mirror_private();
--
-- -- Drop das 11 colunas sensiveis de pets (dado ja vive em pet_private)
-- alter table public.pets
--   drop column if exists microchip_number,
--   drop column if exists rga_number,
--   drop column if exists blood_type,
--   drop column if exists allergies,
--   drop column if exists known_conditions,
--   drop column if exists emergency_contact_name,
--   drop column if exists emergency_contact_phone,
--   drop column if exists preferred_vet_name,
--   drop column if exists preferred_vet_phone,
--   drop column if exists sinpatinhas_id,
--   drop column if exists id_card_token;
--
-- notify pgrst, 'reload schema';
--
-- -- READ-BACK Migration B:
-- --   select column_name from information_schema.columns
-- --     where table_schema='public' and table_name='pets'
-- --       and column_name in ('microchip_number','id_card_token','sinpatinhas_id'); -- 0 rows
-- --   -- carteirinha publica ainda resolve:
-- --   select public.public_pet_card((select id_card_token from public.pet_private limit 1)) is not null; -- t
-- ============================================================================
