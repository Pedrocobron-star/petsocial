-- ============================================================================
-- Maestro Pet — Moderacao de anuncios de adocao
--
-- Objetivo: marcar automaticamente anuncios suspeitos (link externo, descricao
-- muito curta, possivel VENDA de animal) pra revisao do admin, sem esconder o
-- anuncio do mural (moderacao reativa: vai ao ar na hora, admin revisa a fila e
-- remove o que violar). O flag e' calculado por TRIGGER no servidor, entao nao
-- da' pra burlar pelo client.
--
-- review_reason guarda um CODIGO ASCII (a UI traduz pra PT-BR com acento):
--   'external_link' | 'too_short' | 'possible_sale'
--
-- Idempotente. Pre-req: adoption.sql + is_admin() (admin-sponsored-and-analytics.sql).
-- ============================================================================

-- 1) Colunas de moderacao -----------------------------------------------------
ALTER TABLE public.adoption_listings
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.adoption_listings
  ADD COLUMN IF NOT EXISTS review_reason text;

-- Fila de moderacao: so indexa os que precisam de revisao (index parcial enxuto)
CREATE INDEX IF NOT EXISTS adoption_listings_review_idx
  ON public.adoption_listings (needs_review, created_at DESC)
  WHERE needs_review;

-- 2) Heuristica anti-spam (server-side, nao burlavel) -------------------------
CREATE OR REPLACE FUNCTION public.adoption_flag_suspicious()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_desc text := coalesce(new.description, '');
BEGIN
  new.needs_review := false;
  new.review_reason := null;

  IF v_desc ~* '(https?://|www\.|wa\.me/|t\.me/|bit\.ly|tinyurl|encurta)' THEN
    new.needs_review := true;
    new.review_reason := 'external_link';
  ELSIF char_length(btrim(v_desc)) < 20 THEN
    new.needs_review := true;
    new.review_reason := 'too_short';
  ELSIF v_desc ~* 'r\$\s*[0-9]' THEN
    new.needs_review := true;
    new.review_reason := 'possible_sale';
  END IF;

  RETURN new;
END;
$$;

-- INSERT: sempre avalia
DROP TRIGGER IF EXISTS adoption_flag_suspicious_ins ON public.adoption_listings;
CREATE TRIGGER adoption_flag_suspicious_ins
  BEFORE INSERT ON public.adoption_listings
  FOR EACH ROW EXECUTE FUNCTION public.adoption_flag_suspicious();

-- UPDATE: so reavalia quando a descricao muda (assim a aprovacao do admin, que
-- mexe so em needs_review, NAO dispara o re-flag).
DROP TRIGGER IF EXISTS adoption_flag_suspicious_upd ON public.adoption_listings;
CREATE TRIGGER adoption_flag_suspicious_upd
  BEFORE UPDATE OF description ON public.adoption_listings
  FOR EACH ROW
  WHEN (new.description IS DISTINCT FROM old.description)
  EXECUTE FUNCTION public.adoption_flag_suspicious();

-- 3) RPCs de admin ------------------------------------------------------------
-- Aprovar (limpa o flag) ou re-sinalizar manualmente.
CREATE OR REPLACE FUNCTION public.admin_set_adoption_review(p_id uuid, p_needs_review boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.adoption_listings
    SET needs_review = p_needs_review
    WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_adoption_review(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_adoption_review(uuid, boolean) TO authenticated;

-- Remover anuncio (viola regras). Retorna as URLs das fotos pra o client limpar
-- o bucket `posts` (best-effort). Deleta a linha.
CREATE OR REPLACE FUNCTION public.admin_delete_adoption(p_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_urls text[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT coalesce(image_urls, '{}') INTO v_urls
    FROM public.adoption_listings WHERE id = p_id;
  DELETE FROM public.adoption_listings WHERE id = p_id;
  RETURN coalesce(v_urls, '{}');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_adoption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_adoption(uuid) TO authenticated;

-- 4) Backfill: reavalia anuncios ja existentes -------------------------------
-- (computa direto; mexe so em needs_review/review_reason, sem tocar description,
--  entao nao dispara o trigger de UPDATE)
UPDATE public.adoption_listings SET
  needs_review = CASE
    WHEN description ~* '(https?://|www\.|wa\.me/|t\.me/|bit\.ly|tinyurl|encurta)' THEN true
    WHEN char_length(btrim(coalesce(description, ''))) < 20 THEN true
    WHEN description ~* 'r\$\s*[0-9]' THEN true
    ELSE false
  END,
  review_reason = CASE
    WHEN description ~* '(https?://|www\.|wa\.me/|t\.me/|bit\.ly|tinyurl|encurta)' THEN 'external_link'
    WHEN char_length(btrim(coalesce(description, ''))) < 20 THEN 'too_short'
    WHEN description ~* 'r\$\s*[0-9]' THEN 'possible_sale'
    ELSE null
  END;

-- ============================================================================
-- FIM. Apos rodar:
--   - Novos anuncios suspeitos entram com needs_review = true automaticamente
--   - Admin ve a fila em /admin/adoption e aprova ou remove
-- ============================================================================
