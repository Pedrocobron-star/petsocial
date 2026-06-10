-- ============================================================================
-- Maestro Pet — Push web (PWA): subscriptions + helper de envio
--
-- Push web funciona via Web Push API (service worker + VAPID), diferente do
-- push nativo (Expo) que já existe. Aqui guardamos as subscriptions do navegador
-- de cada usuário; a edge function send-web-push assina com VAPID e dispara.
--
-- RLS: cada um gerencia só as próprias subscriptions.
--
-- Idempotente. Pré-req: nenhum.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_subscriptions_owner ON public.push_subscriptions;
CREATE POLICY push_subscriptions_owner ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- FIM. Após rodar:
--   - Client inscreve via PushManager → salva endpoint/p256dh/auth aqui
--   - Edge function send-web-push lê as subscriptions e dispara (VAPID)
-- ============================================================================
