-- ============================================================================
-- Maestro Pet — SinPatinhas (RG federal) + Alertas de Recall
--
-- Feature 1: SinPatinhas
--   RG federal de cães/gatos lançado pelo MMA em 17/04/2025 (Decreto 12.439).
--   Grátis, voluntário, QR code anexável à coleira. Como NÃO há API pública,
--   guardamos o número de registro e exibimos na carteirinha com link oficial.
--   → adiciona pets.sinpatinhas_id
--
-- Feature 2: Alertas de Recall
--   Tabela curada pelo admin (de Anvisa/MAPA/fabricantes/comunidade). O app
--   cruza a marca/produto do recall com o que o tutor registra (ração ativa,
--   antiparasitário, medicação) e mostra alerta se bater.
--   → cria public.recalls + RLS + admin_recalls_list()
--
-- Idempotente — pode rodar várias vezes.
-- Pré-req: admin-sponsored-and-analytics.sql (usa is_admin()).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SinPatinhas — coluna em pets
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'sinpatinhas_id'
  ) THEN
    ALTER TABLE public.pets ADD COLUMN sinpatinhas_id text;
  END IF;
END$$;


-- ----------------------------------------------------------------------------
-- 2. Tabela recalls
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  active boolean NOT NULL DEFAULT true,

  -- Classificação
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  category text NOT NULL DEFAULT 'racao'
    CHECK (category IN ('racao','petisco','medicamento','antipulga','acessorio','outro')),

  -- Matching: o que cruza com os produtos do tutor
  brand text NOT NULL,              -- marca afetada (usado pra match, ex: "Golden")
  product_name text,                -- produto específico (ex: "Golden Formula Frango")

  -- Conteúdo do alerta
  title text NOT NULL,              -- "Recall: Ração X lote Y"
  description text NOT NULL,        -- o que aconteceu + o que o tutor deve fazer
  affected_lots text,              -- lotes/validades afetados (texto livre)

  -- Procedência (credibilidade)
  source text NOT NULL DEFAULT 'Fabricante'
    CHECK (source IN ('Anvisa','MAPA','Fabricante','Imprensa','Comunidade')),
  source_url text,                  -- link oficial pra verificar
  published_at timestamptz,        -- quando foi anunciado oficialmente

  -- Escopo
  region text,                      -- null = nacional; ex: "SP", "Centro-Oeste"

  notes text                        -- nota interna do admin
);

CREATE INDEX IF NOT EXISTS recalls_active_idx ON public.recalls (active, published_at DESC);
CREATE INDEX IF NOT EXISTS recalls_brand_idx ON public.recalls (lower(brand));

ALTER TABLE public.recalls ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer authenticated lê ativos (matching é client-side)
DROP POLICY IF EXISTS recalls_select_active ON public.recalls;
CREATE POLICY recalls_select_active ON public.recalls
  FOR SELECT TO authenticated
  USING ( active = true );

-- Admin: full access (ver inativos + CRUD)
DROP POLICY IF EXISTS recalls_admin_all ON public.recalls;
CREATE POLICY recalls_admin_all ON public.recalls
  FOR ALL TO authenticated
  USING ( public.is_admin() )
  WITH CHECK ( public.is_admin() );

-- Trigger updated_at (reusa touch_updated_at de admin-sponsored-and-analytics.sql)
DROP TRIGGER IF EXISTS recalls_touch ON public.recalls;
CREATE TRIGGER recalls_touch
  BEFORE UPDATE ON public.recalls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- ----------------------------------------------------------------------------
-- 3. RPC admin_recalls_list — lista TODOS (ativos + inativos) pro painel
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recalls_list()
RETURNS SETOF public.recalls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT * FROM public.recalls ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recalls_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recalls_list() TO authenticated;


-- ============================================================================
-- FIM. Após rodar:
--   - pets.sinpatinhas_id disponível (form de edição + carteirinha)
--   - public.recalls criada — admin cria via /admin/recalls/new
--   - App cruza recalls ativos com ração/antiparasitário/medicação do tutor
-- ============================================================================
