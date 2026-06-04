-- ============================================================================
-- Pet Social — Cron diário de lembretes via Web Push
--
-- Roda 1x/dia, encontra usuários com cuidados a vencer (vacinas / remédios nos
-- próximos 3 dias) que TÊM push web ativo, e dispara a edge function
-- send-web-push pra cada um.
--
-- PRÉ-REQUISITOS (habilitar 1x no projeto):
--   1. Extensões (Dashboard → Database → Extensions): habilite `pg_cron` e `pg_net`.
--   2. Secrets de runtime (rode UMA vez, trocando os valores):
--        ALTER DATABASE postgres SET app.send_web_push_url =
--          'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
--        ALTER DATABASE postgres SET app.service_role_key = 'SUA_SERVICE_ROLE_KEY';
--      (a service_role key está em Dashboard → Settings → API)
--   3. Edge function send-web-push deployada (supabase functions deploy send-web-push --no-verify-jwt)
--      + secrets VAPID setadas.
--
-- Idempotente.
-- ============================================================================

-- Função que computa e dispara os lembretes do dia
CREATE OR REPLACE FUNCTION public.notify_due_care()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_url text := current_setting('app.send_web_push_url', true);
  v_key text := current_setting('app.service_role_key', true);
BEGIN
  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'app.send_web_push_url / app.service_role_key não configurados — pulando';
    RETURN;
  END IF;

  -- Vacinas a vencer (hoje até +3 dias) por dono com push ativo
  FOR r IN
    SELECT pet.owner_id AS uid,
           count(*) AS n,
           string_agg(DISTINCT pet.name, ', ') AS pet_names
    FROM public.vaccinations v
    JOIN public.pets pet ON pet.id = v.pet_id
    WHERE v.next_dose_at IS NOT NULL
      AND v.next_dose_at BETWEEN current_date AND current_date + 3
      AND EXISTS (SELECT 1 FROM public.push_subscriptions ps WHERE ps.user_id = pet.owner_id)
    GROUP BY pet.owner_id
  LOOP
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object(
        'user_id', r.uid,
        'title', '💉 Vacina chegando',
        'body', r.n || ' vacina(s) de ' || r.pet_names || ' nos próximos dias. Toque pra ver.',
        'url', '/reminders'
      )
    );
  END LOOP;
END;
$$;

-- Agenda diária às 12:00 UTC (~09:00 BRT). Remove agendamento antigo antes.
SELECT cron.unschedule('petsocial-daily-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'petsocial-daily-reminders');

SELECT cron.schedule(
  'petsocial-daily-reminders',
  '0 12 * * *',
  $$ SELECT public.notify_due_care(); $$
);

-- ============================================================================
-- Pra testar manualmente (sem esperar o cron): SELECT public.notify_due_care();
-- ============================================================================
