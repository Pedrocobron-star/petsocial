-- ============================================================================
-- Maestro Pet — Admin pode conceder Pet Pro manualmente + selo verificado
--
-- O que esse SQL faz:
--   1. Adiciona `profiles.is_pro` (denormalized) → leitura rápida pra renderizar
--      o selo dourado no feed, perfil, etc, sem JOIN com `subscriptions`.
--   2. Trigger em `subscriptions` mantém `profiles.is_pro` sincronizado.
--   3. Backfill inicial — preenche is_pro pros users que já são Pro.
--   4. Adiciona colunas em `subscriptions` pra trackear grants manuais:
--      granted_by_admin, granted_by_admin_email, granted_at.
--   5. RPC `admin_grant_pro(user_id, duration_days)` — admin dá Pro pra alguém
--      com duração (null = permanente).
--   6. RPC `admin_revoke_pro(user_id)` — admin remove Pro.
--
-- Idempotente — pode rodar várias vezes.
-- Pre-req: precisa do `admin-sponsored-and-analytics.sql` rodado primeiro
-- (depende da função `is_admin()`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.is_pro (denormalized cache)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_pro'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_pro boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS profiles_is_pro_idx ON public.profiles (is_pro) WHERE is_pro = true;
  END IF;
END$$;

-- Backfill inicial: marca como Pro quem já tem subscription ativa
UPDATE public.profiles p
SET is_pro = EXISTS (
  SELECT 1 FROM public.subscriptions s
  WHERE s.user_id = p.id AND s.status IN ('active', 'trialing')
);


-- ----------------------------------------------------------------------------
-- 2. Colunas pra rastrear grants manuais
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'granted_by_admin'
  ) THEN
    ALTER TABLE public.subscriptions ADD COLUMN granted_by_admin boolean NOT NULL DEFAULT false;
    ALTER TABLE public.subscriptions ADD COLUMN granted_by_admin_email text;
    ALTER TABLE public.subscriptions ADD COLUMN granted_at timestamptz;
  END IF;
END$$;


-- ----------------------------------------------------------------------------
-- 3. Trigger: sincroniza profiles.is_pro com subscriptions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_is_pro()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET is_pro = false WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;

  v_uid := NEW.user_id;
  UPDATE public.profiles
  SET is_pro = (NEW.status IN ('active', 'trialing'))
  WHERE id = v_uid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_sync_pro ON public.subscriptions;
CREATE TRIGGER subscriptions_sync_pro
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_is_pro();


-- ----------------------------------------------------------------------------
-- 4. RPC admin_grant_pro: admin concede Pro pra um user
--    p_duration_days = NULL → permanente (current_period_end = NULL)
--    p_duration_days >= 365 → plan='yearly'; senão 'monthly'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_pro(
  p_user_id uuid,
  p_duration_days int DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_end timestamptz;
  v_plan text;
  v_admin_email text;
  v_updated_rows int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Valida que o user existe
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_admin_email := auth.jwt() ->> 'email';
  v_end := CASE
    WHEN p_duration_days IS NULL THEN NULL
    ELSE now() + (p_duration_days || ' days')::interval
  END;
  v_plan := CASE
    WHEN p_duration_days IS NULL OR p_duration_days >= 365 THEN 'yearly'
    ELSE 'monthly'
  END;

  -- Tenta UPDATE primeiro (user já tem row em subscriptions)
  UPDATE public.subscriptions
  SET status = 'active',
      plan = v_plan,
      current_period_start = now(),
      current_period_end = v_end,
      cancel_at_period_end = false,
      granted_by_admin = true,
      granted_by_admin_email = v_admin_email,
      granted_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  -- Se não tinha row, insere
  IF v_updated_rows = 0 THEN
    INSERT INTO public.subscriptions (
      user_id, status, plan, current_period_start, current_period_end,
      granted_by_admin, granted_by_admin_email, granted_at
    )
    VALUES (
      p_user_id, 'active', v_plan, now(), v_end,
      true, v_admin_email, now()
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'status', 'active',
    'plan', v_plan,
    'current_period_end', v_end,
    'granted_by', v_admin_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_pro(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_pro(uuid, int) TO authenticated;


-- ----------------------------------------------------------------------------
-- 5. RPC admin_revoke_pro: admin remove Pro de um user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_revoke_pro(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.subscriptions
  SET status = 'canceled',
      cancel_at_period_end = true,
      updated_at = now()
  WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'updated_rows', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_pro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_pro(uuid) TO authenticated;


-- ============================================================================
-- FIM. Após rodar:
--   - profiles.is_pro disponível pra todos os queries (leitura rápida)
--   - Trigger mantém sincronia automaticamente
--   - Admin pode chamar admin_grant_pro(user_id, NULL) pra permanente
--                       admin_grant_pro(user_id, 30) pra 1 mês
--                       admin_grant_pro(user_id, 180) pra 6 meses
--                       admin_grant_pro(user_id, 365) pra 1 ano
--                       admin_revoke_pro(user_id) pra remover
-- ============================================================================
