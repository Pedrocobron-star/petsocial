-- ============================================================================
-- Maestro Pet — Lembretes por Web Push: TABELA de dedup + AGENDAMENTO do cron
--
-- ⚠️ A FUNCAO notify_due_care() vive de forma CANONICA em supabase/push-harden.sql
-- (v94 endurecida: mesma logica 3-categorias + dedup, MAS injeta o header
-- x-petsocial-secret que a edge send-web-push endurecida exige). NAO redefinir a
-- funcao aqui — reaplicar reverteria o header e a edge passaria a responder 401,
-- parando TODO push de lembrete em silencio.
--
-- Este arquivo guarda APENAS o que e UNICO: a tabela de dedup push_notifications_sent
-- e o agendamento do cron petsocial-daily-reminders. Aplicar push-harden.sql DEPOIS
-- (ou junto) pra a funcao canonica existir quando o cron chamar.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Dedup: registra o que ja foi enviado pra cada dono/janela.
create table if not exists public.push_notifications_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedup_key text not null,
  sent_at timestamptz not null default now()
);
create index if not exists push_notifications_sent_idx
  on public.push_notifications_sent(user_id, dedup_key, sent_at desc);

-- notify_due_care(): DEFINICAO CANONICA em supabase/push-harden.sql (linhas ~39-129).
-- NAO redefinir aqui (ver cabecalho).

-- Agenda diaria as 12:00 UTC (~09:00 BRT). Reagenda se ja existir.
select cron.unschedule('petsocial-daily-reminders')
where exists (select 1 from cron.job where jobname = 'petsocial-daily-reminders');

select cron.schedule('petsocial-daily-reminders', '0 12 * * *', $$ select public.notify_due_care(); $$);
