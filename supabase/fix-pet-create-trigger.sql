-- ============================================================================
-- FIX CRÍTICO — criar pet estava QUEBRADO em produção desde 2026-06-16
--
-- Causa: a Migration B do pet-private-pii.sql dropou a coluna pets.id_card_token
-- (PII movida pra pet_private) e os triggers pets_mirror_private_*. MAS sobrou um
-- trigger ANTIGO e separado, `pets_generate_id_card_token` (BEFORE INSERT, função
-- generate_pet_id_card_token()), que ainda fazia `new.id_card_token is null`.
-- Como a coluna não existe mais, TODO insert em pets passou a falhar com
-- "record new has no field id_card_token" → ninguém conseguia cadastrar pet.
-- (Passou batido porque nenhum pet foi criado desde a migração — sem usuários reais.)
--
-- Fix:
--   1. Dropa o trigger/função quebrados.
--   2. Recria a criação automática do pet_private (que a Migration B tirou junto):
--      um AFTER INSERT que insere pet_private(pet_id) — o id_card_token vem do
--      DEFAULT da coluna. Assim todo pet novo já nasce com carteirinha/token.
--
-- Idempotente. APLICADO em 2026-06-18 (verificado: 3 pets-persona criados + 3
-- pet_private gerados automaticamente).
-- ============================================================================

drop trigger if exists pets_generate_id_card_token on public.pets;
drop function if exists public.generate_pet_id_card_token() cascade;

create or replace function public.pets_ensure_private()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.pet_private (pet_id) values (NEW.id) on conflict (pet_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists pets_ensure_private_ins on public.pets;
create trigger pets_ensure_private_ins after insert on public.pets
  for each row execute function public.pets_ensure_private();

-- ============================================================================
-- FIM. Criar pet volta a funcionar e todo pet novo ganha pet_private + token.
-- ============================================================================
