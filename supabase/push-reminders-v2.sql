-- ============================================================================
-- Maestro Pet — Lembretes por Web Push v2 (dedup + 3 categorias)
--
-- Melhora o cron diario: alem de VACINAS, cobre ANTIPARASITARIOS e CONSULTAS,
-- e adiciona DEDUP (nao repete o mesmo aviso todo dia). Roda 1x/dia e dispara a
-- edge function send-web-push pra cada dono com push ativo.
--
-- Emoji via chr() pra sobreviver ao paste via clipboard. Tudo ASCII no resto.
--
-- A edge send-web-push e --no-verify-jwt e a URL e publica (ja no repo), entao
-- a funcao chama direto sem secret/config. Nada sensivel aqui.
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

create or replace function public.notify_due_care()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
  v_already int;
  v_dedup text;
begin
  -- 1) VACINAS a vencer (hoje..+3)
  for r in
    select pet.owner_id as uid, count(*) as n,
           string_agg(distinct pet.name, ', ') as pet_names
    from public.vaccinations v
    join public.pets pet on pet.id = v.pet_id
    where v.next_dose_at is not null
      and v.next_dose_at between current_date and current_date + 3
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'vaccine:' || current_date::text;
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '3 days';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(128137) || ' Vacina chegando',
          'body', r.n || ' vacina(s) de ' || r.pet_names || ' nos proximos dias. Toque pra ver.',
          'url', '/reminders', 'tag', 'vaccine-due'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- 2) ANTIPARASITARIOS a vencer (hoje..+3)
  for r in
    select pet.owner_id as uid, count(*) as n,
           string_agg(distinct pet.name, ', ') as pet_names
    from public.parasite_treatments pt
    join public.pets pet on pet.id = pt.pet_id
    where pt.next_due_at is not null
      and pt.next_due_at between current_date and current_date + 3
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'parasite:' || current_date::text;
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '3 days';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(129714) || ' Antiparasitario chegando',
          'body', r.n || ' dose(s) de ' || r.pet_names || ' nos proximos dias.',
          'url', '/reminders', 'tag', 'parasite-due'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- 3) CONSULTAS marcadas (hoje..+1)
  for r in
    select pet.owner_id as uid,
           string_agg(distinct pet.name, ', ') as pet_names
    from public.vet_visits vv
    join public.pets pet on pet.id = vv.pet_id
    where vv.next_visit_at is not null
      and vv.next_visit_at::date between current_date and current_date + 1
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'vet_visit:' || current_date::text;
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '2 days';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(129658) || ' Consulta chegando',
          'body', 'Consulta de ' || r.pet_names || ' marcada. Nao esqueca!',
          'url', '/reminders', 'tag', 'vet-due'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- housekeeping: limpa dedup antigo
  delete from public.push_notifications_sent where sent_at < now() - interval '30 days';
end;
$$;

-- Agenda diaria as 12:00 UTC (~09:00 BRT). Reagenda se ja existir.
select cron.unschedule('petsocial-daily-reminders')
where exists (select 1 from cron.job where jobname = 'petsocial-daily-reminders');

select cron.schedule('petsocial-daily-reminders', '0 12 * * *', $$ select public.notify_due_care(); $$);
