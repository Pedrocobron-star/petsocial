-- ============================================================================
-- Maestro Pet — Admin: Sponsored Posts + Analytics profundas
--
-- Adiciona tudo que falta pro painel admin ser completo:
--  - Posts patrocinados (totalmente customizáveis) misturados no feed
--  - Tracking de impression/click granular por post patrocinado
--  - Log de eventos do produto (analytics_events)
--  - Tracking de sessões (user_sessions) → DAU/WAU/MAU + tempo médio de uso
--  - Tabela `admins` + função `is_admin()` reutilizável
--  - RPCs admin: engagement overview, user list/detail, sponsored CRUD/métricas
--  - RPCs públicos (SECURITY DEFINER): log_event, start/end session,
--    track_sponsored_event — qualquer authenticated chama, mas inserts
--    são gated por RLS específica
--
-- Tudo idempotente (CREATE IF NOT EXISTS, OR REPLACE) → pode rodar várias
-- vezes sem quebrar nada.
--
-- Rodar inteiro no Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela `admins` — controle centralizado de quem é admin
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  email text PRIMARY KEY,
  role text NOT NULL DEFAULT 'super',
  added_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Só admin lê admins; ninguém escreve via API (usar SQL direto)
DROP POLICY IF EXISTS admins_select ON public.admins;
CREATE POLICY admins_select ON public.admins FOR SELECT
  USING ( (auth.jwt() ->> 'email') IN (SELECT email FROM public.admins) );

-- Pré-popular: pedrocobron@gmail.com como super admin
INSERT INTO public.admins (email, role, notes)
VALUES ('pedrocobron@gmail.com', 'super', 'Founder')
ON CONFLICT (email) DO NOTHING;

-- Função helper: is_admin() — checa se o usuário corrente é admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = (auth.jwt() ->> 'email')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. Tabela `sponsored_posts` — posts patrocinados customizáveis
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sponsored_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,  -- null = sem expiração

  -- Identidade do anunciante (tudo customizável)
  sponsor_name text NOT NULL,
  sponsor_handle text,  -- @marca (opcional, aparece como subtitulo)
  sponsor_avatar_url text,  -- foto de perfil customizada
  sponsor_verified boolean NOT NULL DEFAULT false,  -- selo azul

  -- Conteúdo do post
  content text,  -- caption
  media_url text NOT NULL,  -- imagem/vídeo principal
  media_kind text NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image','video')),

  -- CTA — barra clicável que leva pro site do anunciante
  cta_label text NOT NULL DEFAULT 'Saiba mais',
  cta_url text NOT NULL,

  -- Orquestração
  priority int NOT NULL DEFAULT 0,  -- maior = aparece primeiro
  target_audience jsonb NOT NULL DEFAULT '{}'::jsonb,  -- filtros futuros (species, region, plan)

  -- Métricas denormalizadas (cache via trigger pra evitar count() pesado)
  impressions_count int NOT NULL DEFAULT 0,
  clicks_count int NOT NULL DEFAULT 0,

  -- Admin notes (visível só no painel)
  notes text
);

CREATE INDEX IF NOT EXISTS sponsored_posts_active_idx
  ON public.sponsored_posts (active, starts_at, ends_at, priority DESC);

CREATE INDEX IF NOT EXISTS sponsored_posts_created_idx
  ON public.sponsored_posts (created_at DESC);

ALTER TABLE public.sponsored_posts ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated pode ler ativos (filtra no client)
DROP POLICY IF EXISTS sponsored_posts_select_all ON public.sponsored_posts;
CREATE POLICY sponsored_posts_select_all ON public.sponsored_posts
  FOR SELECT TO authenticated
  USING ( active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()) );

