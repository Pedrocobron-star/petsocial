-- ============================================================================
-- Maestro Pet — Endurecer o canal de Web Push (segredo interno)
--
-- Problema: a edge `send-web-push` e --no-verify-jwt e aceita POST anonimo,
-- entao qualquer um que descubra a URL poderia disparar push pra qualquer user.
--
-- Solucao (sem digitar/expor segredo, repo publico, free tier):
--   1) Tabela `app_secrets` (RLS deny-all) com um `push_secret` gerado NO BANCO
--      via gen_random_uuid (nunca digitado, nunca commitado, nunca exposto ao
--      client — RLS bloqueia anon/authenticated; so service_role e o dono leem).
--   2) As funcoes de cron passam esse segredo no header `x-petsocial-secret`.
--   3) A edge (deploy a parte) exige: header com o segredo (cron) OU um JWT
--      valido (self-push do proprio user). Sem isso -> 401.
--
-- Ordem segura: rode este SQL ANTES de redeployar a edge endurecida. Enquanto a
-- edge antiga ignora o header novo, o push continua funcionando (zero downtime).
--
-- Idempotente. Tudo ASCII (sobrevive ao paste via clipboard).
-- ============================================================================

-- 1) Cofre de segredos internos ----------------------------------------------
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- Sem policies => nega tudo pra anon/authenticated. service_role (edge) e o dono
-- (funcoes SECURITY DEFINER) ignoram RLS e conseguem ler.
revoke all on public.app_secrets from anon, authenticated;

-- Semeia o segredo so se ainda nao existir (64 hex, aleatorio, server-side).
insert into public.app_secrets (key, value)
select 'push_secret',
       replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where not exists (select 1 from public.app_secrets where key = 'push_secret');

-- 2) Cron de lembretes: passa o segredo no header ----------------------------
create or replace function public.notify_due_care()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_secret text;
  v_headers jsonb;
  v_already int;
  v_dedup text;
begin
  select value into v_secret from public.app_secrets where key = 'push_secret';
  v_headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-petsocial-secret', coalesce(v_secret, ''));

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

  -- 4) VACINAS ATRASADAS (venceram ha 1..90 dias) -> nudge SEMANAL (sem spam)
  --    Fecha o buraco do "vacina vencida ha meses invisivel": a janela acima so
  --    pega os proximos 3 dias; depois que passa, o tutor nao era mais lembrado.
  for r in
    select pet.owner_id as uid, string_agg(distinct pet.name, ', ') as pet_names
    from public.vaccinations v
    join public.pets pet on pet.id = v.pet_id
    where v.next_dose_at is not null
      and v.next_dose_at < current_date
      and v.next_dose_at >= current_date - 90
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'vaccine_overdue:' || to_char(current_date, 'IYYY-IW');  -- 1x por semana ISO
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '6 days';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(128137) || ' Vacina atrasada',
          'body', 'A vacina de ' || r.pet_names || ' esta atrasada. Que tal reservar um horario?',
          'url', '/reminders', 'tag', 'vaccine-overdue'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- 5) ANTIPARASITARIOS ATRASADOS (1..90 dias) -> nudge SEMANAL
  for r in
    select pet.owner_id as uid, string_agg(distinct pet.name, ', ') as pet_names
    from public.parasite_treatments pt
    join public.pets pet on pet.id = pt.pet_id
    where pt.next_due_at is not null
      and pt.next_due_at < current_date
      and pt.next_due_at >= current_date - 90
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'parasite_overdue:' || to_char(current_date, 'IYYY-IW');
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '6 days';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(129714) || ' Antiparasitario atrasado',
          'body', 'A protecao de ' || r.pet_names || ' contra pulgas e vermes venceu. Reaplique quando puder.',
          'url', '/reminders', 'tag', 'parasite-overdue'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- 6) REMEDIOS ATIVOS com dose HOJE -> push de manha (cobre app fechado).
  --    daily/twice_daily todo dia; weekly no mesmo dia-da-semana do start_date;
  --    monthly no mesmo dia-do-mes do start_date. Dedup diario (1x/dia).
  for r in
    select pet.owner_id as uid, string_agg(distinct pet.name, ', ') as pet_names
    from public.medications m
    join public.pets pet on pet.id = m.pet_id
    where m.active = true
      and m.start_date <= current_date
      and (m.end_date is null or m.end_date >= current_date)
      and (
        m.frequency in ('daily', 'twice_daily')
        or (m.frequency = 'weekly' and ((current_date - m.start_date) % 7) = 0)
        or (m.frequency = 'monthly' and extract(day from m.start_date) = extract(day from current_date))
      )
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = pet.owner_id)
    group by pet.owner_id
  loop
    v_dedup := 'meds:' || current_date::text;
    select count(*) into v_already from public.push_notifications_sent
      where user_id = r.uid and dedup_key = v_dedup and sent_at > now() - interval '20 hours';
    if v_already = 0 then
      perform net.http_post(url := v_url, headers := v_headers,
        body := jsonb_build_object('user_id', r.uid,
          'title', chr(128138) || ' Remedios de hoje',
          'body', 'Nao esqueca os remedios de ' || r.pet_names || ' hoje.',
          'url', '/reminders', 'tag', 'meds-daily'));
      insert into public.push_notifications_sent(user_id, dedup_key) values (r.uid, v_dedup);
    end if;
  end loop;

  -- housekeeping: limpa dedup antigo
  delete from public.push_notifications_sent where sent_at < now() - interval '30 days';
