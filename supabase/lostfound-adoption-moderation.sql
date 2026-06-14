-- ============================================================================
-- Maestro Pet — Moderação de Achados/Perdidos + Adoção via denúncias
--
-- Fecha os buracos do app Adoção/Achados:
--   1) Libera 'adoption_listing' no CHECK da tabela `reports` (antes só ia até
--      'lost_report') — agora dá pra DENUNCIAR um anúncio de adoção.
--   2) admin_delete_lost_report(): admin remove um reporte de Achados abusivo
--      (não existia RPC pra isso) — resolve as denúncias e devolve as URLs de
--      mídia pro client limpar o bucket.
--   3) admin_delete_adoption() REDEFINIDA pra também resolver as denúncias do
--      alvo (status -> 'actioned') e limpar o vídeo, igual aos deletes de post.
--
-- Idempotente. Pré-req: schema.sql (reports, lost_reports) + adoption.sql +
-- adoption-moderation.sql + is_admin().
-- ============================================================================

-- 1) CHECK de reports.target_kind: + 'adoption_listing' --------------------
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_target_kind_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_target_kind_check
  CHECK (target_kind IN ('post','comment','user','pet','message','lost_report','adoption_listing'));

-- 2) Remover reporte de Achados (admin) ------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_lost_report(p_id uuid)
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

  -- Junta todas as mídias (image_urls + photo_url legado + video_url) e tira nulos.
  SELECT array_remove(
           coalesce(image_urls, '{}') || array[photo_url] || array[video_url],
           NULL
         )
    INTO v_urls
    FROM public.lost_reports
    WHERE id = p_id;

  -- Resolve as denúncias deste alvo (saem da fila aberta).
  UPDATE public.reports
    SET status = 'actioned'
    WHERE target_kind = 'lost_report' AND target_id = p_id AND status IN ('open', 'reviewed');

  DELETE FROM public.lost_reports WHERE id = p_id;

  RETURN coalesce(v_urls, '{}');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_lost_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_lost_report(uuid) TO authenticated;

-- 3) Redefinir admin_delete_adoption: também resolve denúncias + limpa vídeo --
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

  SELECT array_remove(coalesce(image_urls, '{}') || array[video_url], NULL)
    INTO v_urls
    FROM public.adoption_listings
    WHERE id = p_id;

  UPDATE public.reports
    SET status = 'actioned'
    WHERE target_kind = 'adoption_listing' AND target_id = p_id AND status IN ('open', 'reviewed');

  DELETE FROM public.adoption_listings WHERE id = p_id;

  RETURN coalesce(v_urls, '{}');
END;
$$;
REVOKE ALL ON FUNCTION public.admin_delete_adoption(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_adoption(uuid) TO authenticated;

-- ============================================================================
-- FIM. Depois de rodar:
--   - Usuários podem denunciar anúncios de adoção (não só de Achados)
--   - Admin remove Achados/Adoção abusivos em /admin/reports; as denúncias do
--     alvo viram "tratadas" e o client limpa as fotos órfãs do bucket
-- ============================================================================
