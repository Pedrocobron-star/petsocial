-- ============================================================================
-- Maestro Pet — Hardening do sprint Notícias + Vantagens + Carteirinha (2026-06)
--
-- Fecha 3 furos achados na auditoria adversarial:
--   1) CARTEIRINHA — revogação era TEATRO: o RPC público aceitava o pet.id como
--      token (`where id_card_token = p_token OR id::text = p_token`), e o pet.id
--      é público (vai em todo link de share/perfil). Girar o token (única forma
--      de "revogar") não revogava nada — qualquer um montava /id/{petId} e puxava
--      telefone de emergência, microchip, RGA, alergias. FIX: só aceita o token.
--      BÔNUS: o card público agora devolve o selo de endosso do vet (CRMV) pra
--      exibir credibilidade pra quem escaneia o QR (antes só na carteirinha
--      privada do dono).
--   2) VANTAGENS — `notes` (notas internas do admin: contato/valor pago do
--      parceiro) e `created_by` vazavam pra QUALQUER usuário, porque a policy de
--      SELECT liberava a LINHA INTEIRA (RLS é row-level) e o client fazia
--      select('*'). FIX: leitura pública das ofertas passa a ser por um RPC que
--      devolve só colunas públicas; o SELECT direto na tabela vira admin-only.
--   3) VANTAGENS — track_offer_click era anônimo e sem dedup (contador inflável).
--      FIX: tabela offer_clicks com UNIQUE(offer, user, dia) + grant só pra
--      authenticated (a tela /offers já é logada).
--
-- Idempotente. Pré-req: pets/profiles/offers/vet_endorsements + is_admin().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) CARTEIRINHA — public_pet_card: só por token + selo de endosso
-- ----------------------------------------------------------------------------
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
    -- requested_by/vet_notes — só o que prova credibilidade (nome + CRMV + data).
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
  -- SÓ por token. O backfill de id_card_token (pet-id-card-fields.sql) garante
  -- que todo pet tem token, então não precisa mais do fallback pelo id — que
  -- era o furo de revogação.
  where p.id_card_token = p_token
  limit 1;

  return result; -- null se não achou
end;
$func$;

revoke all on function public.public_pet_card(text) from public;
grant execute on function public.public_pet_card(text) to anon, authenticated;

-- Invariante DURA: todo pet tem token (agora que a revogação só aceita token,
-- um pet sem token ficaria com carteirinha pública inacessível pra sempre).
-- Backfill defensivo + NOT NULL (a coluna já tem DEFAULT em pet-id-card-fields.sql).
update public.pets
  set id_card_token = replace(gen_random_uuid()::text, '-', '')
  where id_card_token is null;
alter table public.pets alter column id_card_token set not null;

-- ----------------------------------------------------------------------------
-- 2) VANTAGENS — leitura pública sem vazar notes/created_by
-- ----------------------------------------------------------------------------
-- RPC com só as colunas públicas (SECURITY DEFINER porque a policy de SELECT
-- direto agora é admin-only). Mantém o filtro de ativo + não-vencido + ordem.
-- NÃO devolve clicks_count (métrica comercial do parceiro = só admin) nem
-- notes/created_by (internos).
create or replace function public.offers_active()
returns table (
  id uuid,
  created_at timestamptz,
  active boolean,
  title text,
  brand text,
  description text,
  discount_label text,
  coupon_code text,
  cta_url text,
  cta_label text,
  category text,
  image_url text,
  valid_until date,
  priority int
)
language sql
security definer
set search_path = public
stable
as $func$
  select
    o.id, o.created_at, o.active, o.title, o.brand, o.description,
    o.discount_label, o.coupon_code, o.cta_url, o.cta_label, o.category,
    o.image_url, o.valid_until, o.priority
  from public.offers o
  where o.active = true
    and (o.valid_until is null or o.valid_until >= current_date)
  order by o.priority desc, o.created_at desc;
$func$;

revoke all on function public.offers_active() from public;
grant execute on function public.offers_active() to anon, authenticated;

-- SELECT direto na tabela passa a ser SÓ admin (o usuário comum usa o RPC acima).
-- Antes: USING (active = true OR is_admin()) → vazava a linha inteira (notes,
-- created_by) pra qualquer um.
-- IMPORTANTE: target SÓ `authenticated` — is_admin() não tem EXECUTE pra anon,
-- então `to anon` faria a policy ERRAR (42501) ao invés de retornar vazio. Anon
-- lê via offers_active() (SECURITY DEFINER, ignora RLS).
drop policy if exists offers_select_active on public.offers;
create policy offers_select_active on public.offers
  for select to authenticated
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3) VANTAGENS — track_offer_click com dedup por (oferta, usuário, dia)
-- ----------------------------------------------------------------------------
create table if not exists public.offer_clicks (
  offer_id uuid not null references public.offers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (offer_id, user_id, day)
);

alter table public.offer_clicks enable row level security;

-- Sem policy de SELECT pra usuário comum (métrica é só do admin via offers.clicks_count).
drop policy if exists offer_clicks_admin_read on public.offer_clicks;
create policy offer_clicks_admin_read on public.offer_clicks
  for select to authenticated
  using (public.is_admin());

create or replace function public.track_offer_click(p_offer_id uuid)
returns void
language plpgsql security definer set search_path = public as $func$
declare
  v_uid uuid := auth.uid();
  v_new boolean := false;
begin
  if v_uid is null then
    return; -- a tela /offers é logada; clique anônimo não conta
  end if;

  insert into public.offer_clicks (offer_id, user_id, day)
  values (p_offer_id, v_uid, current_date)
  on conflict (offer_id, user_id, day) do nothing;

  get diagnostics v_new = row_count;
  if v_new then
    update public.offers set clicks_count = clicks_count + 1 where id = p_offer_id;
  end if;
end;
$func$;

revoke all on function public.track_offer_click(uuid) from public;
-- só authenticated agora (a aba de vantagens exige login)
grant execute on function public.track_offer_click(uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- FIM. Após rodar (read-back sugerido):
--   - public_pet_card só resolve por id_card_token (não mais por id) + traz endorsement
--   - offers_active() existe e é executável por anon/authenticated
--   - offers_select_active agora é is_admin()-only
--   - offer_clicks existe; track_offer_click dedup + grant só authenticated
-- ============================================================================
