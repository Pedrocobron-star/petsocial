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

-- SELECT: ofertas ativas pra todos; admin enxerga tudo (inclusive inativas)
DROP POLICY IF EXISTS offers_select_active ON public.offers;
CREATE POLICY offers_select_active ON public.offers
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

-- WRITE: só admin
DROP POLICY IF EXISTS offers_admin_all ON public.offers;
CREATE POLICY offers_admin_all ON public.offers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- RPC: incrementa o contador de cliques (fire-and-forget do app)
CREATE OR REPLACE FUNCTION public.track_offer_click(p_offer_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.offers SET clicks_count = clicks_count + 1 WHERE id = p_offer_id;
$$;

REVOKE ALL ON FUNCTION public.track_offer_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_offer_click(uuid) TO anon, authenticated;

-- ============================================================================
-- FIM. Após rodar:
--   - Admin cria ofertas em /admin/offers (RLS is_admin)
--   - Usuário vê ativas em /offers, copia cupom, abre cta_url (track_offer_click)
-- ============================================================================