end;
$$;

-- 3) Cron de torneios: passa o segredo no header -----------------------------
create or replace function public.tournament_lifecycle()
returns void language plpgsql security definer set search_path = public as $$
declare
  t record;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_secret text;
  v_headers jsonb;
  v_uids uuid[];
begin
  select value into v_secret from public.app_secrets where key = 'push_secret';
  v_headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-petsocial-secret', coalesce(v_secret, ''));

  -- 1) finaliza torneios encerrados -> top 10 vira tournament_winners + push
  for t in select * from public.tournaments where ends_at <= now() and finalized_at is null loop
    insert into public.tournament_winners(tournament_id, user_id, rank, score)
    select t.id, lb.user_id, row_number() over (order by lb.score desc), lb.score
    from (
      select gs.user_id,
             max(gs.score * case coalesce(gs.difficulty, 2) when 1 then 1.0 when 3 then 2.0 else 1.5 end) as score
      from public.game_scores gs
      where gs.game = t.game
        and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
        and coalesce(gs.difficulty, 2) >= t.min_difficulty
      group by gs.user_id
    ) lb
    order by lb.score desc
    limit 10
    on conflict do nothing;

    update public.tournaments set finalized_at = now() where id = t.id;

    select array_agg(user_id) into v_uids from public.tournament_winners where tournament_id = t.id;
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(127942) || ' Torneio encerrado!',
        'body', 'Veja onde voce ficou no podio de ' || t.title || '.',
        'url', '/games', 'tag', 'tournament-end'));
    end if;
  end loop;

  -- 2) torneios que comecaram (ultimas 2h, nao avisados) -> push geral
  for t in select * from public.tournaments
           where starts_at <= now() and starts_at > now() - interval '2 hours' and start_notified_at is null loop
    select array_agg(distinct user_id) into v_uids from public.push_subscriptions;
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(127942) || ' Novo torneio na Arena!',
        'body', t.title || ' comecou. Jogue e dispute o podio!',
        'url', '/games', 'tag', 'tournament-start'));
    end if;
    update public.tournaments set start_notified_at = now() where id = t.id;
  end loop;

  -- 3) acabando em ~1h -> push pros participantes
  for t in select * from public.tournaments
           where ends_at > now() and ends_at <= now() + interval '1 hour' and ending_notified_at is null loop
    select array_agg(distinct gs.user_id) into v_uids
    from public.game_scores gs
    where gs.game = t.game
      and gs.created_at >= t.starts_at and gs.created_at < t.ends_at
      and coalesce(gs.difficulty, 2) >= t.min_difficulty
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = gs.user_id);
    if v_uids is not null then
      perform net.http_post(url := v_url, headers := v_headers, body := jsonb_build_object(
        'user_ids', to_jsonb(v_uids),
        'title', chr(9203) || ' Torneio acaba em 1h!',
        'body', 'Ultima chance de subir no podio de ' || t.title || '.',
        'url', '/games', 'tag', 'tournament-ending'));
    end if;
    update public.tournaments set ending_notified_at = now() where id = t.id;
  end loop;
end;
$$;

-- ============================================================================
-- FIM. Apos rodar: o cron ja envia o segredo. Em seguida, redeploy a edge
-- endurecida (supabase/functions/send-web-push/index.ts) que passa a exigi-lo.
-- ============================================================================
