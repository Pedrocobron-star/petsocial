-- ============================================================================
-- Maestro Pet — Adoção responsável
--
-- Mural de pets pra adoção: ONGs e tutores anunciam, a comunidade descobre e
-- entra em contato (WhatsApp). Diferencial social forte + engajamento.
--
-- RLS:
--   - SELECT: todos os anúncios são públicos (anon + authenticated).
--   - WRITE: cada um gerencia só os PRÓPRIOS anúncios (owner_id = auth.uid()).
--
-- Fotos vão pro bucket público `posts` (já existente). Aqui guardamos só as URLs.
--
-- Idempotente. Pré-req: tabela auth.users.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.adoption_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','adopted','paused')),

  pet_name text NOT NULL,
  species text NOT NULL DEFAULT 'dog' CHECK (species IN ('dog','cat','other')),
  breed text,
  sex text CHECK (sex IN ('male','female','unknown')),
  age_label text,                 -- "Filhote", "2 anos", "Adulto", "Idoso"
  size text CHECK (size IN ('small','medium','large')),
  city text,
  uf text,
  description text NOT NULL,
  vaccinated boolean NOT NULL DEFAULT false,
  neutered boolean NOT NULL DEFAULT false,
  special_needs text,

  contact_name text,
  contact_phone text,             -- usado pro link wa.me
  image_urls text[] NOT NULL DEFAULT '{}',
  priority int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS adoption_listings_feed_idx
  ON public.adoption_listings (status, priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS adoption_listings_owner_idx
  ON public.adoption_listings (owner_id, created_at DESC);

ALTER TABLE public.adoption_listings ENABLE ROW LEVEL SECURITY;

-- SELECT: mural público.
-- ATENÇÃO: depois que adoption-approval-gate.sql roda, a visibilidade passa a
-- ser GATEADA (público vê só aprovados). Como não há migration runner e os
-- arquivos são aplicados à mão, este bloco é REPLAY-SAFE: se a coluna `approved`
-- já existe (gate aplicado), re-rodar este arquivo recria a policy RESTRITIVA —
-- nunca a `USING(true)`, que reabriria todos os anúncios pendentes.
DO $$
BEGIN
  DROP POLICY IF EXISTS adoption_select_all ON public.adoption_listings;
  DROP POLICY IF EXISTS adoption_select_visible ON public.adoption_listings;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'adoption_listings'
      AND column_name = 'approved'
  ) THEN
    -- Gate já aplicado: policy restritiva (público só aprovados; dono e admin veem tudo).
    CREATE POLICY adoption_select_visible ON public.adoption_listings
      FOR SELECT TO anon, authenticated
      USING (approved OR owner_id = auth.uid() OR public.is_admin());
  ELSE
    -- Instalação nova, antes do gate: mural totalmente público.
    CREATE POLICY adoption_select_all ON public.adoption_listings
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- WRITE: cada um gerencia os próprios anúncios
DROP POLICY IF EXISTS adoption_owner_write ON public.adoption_listings;
CREATE POLICY adoption_owner_write ON public.adoption_listings
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- FIM. Após rodar:
--   - Tutor/ONG cria anúncio em /adoption/new (fotos no bucket posts)
--   - Comunidade vê em /adoption, abre detalhe e fala no WhatsApp
-- ============================================================================
