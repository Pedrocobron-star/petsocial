-- ============================================================================
-- Maestro Pet — Gate de aprovação dos anúncios de Adoção (moderação PROATIVA)
--
-- Antes: anúncio ia ao ar na hora e o admin removia depois (reativo).
-- Agora: TODO anúncio novo entra PENDENTE e só aparece no mural depois que o
-- admin aprova (em até 24h). Isso barra golpista/má-fé antes de ter audiência.
--
-- Segurança (repo é público): o cliente NÃO pode se auto-aprovar.
--   - INSERT força approved=false (trigger).
--   - UPDATE: só is_admin() pode mexer em `approved` (trigger reverte o resto).
--   - RLS SELECT: público vê só aprovados; o DONO vê os próprios pendentes;
--     o admin vê tudo.
--
-- Achados (lost_reports) NÃO entram aqui — por urgência vão ao ar na hora.
--
-- Idempotente. Pré-req: adoption.sql + adoption-moderation.sql + is_admin().
-- ORDEM IMPORTA: o backfill roda ANTES de criar o trigger, senão o próprio
-- trigger (que checa is_admin(), falso no editor SQL) reverteria o backfill.
-- ============================================================================

-- 1) Coluna do gate ----------------------------------------------------------
ALTER TABLE public.adoption_listings
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- 2) Backfill: anúncios que JÁ existem continuam visíveis (não esconder nada
--    que já estava no ar). Roda ANTES do trigger de baixo existir.
UPDATE public.adoption_listings SET approved = true WHERE approved = false;

-- 3) Índice da fila de moderação (pendentes primeiro)
CREATE INDEX IF NOT EXISTS adoption_listings_pending_idx
  ON public.adoption_listings (approved, created_at DESC)
  WHERE NOT approved;

-- 4) Trigger de gate ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adoption_enforce_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Todo anúncio nasce PENDENTE, não importa o que o client mande.
    NEW.approved := false;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Só o admin pode alterar `approved`. Qualquer outro update preserva o
    -- valor antigo (impede o dono de se auto-aprovar editando a linha).
    IF (NEW.approved IS DISTINCT FROM OLD.approved) AND NOT public.is_admin() THEN
      NEW.approved := OLD.approved;
    END IF;
    -- Anti-golpe: se o DONO edita o CONTEÚDO de um anúncio já aprovado, ele
    -- volta pra fila (re-gate). Senão dava pra aprovar limpo e depois trocar
    -- pra golpe. Trocar só o status (ex.: marcar adotado) NÃO re-gateia.
    IF NOT public.is_admin() AND (
         NEW.description   IS DISTINCT FROM OLD.description
      OR NEW.pet_name      IS DISTINCT FROM OLD.pet_name
      OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
      OR NEW.image_urls    IS DISTINCT FROM OLD.image_urls
      OR NEW.video_url     IS DISTINCT FROM OLD.video_url
    ) THEN
      NEW.approved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS adoption_enforce_approval_ins ON public.adoption_listings;
CREATE TRIGGER adoption_enforce_approval_ins
  BEFORE INSERT ON public.adoption_listings
  FOR EACH ROW EXECUTE FUNCTION public.adoption_enforce_approval();

DROP TRIGGER IF EXISTS adoption_enforce_approval_upd ON public.adoption_listings;
CREATE TRIGGER adoption_enforce_approval_upd
  BEFORE UPDATE ON public.adoption_listings
  FOR EACH ROW EXECUTE FUNCTION public.adoption_enforce_approval();

-- 5) RLS: visibilidade ------------------------------------------------------
-- Público vê só aprovados; dono vê os próprios (mesmo pendentes); admin vê tudo.
DROP POLICY IF EXISTS adoption_select_all ON public.adoption_listings;
DROP POLICY IF EXISTS adoption_select_visible ON public.adoption_listings;
CREATE POLICY adoption_select_visible ON public.adoption_listings
  FOR SELECT TO anon, authenticated
  USING (
    approved
    OR owner_id = auth.uid()
    OR public.is_admin()
  );

-- 6) RPC de aprovação (admin) -----------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_adoption_approved(p_id uuid, p_approved boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  -- Aprovar tambem limpa o flag anti-spam (sai da fila); reprovar mantem.
  UPDATE public.adoption_listings
    SET approved = p_approved,
        needs_review = CASE WHEN p_approved THEN false ELSE needs_review END
    WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_adoption_approved(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_adoption_approved(uuid, boolean) TO authenticated;

-- 7) is_admin() precisa ser EXECUTÁVEL pelo anon ----------------------------
-- A policy de SELECT chama public.is_admin() e vale pra 'anon' (visitante
-- deslogado). Sem este grant, o mural PÚBLICO quebra com "permission denied
-- for function is_admin()" ao avaliar a RLS linha-a-linha. É seguro: a função
-- só devolve boolean e, pra quem não tem JWT, retorna false.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- ============================================================================
-- FIM. Depois de rodar:
--   - Anúncios novos entram com approved=false (PENDENTES, fora do mural)
--   - O dono ainda vê o próprio anúncio (com selo "Em análise")
--   - Admin aprova em /admin/adoption -> approved=true -> vai pro mural
--   - Anúncios antigos continuam visíveis (backfill)
-- ============================================================================
