-- ============================================================================
-- ADMIN · gerenciar lugares (guia pet-friendly)
-- Rode UMA vez no Supabase SQL Editor. Idempotente.
--
-- Insert de lugar já funciona pela policy normal (qualquer autenticado).
-- Isto libera o ADMIN a EDITAR/APAGAR qualquer lugar (curadoria do guia).
-- ============================================================================
drop policy if exists "admin manage places" on public.places;
create policy "admin manage places" on public.places for all
  using (public.is_admin())
  with check (public.is_admin());
