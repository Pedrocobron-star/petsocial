-- ============================================================================
-- Maestro Pet — Clube de vantagens (ofertas dos patrocinadores)
--
-- Segundo motor de receita além do anúncio no feed: marcas/petshops pagam pra
-- aparecer com cupom/desconto numa aba dedicada. O usuário vê as ofertas ativas,
-- copia o cupom e vai pro site do parceiro.
--
-- RLS:
--   - SELECT: ofertas ativas pra qualquer um (anon/authenticated); admin vê tudo.
--   - WRITE: só admin (is_admin()).
--   - track_offer_click: incrementa clicks_count (qualquer authenticated/anon).
--
-- Idempotente. Pré-req: função public.is_admin() (admin-sponsored-and-analytics.sql).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,

  title text NOT NULL,
  brand text NOT NULL,
  description text,
  discount_label text,          -- "20% OFF", "Frete grátis", "Leve 3 pague 2"
  coupon_code text,
  cta_url text NOT NULL,
  cta_label text NOT NULL DEFAULT 'Aproveitar',
  category text NOT NULL DEFAULT 'outro'
    CHECK (category IN ('racao','petshop','saude','servico','acessorio','outro')),
  image_url text,
  valid_until date,
  priority int NOT NULL DEFAULT 0,
  clicks_count int NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS offers_active_idx
  ON public.offers (active, priority DESC, created_at DESC);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- SELECT direto na tabela = SÓ admin (notes/created_by são internos; RLS é
-- row-level, então liberar a linha vazaria esses campos). O usuário comum lê
-- via offers_active() (SECURITY DEFINER, abaixo). Target SÓ `authenticated`
-- porque is_admin() não tem EXECUTE pra anon (senão a policy ERRA, 42501).
DROP POLICY IF EXISTS offers_select_active ON public.offers;
CREATE POLICY offers_select_active ON public.offers
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- WRITE: só admin
DROP POLICY IF EXISTS offers_admin_all ON public.offers;
CREATE POLICY offers_admin_all ON public.offers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Leitura pública das ofertas ativas — só colunas públicas (sem notes/
-- created_by/clicks_count). SECURITY DEFINER pra contornar a RLS admin-only.
CREATE OR REPLACE FUNCTION public.offers_active()
RETURNS TABLE (
  id uuid, created_at timestamptz, active boolean, title text, brand text,
  description text, discount_label text, coupon_code text, cta_url text,
  cta_label text, category text, image_url text, valid_until date, priority int
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT o.id, o.created_at, o.active, o.title, o.brand, o.description,
         o.discount_label, o.coupon_code, o.cta_url, o.cta_label, o.category,
         o.image_url, o.valid_until, o.priority
  FROM public.offers o
  WHERE o.active = true
    AND (o.valid_until IS NULL OR o.valid_until >= current_date)
  ORDER BY o.priority DESC, o.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.offers_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offers_active() TO anon, authenticated;

-- Dedup de clique por (oferta, usuário, dia) — contador não-inflável.
CREATE TABLE IF NOT EXISTS public.offer_clicks (
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, user_id, day)
);
ALTER TABLE public.offer_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS offer_clicks_admin_read ON public.offer_clicks;
CREATE POLICY offer_clicks_admin_read ON public.offer_clicks
  FOR SELECT TO authenticated USING (public.is_admin());

-- RPC: conta clique 1x por usuário/oferta/dia (a aba /offers é logada).
CREATE OR REPLACE FUNCTION public.track_offer_click(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.offer_clicks (offer_id, user_id, day)
  VALUES (p_offer_id, v_uid, current_date)
  ON CONFLICT (offer_id, user_id, day) DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  IF v_new THEN
    UPDATE public.offers SET clicks_count = clicks_count + 1 WHERE id = p_offer_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.track_offer_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_offer_click(uuid) TO authenticated;

-- ============================================================================
-- FIM. Após rodar:
--   - Admin cria ofertas em /admin/offers (RLS is_admin)
--   - Usuário vê ativas em /offers, copia cupom, abre cta_url (track_offer_click)
-- ============================================================================
