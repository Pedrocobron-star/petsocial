-- ============================================================================
-- Maestro Pet — Endosso veterinário (co-assinatura da carteirinha/prontuário)
--
-- Fluxo:
--   1. Tutor (autenticado) gera um pedido de endosso → recebe um token único
--   2. Tutor manda o link /endorse/{token} pro vet (WhatsApp/email/QR)
--   3. Vet abre o link SEM LOGIN → vê resumo do pet + vacinas
--   4. Vet preenche nome + CRMV + estado → endossa
--   5. A carteirinha passa a mostrar "✓ Endossado por Dra. X · CRMV-SP 12345"
--
-- IMPORTANTE — framing honesto:
--   Isto é um ENDOSSO (vet confirma os dados e se identifica via CRMV), NÃO uma
--   assinatura digital ICP-Brasil. Adiciona credibilidade real (CRMV verificável
--   + nome + timestamp), mas não tem a mesma validade legal de uma assinatura
--   certificada. A integração ICP-Brasil completa fica como upgrade futuro.
--
-- Como o vet é ANÔNIMO, o acesso é via RPCs SECURITY DEFINER liberadas pro role
-- `anon`, com o token (uuid, 122 bits) fazendo o papel de autenticação.
--
-- Idempotente. Pré-req: nenhum (standalone).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela vet_endorsements
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vet_endorsements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Token público (uuid = 122 bits de entropia, inadivinhável)
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,

  scope text NOT NULL DEFAULT 'carteirinha'
    CHECK (scope IN ('carteirinha','vacinas','prontuario')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','signed','revoked')),

  -- Preenchido pelo vet ao assinar
  vet_name text,
  crmv_number text,
  crmv_state text,
  vet_notes text,
  signed_at timestamptz
);

CREATE INDEX IF NOT EXISTS vet_endorsements_pet_idx
  ON public.vet_endorsements (pet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vet_endorsements_token_idx
  ON public.vet_endorsements (token);

ALTER TABLE public.vet_endorsements ENABLE ROW LEVEL SECURITY;

-- Tutor (dono do pet) gerencia seus próprios pedidos de endosso
DROP POLICY IF EXISTS vet_endorsements_owner ON public.vet_endorsements;
CREATE POLICY vet_endorsements_owner ON public.vet_endorsements
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid())
  );


-- ----------------------------------------------------------------------------
-- 2. RPC create_endorsement_request — tutor gera o pedido, recebe o token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_endorsement_request(
  p_pet_id uuid,
  p_scope text DEFAULT 'carteirinha'
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_token text;
BEGIN
  -- Só o dono do pet pode pedir endosso dele
  IF NOT EXISTS (
    SELECT 1 FROM public.pets WHERE id = p_pet_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vet_endorsements (pet_id, requested_by, scope)
  VALUES (p_pet_id, auth.uid(), COALESCE(p_scope, 'carteirinha'))
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_endorsement_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_endorsement_request(uuid, text) TO authenticated;


-- ----------------------------------------------------------------------------
-- 3. RPC endorse_fetch — VET ANÔNIMO busca o resumo do pet pelo token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.endorse_fetch(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result jsonb;
  v_pet_id uuid;
  v_status text;
BEGIN
  SELECT pet_id, status INTO v_pet_id, v_status
  FROM public.vet_endorsements WHERE token = p_token;

  IF v_pet_id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT jsonb_build_object(
    'found', true,
    'status', v_status,
    'scope', (SELECT scope FROM public.vet_endorsements WHERE token = p_token),
    'pet', (SELECT jsonb_build_object(
        'name', name, 'species', species, 'breed', breed, 'birthdate', birthdate,
        'microchip_number', microchip_number, 'rga_number', rga_number,
        'sinpatinhas_id', sinpatinhas_id
      ) FROM public.pets WHERE id = v_pet_id),
    'tutor', (SELECT jsonb_build_object('display_name', pr.display_name)
              FROM public.pets pe JOIN public.profiles pr ON pr.id = pe.owner_id
              WHERE pe.id = v_pet_id),
    'vaccines', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name', name, 'applied_at', applied_at, 'next_dose_at', next_dose_at, 'vet_name', vet_name
      ) ORDER BY applied_at DESC)
      FROM public.vaccinations WHERE pet_id = v_pet_id), '[]'::jsonb),
    -- Se já assinado, devolve os dados do endosso
    'endorsement', (SELECT jsonb_build_object(
        'vet_name', vet_name, 'crmv_number', crmv_number, 'crmv_state', crmv_state,
        'signed_at', signed_at
      ) FROM public.vet_endorsements WHERE token = p_token AND status = 'signed')
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.endorse_fetch(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.endorse_fetch(text) TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. RPC endorse_submit — VET ANÔNIMO registra o endosso
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.endorse_submit(
  p_token text,
  p_vet_name text,
  p_crmv_number text,
  p_crmv_state text,
  p_vet_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.vet_endorsements WHERE token = p_token;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_' || v_status);
  END IF;

  -- Validação mínima
  IF p_vet_name IS NULL OR length(trim(p_vet_name)) < 2
     OR p_crmv_number IS NULL OR length(trim(p_crmv_number)) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_data');
  END IF;

  UPDATE public.vet_endorsements
  SET status = 'signed',
      vet_name = trim(p_vet_name),
      crmv_number = trim(p_crmv_number),
      crmv_state = NULLIF(trim(COALESCE(p_crmv_state, '')), ''),
      vet_notes = NULLIF(trim(COALESCE(p_vet_notes, '')), ''),
      signed_at = now()
  WHERE token = p_token;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.endorse_submit(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.endorse_submit(text, text, text, text, text) TO anon, authenticated;


-- ============================================================================
-- FIM. Após rodar:
--   - Tutor chama create_endorsement_request(pet_id) → recebe token
--   - Vet abre /endorse/{token}, endorse_fetch(token) mostra o pet
--   - Vet endossa via endorse_submit(token, nome, crmv, estado)
--   - Carteirinha lê vet_endorsements do pet (RLS owner) e mostra o selo
-- ============================================================================
