-- ============================================================================
-- PII HARDENING — carteirinha pública (2026-06-06)
-- ============================================================================
-- Problema: `pets` e `profiles` tinham RLS "read all using (true)" → qualquer um
-- (anon, sem token) podia varrer a tabela inteira pela API e coletar microchip,
-- RGA, telefone de emergência, owner_id de TODOS os pets. O token da carteirinha
-- só era usado como filtro no client — não protegia nada no banco.
--
-- Fix: acesso público à carteirinha passa por um RPC SECURITY DEFINER gated por
-- token, que devolve só os campos do cartão + nome/foto do tutor. E o SELECT
-- direto em pets/profiles fica restrito a usuários autenticados.
--
-- Não quebra:
--  - Carteirinha pública  → usa o RPC abaixo.
--  - Endosso público      → já usa o RPC `endorse_fetch` (security definer).
--  - share-meta (OG tags) → usa SERVICE_ROLE_KEY (ignora RLS).
--  - App logado           → role `authenticated`, RLS abaixo permite.
-- ============================================================================

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
      'microchip_number', p.microchip_number,
      'rga_number', p.rga_number,
      'sinpatinhas_id', p.sinpatinhas_id,
      'blood_type', p.blood_type,
      'allergies', p.allergies,
      'known_conditions', p.known_conditions,
      'emergency_contact_name', p.emergency_contact_name,
      'emergency_contact_phone', p.emergency_contact_phone,
      'preferred_vet_name', p.preferred_vet_name,
      'preferred_vet_phone', p.preferred_vet_phone,
      'id_card_token', p.id_card_token
    ),
    'tutor', json_build_object(
      'display_name', pr.display_name,
      'avatar_url', pr.avatar_url
    ),
    -- Selo de endosso (só o mais recente assinado). NUNCA expõe id/token/
    -- requested_by/vet_notes — só nome + CRMV + data.
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
  from public.pets p
  left join public.profiles pr on pr.id = p.owner_id
  -- SÓ por token (NUNCA pelo id). Aceitar o pet.id como token furava a
  -- revogação: o id é público e imutável, então girar o token não revogava
  -- nada. Todo pet tem token (DEFAULT + NOT NULL em pet-id-card-fields.sql).
  where p.id_card_token = p_token
  limit 1;

  return result; -- null se não achou
end;
$func$;

revoke all on function public.public_pet_card(text) from public;
grant execute on function public.public_pet_card(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS: bloqueia varredura anônima de pets/profiles. Autenticado continua lendo
-- tudo (perfis públicos, feed, etc. dependem disso).
-- ----------------------------------------------------------------------------
drop policy if exists "pets read all" on public.pets;
drop policy if exists "pets read auth" on public.pets;
create policy "pets read auth" on public.pets
  for select using (auth.uid() is not null);

drop policy if exists "profiles read all" on public.profiles;
drop policy if exists "profiles read auth" on public.profiles;
create policy "profiles read auth" on public.profiles
  for select using (auth.uid() is not null);

notify pgrst, 'reload schema';
