-- ============================================================================
-- Maestro Pet — Prova de consentimento + confirmação de idade (LGPD / CDC)
--
-- O cadastro (app/(auth)/sign-up.tsx) grava terms_accepted_at + age_confirmed
-- após o signup. LGPD Art. 7 pede prova de consentimento; idade mínima 13.
-- Idempotente. Aplicar via Management API (ver supabase_sql_apply).
-- ============================================================================

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists age_confirmed boolean not null default false;

notify pgrst, 'reload schema';