-- Admin: full access (CRUD + ver inativos/expirados)
DROP POLICY IF EXISTS sponsored_posts_admin_all ON public.sponsored_posts;
CREATE POLICY sponsored_posts_admin_all ON public.sponsored_posts
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- Trigger pra atualizar updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sponsored_posts_touch ON public.sponsored_posts;
CREATE TRIGGER sponsored_posts_touch
  BEFORE UPDATE ON public.sponsored_posts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- 3. Tabela `sponsored_post_events` — log granular de impression/click
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sponsored_post_events (
  id bigserial PRIMARY KEY,
  sponsored_post_id uuid NOT NULL REFERENCES public.sponsored_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('impression','click')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS spe_post_kind_idx
  ON public.sponsored_post_events (sponsored_post_id, event_kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS spe_occurred_idx
  ON public.sponsored_post_events (occurred_at DESC);

ALTER TABLE public.sponsored_post_events ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated pode logar (mas via RPC com rate limiting natural)
DROP POLICY IF EXISTS spe_insert ON public.sponsored_post_events;
CREATE POLICY spe_insert ON public.sponsored_post_events
  FOR INSERT TO authenticated
  WITH CHECK ( user_id IS NULL OR user_id = auth.uid() );

-- SELECT: só admin
DROP POLICY IF EXISTS spe_admin_select ON public.sponsored_post_events;
CREATE POLICY spe_admin_select ON public.sponsored_post_events
  FOR SELECT TO authenticated
  USING ( public.is_admin() );

-- Trigger: incrementa counter denormalizado em sponsored_posts
CREATE OR REPLACE FUNCTION public.spe_increment_counter() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_kind = 'impression' THEN
    UPDATE public.sponsored_posts SET impressions_count = impressions_count + 1
      WHERE id = NEW.sponsored_post_id;
  ELSIF NEW.event_kind = 'click' THEN
    UPDATE public.sponsored_posts SET clicks_count = clicks_count + 1
      WHERE id = NEW.sponsored_post_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spe_after_insert ON public.sponsored_post_events;
CREATE TRIGGER spe_after_insert
  AFTER INSERT ON public.sponsored_post_events
  FOR EACH ROW EXECUTE FUNCTION public.spe_increment_counter();


-- ----------------------------------------------------------------------------
-- 4. Tabela `analytics_events` — log central de eventos do produto
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  platform text,  -- 'web' | 'ios' | 'android'
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ae_occurred_idx ON public.analytics_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ae_user_idx ON public.analytics_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ae_event_idx ON public.analytics_events (event_name, occurred_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- INSERT: authenticated pode logar próprio evento
DROP POLICY IF EXISTS ae_insert ON public.analytics_events;
CREATE POLICY ae_insert ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK ( user_id IS NULL OR user_id = auth.uid() );

-- SELECT: só admin
DROP POLICY IF EXISTS ae_admin_select ON public.analytics_events;
CREATE POLICY ae_admin_select ON public.analytics_events
  FOR SELECT TO authenticated
  USING ( public.is_admin() );


-- ----------------------------------------------------------------------------
-- 5. Tabela `user_sessions` — tracking de tempo de uso
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds int,  -- preenchido quando ended_at é setado
  platform text,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()  -- pra detectar sessions que nunca foram fechadas
);

CREATE INDEX IF NOT EXISTS us_user_started_idx
  ON public.user_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS us_started_idx
  ON public.user_sessions (started_at DESC);
CREATE INDEX IF NOT EXISTS us_active_idx
  ON public.user_sessions (last_heartbeat_at DESC) WHERE ended_at IS NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- INSERT/UPDATE: só pra própria session
DROP POLICY IF EXISTS us_owner_write ON public.user_sessions;
CREATE POLICY us_owner_write ON public.user_sessions
  FOR ALL TO authenticated
  USING ( user_id = auth.uid() OR public.is_admin() )
  WITH CHECK ( user_id = auth.uid() OR public.is_admin() );

-- Coluna `last_seen_at` em profiles pra busca rápida de "ativo"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_seen_at timestamptz;
    CREATE INDEX profiles_last_seen_idx ON public.profiles (last_seen_at DESC);
  END IF;
END$$;


-- ----------------------------------------------------------------------------
-- 6. Storage bucket `sponsored` (público pra leitura, write só admin)
-- ----------------------------------------------------------------------------

-- Bucket pra mídias de posts patrocinados (avatar + imagem do post)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sponsored', 'sponsored', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: leitura pública
DROP POLICY IF EXISTS sponsored_storage_read ON storage.objects;
CREATE POLICY sponsored_storage_read ON storage.objects FOR SELECT
  USING ( bucket_id = 'sponsored' );

-- Policy: upload só pra admin
DROP POLICY IF EXISTS sponsored_storage_write ON storage.objects;
CREATE POLICY sponsored_storage_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK ( bucket_id = 'sponsored' AND public.is_admin() );

DROP POLICY IF EXISTS sponsored_storage_delete ON storage.objects;
CREATE POLICY sponsored_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING ( bucket_id = 'sponsored' AND public.is_admin() );


-- ============================================================================
-- 7. RPCs PÚBLICOS — qualquer authenticated chama
-- ============================================================================

-- ----------------------------------------------------------------------------
-- log_event: cliente chama pra logar eventos (track() do analytics.ts)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_event(
  p_event_name text,
  p_props jsonb DEFAULT '{}'::jsonb,
  p_platform text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_event_name IS NULL OR length(p_event_name) = 0 OR length(p_event_name) > 100 THEN
    RETURN; -- ignora silenciosamente
  END IF;
  INSERT INTO public.analytics_events (user_id, event_name, props, platform)
  VALUES (auth.uid(), p_event_name, COALESCE(p_props, '{}'::jsonb), p_platform);
END;
$$;

REVOKE ALL ON FUNCTION public.log_event(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_event(text, jsonb, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- start_session: cria nova session, retorna o uuid pro client
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_session(p_platform text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.user_sessions (user_id, platform)
  VALUES (auth.uid(), p_platform)
  RETURNING id INTO v_id;

  -- Marca profile como ativo agora
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_session(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_session(text) TO authenticated;


-- ----------------------------------------------------------------------------
-- end_session: fecha session, calcula duração
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_sessions
  SET ended_at = now(),
      duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (now() - started_at))::int),
      last_heartbeat_at = now()
  WHERE id = p_session_id AND user_id = auth.uid() AND ended_at IS NULL;

  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.end_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_session(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- heartbeat_session: mantém last_heartbeat_at atualizado (~1 min loop)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.heartbeat_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_sessions
  SET last_heartbeat_at = now()
  WHERE id = p_session_id AND user_id = auth.uid() AND ended_at IS NULL;
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.heartbeat_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.heartbeat_session(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- track_sponsored_event: registra impression/click
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_sponsored_event(
  p_post_id uuid,
  p_kind text,
  p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_kind NOT IN ('impression', 'click') THEN RETURN; END IF;
  INSERT INTO public.sponsored_post_events (sponsored_post_id, user_id, event_kind, meta)
  VALUES (p_post_id, auth.uid(), p_kind, COALESCE(p_meta, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.track_sponsored_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_sponsored_event(uuid, text, jsonb) TO authenticated;


-- ============================================================================
-- 8. RPCs ADMIN — todas check `is_admin()` no início
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_engagement_overview: KPIs de uso
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_engagement_overview()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH
    dau AS (
      SELECT COUNT(DISTINCT user_id) AS n FROM public.user_sessions
      WHERE started_at >= now() - interval '1 day'
    ),
    wau AS (
      SELECT COUNT(DISTINCT user_id) AS n FROM public.user_sessions
      WHERE started_at >= now() - interval '7 days'
    ),
    mau AS (
      SELECT COUNT(DISTINCT user_id) AS n FROM public.user_sessions
      WHERE started_at >= now() - interval '30 days'
    ),
    avg_session AS (
      SELECT COALESCE(AVG(duration_seconds), 0)::int AS s
      FROM public.user_sessions
      WHERE ended_at IS NOT NULL
        AND started_at >= now() - interval '7 days'
        AND duration_seconds BETWEEN 5 AND 14400  -- ignora sessions estranhas (<5s ou >4h)
    ),
    total_sessions AS (
      SELECT COUNT(*) AS n FROM public.user_sessions
      WHERE started_at >= now() - interval '7 days'
    ),
    total_time AS (
      SELECT COALESCE(SUM(duration_seconds), 0)::bigint AS s
      FROM public.user_sessions
      WHERE started_at >= now() - interval '7 days'
        AND duration_seconds IS NOT NULL
    ),
    signups_today AS (
      SELECT COUNT(*) AS n FROM auth.users WHERE created_at >= date_trunc('day', now())
    ),
    signups_7d AS (
      SELECT COUNT(*) AS n FROM auth.users WHERE created_at >= now() - interval '7 days'
    ),
    signups_30d AS (
      SELECT COUNT(*) AS n FROM auth.users WHERE created_at >= now() - interval '30 days'
    ),
    top_events AS (
      SELECT jsonb_agg(jsonb_build_object('event_name', event_name, 'count', cnt)
                       ORDER BY cnt DESC) AS arr
      FROM (
        SELECT event_name, COUNT(*) AS cnt
        FROM public.analytics_events
        WHERE occurred_at >= now() - interval '7 days'
        GROUP BY event_name
        ORDER BY cnt DESC
        LIMIT 15
      ) t
    ),
    sponsored AS (
      SELECT
        COUNT(*) FILTER (WHERE active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) AS active_count,
        COALESCE(SUM(impressions_count), 0)::int AS total_impressions,
        COALESCE(SUM(clicks_count), 0)::int AS total_clicks
      FROM public.sponsored_posts
    )
  SELECT jsonb_build_object(
    'dau', (SELECT n FROM dau),
    'wau', (SELECT n FROM wau),
    'mau', (SELECT n FROM mau),
    'avg_session_seconds_7d', (SELECT s FROM avg_session),
    'total_sessions_7d', (SELECT n FROM total_sessions),
    'total_time_seconds_7d', (SELECT s FROM total_time),
    'signups_today', (SELECT n FROM signups_today),
    'signups_7d', (SELECT n FROM signups_7d),
    'signups_30d', (SELECT n FROM signups_30d),
    'top_events_7d', COALESCE((SELECT arr FROM top_events), '[]'::jsonb),
    'sponsored', jsonb_build_object(
      'active_count', (SELECT active_count FROM sponsored),
      'total_impressions', (SELECT total_impressions FROM sponsored),
      'total_clicks', (SELECT total_clicks FROM sponsored)
    ),
    'generated_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_engagement_overview() TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_user_list: lista paginada com totais por usuário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_list(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL,
  p_sort text DEFAULT 'recent_signup'  -- 'recent_signup' | 'recent_active' | 'total_time'
) RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  last_seen_at timestamptz,
  total_minutes int,
  sessions_count int,
  pets_count int,
  posts_count int,
  is_pro boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      u.id,
      u.email::text,
      p.display_name,
      p.avatar_url,
      u.created_at,
      p.last_seen_at,
      COALESCE((SELECT (SUM(duration_seconds)/60)::int
                FROM public.user_sessions WHERE user_id = u.id), 0) AS total_minutes,
      COALESCE((SELECT COUNT(*)::int FROM public.user_sessions WHERE user_id = u.id), 0) AS sessions_count,
      COALESCE((SELECT COUNT(*)::int FROM public.pets WHERE owner_id = u.id), 0) AS pets_count,
      COALESCE((SELECT COUNT(*)::int FROM public.posts po
                JOIN public.pets pe ON pe.id = po.pet_id
                WHERE pe.owner_id = u.id), 0) AS posts_count,
      COALESCE((SELECT s.status = 'active'
                FROM public.subscriptions s WHERE s.user_id = u.id LIMIT 1), false) AS is_pro
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE
      (p_search IS NULL OR length(trim(p_search)) = 0
        OR u.email ILIKE '%' || p_search || '%'
        OR p.display_name ILIKE '%' || p_search || '%')
  )
  SELECT * FROM base
  ORDER BY
    CASE WHEN p_sort = 'recent_signup' THEN base.created_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'recent_active' THEN base.last_seen_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'total_time' THEN base.total_minutes END DESC NULLS LAST,
    base.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200))
  OFFSET GREATEST(0, p_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_list(int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_list(int, int, text, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_user_detail: drill-down completo de um usuário
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'user', (SELECT jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'bio', p.bio,
        'last_seen_at', p.last_seen_at
      ) FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = p_user_id),

    'pets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'species', species, 'breed', breed,
        'created_at', created_at
      ) ORDER BY created_at DESC) FROM public.pets WHERE owner_id = p_user_id), '[]'::jsonb),

    'stats', (SELECT jsonb_build_object(
        'sessions_count', (SELECT COUNT(*) FROM public.user_sessions WHERE user_id = p_user_id),
        'total_minutes', COALESCE((SELECT SUM(duration_seconds)/60
                                    FROM public.user_sessions WHERE user_id = p_user_id), 0),
        'total_events', (SELECT COUNT(*) FROM public.analytics_events WHERE user_id = p_user_id),
        'posts_count', (SELECT COUNT(*) FROM public.posts po
                        JOIN public.pets pe ON pe.id = po.pet_id WHERE pe.owner_id = p_user_id),
        'pets_count', (SELECT COUNT(*) FROM public.pets WHERE owner_id = p_user_id)
      )),

    'recent_sessions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'started_at', started_at, 'ended_at', ended_at,
        'duration_seconds', duration_seconds, 'platform', platform
      ) ORDER BY started_at DESC) FROM (
        SELECT * FROM public.user_sessions WHERE user_id = p_user_id
        ORDER BY started_at DESC LIMIT 20
      ) s), '[]'::jsonb),

    'recent_events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'event_name', event_name, 'props', props,
        'platform', platform, 'occurred_at', occurred_at
      ) ORDER BY occurred_at DESC) FROM (
        SELECT * FROM public.analytics_events WHERE user_id = p_user_id
        ORDER BY occurred_at DESC LIMIT 50
      ) e), '[]'::jsonb),

    'subscription', (SELECT row_to_json(s)::jsonb FROM public.subscriptions s
                     WHERE s.user_id = p_user_id LIMIT 1)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_sponsored_list: todos os posts patrocinados com métricas
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sponsored_list()
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  active boolean,
  starts_at timestamptz,
  ends_at timestamptz,
  sponsor_name text,
  sponsor_handle text,
  sponsor_avatar_url text,
  sponsor_verified boolean,
  content text,
  media_url text,
  media_kind text,
  cta_label text,
  cta_url text,
  priority int,
  impressions_count int,
  clicks_count int,
  ctr_pct numeric,
  notes text,
  status text  -- computed: 'active' | 'scheduled' | 'expired' | 'paused'
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    sp.id, sp.created_at, sp.updated_at, sp.active, sp.starts_at, sp.ends_at,
    sp.sponsor_name, sp.sponsor_handle, sp.sponsor_avatar_url, sp.sponsor_verified,
    sp.content, sp.media_url, sp.media_kind, sp.cta_label, sp.cta_url,
    sp.priority, sp.impressions_count, sp.clicks_count,
    CASE WHEN sp.impressions_count > 0
         THEN ROUND((sp.clicks_count::numeric / sp.impressions_count) * 100, 2)
         ELSE 0 END AS ctr_pct,
    sp.notes,
    CASE
      WHEN NOT sp.active THEN 'paused'
      WHEN sp.starts_at > now() THEN 'scheduled'
      WHEN sp.ends_at IS NOT NULL AND sp.ends_at <= now() THEN 'expired'
      ELSE 'active'
    END AS status
  FROM public.sponsored_posts sp
  ORDER BY sp.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sponsored_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sponsored_list() TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_sponsored_metrics: métricas detalhadas de UM post
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_sponsored_metrics(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH
    totals AS (
      SELECT
        impressions_count,
        clicks_count,
        CASE WHEN impressions_count > 0
             THEN ROUND((clicks_count::numeric / impressions_count) * 100, 2)
             ELSE 0 END AS ctr_pct
      FROM public.sponsored_posts WHERE id = p_post_id
    ),
    by_day AS (
      SELECT jsonb_agg(jsonb_build_object(
        'day', d::date,
        'impressions', impr,
        'clicks', clk
      ) ORDER BY d) AS arr
      FROM (
        SELECT
          date_trunc('day', occurred_at) AS d,
          COUNT(*) FILTER (WHERE event_kind = 'impression') AS impr,
          COUNT(*) FILTER (WHERE event_kind = 'click') AS clk
        FROM public.sponsored_post_events
        WHERE sponsored_post_id = p_post_id
          AND occurred_at >= now() - interval '30 days'
        GROUP BY d
      ) t
    ),
    unique_users AS (
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE event_kind = 'impression') AS uniq_impr,
        COUNT(DISTINCT user_id) FILTER (WHERE event_kind = 'click') AS uniq_clk
      FROM public.sponsored_post_events
      WHERE sponsored_post_id = p_post_id
    )
  SELECT jsonb_build_object(
    'total_impressions', (SELECT impressions_count FROM totals),
    'total_clicks', (SELECT clicks_count FROM totals),
    'ctr_pct', (SELECT ctr_pct FROM totals),
    'unique_users_impressions', (SELECT uniq_impr FROM unique_users),
    'unique_users_clicks', (SELECT uniq_clk FROM unique_users),
    'by_day_30d', COALESCE((SELECT arr FROM by_day), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_sponsored_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_sponsored_metrics(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_top_events: top eventos com filtro de período
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_top_events(p_days int DEFAULT 7, p_limit int DEFAULT 30)
RETURNS TABLE (event_name text, total bigint, unique_users bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ae.event_name,
    COUNT(*)::bigint AS total,
    COUNT(DISTINCT ae.user_id)::bigint AS unique_users
  FROM public.analytics_events ae
  WHERE ae.occurred_at >= now() - (p_days || ' days')::interval
  GROUP BY ae.event_name
  ORDER BY total DESC
  LIMIT GREATEST(1, LEAST(p_limit, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_top_events(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_top_events(int, int) TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_engagement_by_hour: heatmap por hora do dia (últimos 30 dias)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_engagement_by_hour()
RETURNS TABLE (hour_of_day int, sessions bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM started_at)::int AS hour_of_day,
    COUNT(*)::bigint AS sessions
  FROM public.user_sessions
  WHERE started_at >= now() - interval '30 days'
  GROUP BY hour_of_day
  ORDER BY hour_of_day;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_engagement_by_hour() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_engagement_by_hour() TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_retention: D1, D7, D30 retention dos signups dos últimos 60d
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_retention()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH
    cohort AS (
      SELECT u.id, u.created_at::date AS cohort_day
      FROM auth.users u
      WHERE u.created_at >= now() - interval '60 days'
    ),
    activity AS (
      SELECT DISTINCT user_id, started_at::date AS active_day
      FROM public.user_sessions
      WHERE started_at >= now() - interval '60 days'
    ),
    d1 AS (
      SELECT COUNT(DISTINCT c.id)::numeric AS retained, COUNT(DISTINCT c.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = c.id AND a.active_day = c.cohort_day + 1)
      )::numeric AS d1_active
      FROM cohort c WHERE c.cohort_day <= now()::date - 2
    ),
    d7 AS (
      SELECT COUNT(DISTINCT c.id)::numeric AS retained, COUNT(DISTINCT c.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = c.id
                      AND a.active_day BETWEEN c.cohort_day + 7 AND c.cohort_day + 8)
      )::numeric AS d7_active
      FROM cohort c WHERE c.cohort_day <= now()::date - 8
    ),
    d30 AS (
      SELECT COUNT(DISTINCT c.id)::numeric AS retained, COUNT(DISTINCT c.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM activity a WHERE a.user_id = c.id
                      AND a.active_day BETWEEN c.cohort_day + 30 AND c.cohort_day + 31)
      )::numeric AS d30_active
      FROM cohort c WHERE c.cohort_day <= now()::date - 31
    )
  SELECT jsonb_build_object(
    'd1_pct', COALESCE((SELECT CASE WHEN retained > 0 THEN ROUND((d1_active/retained)*100, 1) ELSE 0 END FROM d1), 0),
    'd7_pct', COALESCE((SELECT CASE WHEN retained > 0 THEN ROUND((d7_active/retained)*100, 1) ELSE 0 END FROM d7), 0),
    'd30_pct', COALESCE((SELECT CASE WHEN retained > 0 THEN ROUND((d30_active/retained)*100, 1) ELSE 0 END FROM d30), 0),
    'cohort_size_60d', (SELECT COUNT(*) FROM cohort)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_retention() TO authenticated;


-- ----------------------------------------------------------------------------
-- admin_recent_activity: feed de eventos recentes do app (debugging visual)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recent_activity(p_limit int DEFAULT 100)
RETURNS TABLE (
  id bigint,
  user_id uuid,
  email text,
  display_name text,
  event_name text,
  props jsonb,
  platform text,
  occurred_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    ae.id, ae.user_id,
    u.email::text,
    p.display_name,
    ae.event_name, ae.props, ae.platform, ae.occurred_at
  FROM public.analytics_events ae
  LEFT JOIN auth.users u ON u.id = ae.user_id
  LEFT JOIN public.profiles p ON p.id = ae.user_id
  ORDER BY ae.occurred_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recent_activity(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recent_activity(int) TO authenticated;


-- ============================================================================
-- FIM. Rodar tudo de uma vez no Supabase SQL Editor.
--
-- Após rodar:
--  1. Bucket `sponsored` aparece em Storage (público)
--  2. Sua conta (pedrocobron@gmail.com) já está como admin
--  3. App pode chamar log_event, start_session, etc, sem erro
--  4. Admin Dashboard pode chamar todas as RPCs admin_*
-- ============================================================================
