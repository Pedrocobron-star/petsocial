-- ============================================================================
-- Maestro Pet — Controle de gastos do pet
--
-- Todo dono se pergunta "quanto custa meu pet?" e ninguém tem onde anotar.
-- Aqui o tutor registra ração, vet, banho, remédio, acessório, etc., e vê um
-- dashboard de quanto gasta por mês/ano e em quê. Pura organização do que é dele.
--
-- RLS: cada um gerencia só os próprios gastos (owner_id = auth.uid()).
--
-- Idempotente. Pré-req: tabela public.pets.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pet_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  category text NOT NULL DEFAULT 'outro'
    CHECK (category IN ('racao','vet','banho_tosa','medicamento','acessorio','seguro','hospedagem','adestramento','outro')),
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  description text,
  spent_on date NOT NULL DEFAULT current_date
);

CREATE INDEX IF NOT EXISTS pet_expenses_pet_idx
  ON public.pet_expenses (pet_id, spent_on DESC);

ALTER TABLE public.pet_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_expenses_owner ON public.pet_expenses;
CREATE POLICY pet_expenses_owner ON public.pet_expenses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============================================================================
-- FIM. Após rodar:
--   - Tutor registra gastos em /pet/[id]/expenses
--   - App agrega por mês/categoria client-side
-- ============================================================================
