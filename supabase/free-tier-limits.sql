-- ============================================================================
-- Maestro Pet — Free tier: limite de 1 post por dia
--
-- Free → 1 post/dia (qualquer pet do user).
-- Pro  → ilimitado.
--
-- Conta no SERVER (não dá pra burlar no client). Toda a checagem é feita pelo
-- backend via RPC; o client mostra paywall ANTES do submit pra UX boa.
--
-- Por que server-side enforcement?
--  - Usuário com cliente customizado poderia ignorar a checagem JS.
--  - Trigger BEFORE INSERT bloqueia mesmo se o front falhar em chamar.
--
-- Idempotente — pode rodar várias vezes sem quebrar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- count_my_posts_today: usado pelo client pra mostrar contador / paywall
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_my_posts_today()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.posts po
  JOIN public.pets pe ON pe.id = po.pet_id
  WHERE pe.owner_id = auth.uid()
    AND po.created_at >= date_trunc('day', now())
    AND po.reposted_from IS NULL;  -- reposts não contam pro limite
$$;

REVOKE ALL ON FUNCTION public.count_my_posts_today() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_my_posts_today() TO authenticated;


-- ----------------------------------------------------------------------------
-- ⚠️ is_user_pro: DEFINICAO CANONICA em schema.sql (linhas ~1158). NAO redefinir
-- aqui. A versao que vivia neste arquivo so contava status='active' e EXCLUIA
-- 'trialing' (bug: tutor em trial de Pro virava free e era barrado pela trigger
-- de limite de post abaixo). A canonica conta status in ('active','trialing'),
-- batendo com sync_profile_is_pro (admin-grant-pro.sql). Reaplicar esta versao
-- reverteria a regra. Ver schema.sql.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- enforce_free_post_limit: trigger BEFORE INSERT que bloqueia o 2º post do dia
-- pra free users. Pro passa direto. Admin sempre passa.
--
-- Reposts não contam — usuário ainda pode repostar quanto quiser.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_free_post_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner uuid;
  v_count int;
  v_email text;
BEGIN
  -- Reposts são livres
  IF NEW.reposted_from IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Descobre o dono via pet
  SELECT owner_id INTO v_owner FROM public.pets WHERE id = NEW.pet_id;
  IF v_owner IS NULL THEN
    RETURN NEW; -- safety: deixa o INSERT falhar pela FK depois
  END IF;

  -- Admin sempre passa (pra testar)
  v_email := auth.jwt() ->> 'email';
  IF EXISTS (SELECT 1 FROM public.admins WHERE email = v_email) THEN
    RETURN NEW;
  END IF;

  -- Pro passa direto (active OU trialing — bate com is_user_pro() canônica;
  -- antes só contava 'active' e barrava quem estava em trial de Pro).
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = v_owner AND status IN ('active', 'trialing')
  ) THEN
    RETURN NEW;
  END IF;

  -- Free: conta posts de hoje (excluindo reposts)
  SELECT COUNT(*) INTO v_count
  FROM public.posts po
  JOIN public.pets pe ON pe.id = po.pet_id
  WHERE pe.owner_id = v_owner
    AND po.created_at >= date_trunc('day', now())
    AND po.reposted_from IS NULL;

  IF v_count >= 1 THEN
    RAISE EXCEPTION 'free_post_limit_reached'
      USING HINT = 'Plano gratuito permite 1 post por dia. Vire Pet Pro pra postar sem limites.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_enforce_free_limit ON public.posts;
CREATE TRIGGER posts_enforce_free_limit
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_post_limit();


-- ============================================================================
-- FIM. Após rodar:
--  - Free user: 1º post do dia ok, 2º retorna erro 'free_post_limit_reached'
--  - Pro user: posta à vontade
--  - Admin (pedrocobron@gmail.com): posta à vontade (pra testar)
--  - Repost: sempre livre, não conta pro limite
-- ============================================================================
