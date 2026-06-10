-- ============================================================================
-- Maestro Pet — Carteira de exames & laudos (documentos de saúde do pet)
--
-- O tutor guarda exames, laudos, receitas, atestados e scans da carteirinha de
-- vacinação numa timeline por pet. Pura guarda/organização do que é DELE — sem
-- nenhum ato médico nem interpretação.
--
-- Privacidade (LGPD): os arquivos ficam num bucket PRIVADO `pet-documents`.
-- A tabela guarda só o caminho (file_path); o app gera signed URLs de curta
-- duração pra visualizar. RLS dupla: na tabela (owner) e no storage (pasta = uid).
--
-- Idempotente. Pré-req: tabela public.pets.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela pet_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  kind text NOT NULL DEFAULT 'exame'
    CHECK (kind IN ('exame','laudo','receita','atestado','vacina','outro')),
  title text NOT NULL,
  notes text,

  -- Arquivo no bucket privado pet-documents
  file_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'image' CHECK (file_type IN ('pdf','image')),
  file_name text,
  doc_date date
);

CREATE INDEX IF NOT EXISTS pet_documents_pet_idx
  ON public.pet_documents (pet_id, doc_date DESC NULLS LAST, created_at DESC);

ALTER TABLE public.pet_documents ENABLE ROW LEVEL SECURITY;

-- Só o dono gerencia os documentos do próprio pet
DROP POLICY IF EXISTS pet_documents_owner ON public.pet_documents;
CREATE POLICY pet_documents_owner ON public.pet_documents
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 2. Bucket privado pet-documents
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-documents', 'pet-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS do storage: o usuário só acessa objetos na própria pasta ({uid}/...).
-- createSignedUrl exige SELECT, então o owner precisa de todas as 4 operações.
DROP POLICY IF EXISTS pet_docs_select ON storage.objects;
CREATE POLICY pet_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS pet_docs_insert ON storage.objects;
CREATE POLICY pet_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS pet_docs_update ON storage.objects;
CREATE POLICY pet_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS pet_docs_delete ON storage.objects;
CREATE POLICY pet_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- FIM. Após rodar:
--   - App sobe arquivo pra pet-documents/{uid}/... e guarda file_path na tabela
--   - Lista via SELECT (RLS owner), visualiza via createSignedUrl (1h)
-- ============================================================================
