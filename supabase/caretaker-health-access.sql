-- ============================================================================
-- Maestro Pet — Co-tutores: acesso de LEITURA à saúde + lista "pets que cuido"
--
-- O feature de caretakers (pet-caretakers.sql) já existe: convite, aceite, papéis
-- e RLS da AGENDA. Aqui completamos o loop pro co-tutor:
--   1. Cuidador aceito pode LER a saúde do pet (perfil, vacinas, vermífugo,
--      remédios, consultas, peso, sintomas) — read-only, via is_caretaker_of().
--   2. RPC caretaker_shared_pets() lista os pets que a pessoa ajuda a cuidar.
--
-- IMPORTANTE: políticas ADITIVAS (novas policies permissivas). Não tocam nas
-- policies de owner existentes — apenas concedem leitura extra ao cuidador aceito.
-- Documentos (pet_documents) ficam de fora de propósito (privados do dono).
--
-- Idempotente. Pré-req: is_caretaker_of() (supabase/pet-caretakers.sql).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Leitura da saúde pra cuidador aceito (policies aditivas)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS pets_caretaker_read ON public.pets;
CREATE POLICY pets_caretaker_read ON public.pets
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(id));

DROP POLICY IF EXISTS vaccinations_caretaker_read ON public.vaccinations;
CREATE POLICY vaccinations_caretaker_read ON public.vaccinations
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));

DROP POLICY IF EXISTS parasite_treatments_caretaker_read ON public.parasite_treatments;
CREATE POLICY parasite_treatments_caretaker_read ON public.parasite_treatments
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));

DROP POLICY IF EXISTS medications_caretaker_read ON public.medications;
CREATE POLICY medications_caretaker_read ON public.medications
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));

DROP POLICY IF EXISTS vet_visits_caretaker_read ON public.vet_visits;
CREATE POLICY vet_visits_caretaker_read ON public.vet_visits
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));

DROP POLICY IF EXISTS weight_records_caretaker_read ON public.weight_records;
CREATE POLICY weight_records_caretaker_read ON public.weight_records
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));

DROP POLICY IF EXISTS pet_symptoms_caretaker_read ON public.pet_symptoms;
CREATE POLICY pet_symptoms_caretaker_read ON public.pet_symptoms
  FOR SELECT TO authenticated
  USING (public.is_caretaker_of(pet_id));


-- ----------------------------------------------------------------------------
-- 2. RPC: pets que eu (auth.uid()) ajudo a cuidar (caretaker aceito)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.caretaker_shared_pets()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pet_id', p.id,
    'name', p.name,
    'species', p.species,
    'breed', p.breed,
    'avatar_url', p.avatar_url,
    'role', c.role,
    'owner_name', pr.display_name
  ) ORDER BY p.name), '[]'::jsonb)
  FROM public.pet_caretakers c
  JOIN public.pets p ON p.id = c.pet_id
  LEFT JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE c.user_id = auth.uid() AND c.status = 'accepted';
$$;

REVOKE ALL ON FUNCTION public.caretaker_shared_pets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.caretaker_shared_pets() TO authenticated;

-- ============================================================================
-- FIM. Após rodar:
--   - Cuidador aceito abre "Pets que ajudo a cuidar" (caretaker_shared_pets)
--   - Toca num pet → vê o hub de saúde (read-only) e a agenda (já tinha acesso)
-- ============================================================================
