-- ============================================================================
-- retention-v1.sql — Avaliação do app + Notificações broadcast/agendadas +
-- Agendamento e push de matérias. Idempotente (re-runnable).
-- Roda no Supabase SQL editor (projeto aefrcwysifgniogumxwk).
-- Depende de: is_admin(), app_secrets.push_secret, pg_net, pg_cron,
--             push_subscriptions, send-web-push edge function.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AVALIAÇÃO DO APP — tabela app_ratings + RPCs
-- ----------------------------------------------------------------------------

create table if not exists public.app_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) >= 30),
  trigger_reason text,
  created_at timestamptz not null default now()
);
create index if not exists app_ratings_user_idx on public.app_ratings(user_id, created_at desc);
create index if not exists app_ratings_rating_idx on public.app_ratings(rating);

alter table public.app_ratings enable row level security;

drop policy if exists "app_ratings insert own" on public.app_ratings;
create policy "app_ratings insert own" on public.app_ratings
  for insert with check (auth.uid() = user_id);

drop policy if exists "app_ratings read own" on public.app_ratings;
create policy "app_ratings read own" on public.app_ratings
  for select using (auth.uid() = user_id);

drop policy if exists "app_ratings admin read" on public.app_ratings;
create policy "app_ratings admin read" on public.app_ratings
  for select using (public.is_admin());

-- Submeter avaliação (valida estrelas + texto >= 30 chars no servidor)
create or replace function public.submit_app_rating(p_rating int, p_comment text, p_trigger text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  if p_comment is null or char_length(trim(p_comment)) < 30 then
    raise exception 'comment must have at least 30 characters';
  end if;
  insert into public.app_ratings (user_id, rating, comment, trigger_reason)
  values (auth.uid(), p_rating, trim(p_comment), p_trigger);
end;
$$;
revoke all on function public.submit_app_rating(int, text, text) from public;
grant execute on function public.submit_app_rating(int, text, text) to authenticated;

-- admin_list_app_ratings: DEFINICAO CANONICA movida para supabase/mozart-dm.sql
-- (versao com user_id, exigida pelo /admin/ratings pra responder como Mozart).
-- NAO redefinir aqui — reaplicar este arquivo reverteria o user_id e quebraria
-- a DM do Mozart. Ver supabase/mozart-dm.sql.

-- Admin: resumo das avaliacoes
create or replace function public.admin_app_ratings_summary()
returns table (total bigint, avg_rating numeric, c1 bigint, c2 bigint, c3 bigint, c4 bigint, c5 bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select count(*)::bigint,
         round(avg(rating)::numeric, 2),
         count(*) filter (where rating = 1)::bigint,
         count(*) filter (where rating = 2)::bigint,
         count(*) filter (where rating = 3)::bigint,
         count(*) filter (where rating = 4)::bigint,
         count(*) filter (where rating = 5)::bigint
  from public.app_ratings;
end;
$$;
revoke all on function public.admin_app_ratings_summary() from public;
grant execute on function public.admin_app_ratings_summary() to authenticated;

-- ----------------------------------------------------------------------------
-- 2. NOTIFICAÇÕES IN-APP — suportar broadcast (título/corpo/url + kind novo)
-- ----------------------------------------------------------------------------

alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists url text;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'mention', 'pet_tagged', 'broadcast'));

-- ----------------------------------------------------------------------------
-- 3. NOTIFICAÇÕES AGENDADAS/BROADCAST — tabela + RPCs admin
-- ----------------------------------------------------------------------------

create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  url text default '/',
  audience text not null default 'all' check (audience in ('all', 'pro', 'with_pets', 'inactive')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  sent_count int,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_notifications_pending_idx
  on public.scheduled_notifications(scheduled_at) where sent_at is null;

alter table public.scheduled_notifications enable row level security;

drop policy if exists "scheduled_notifications admin all" on public.scheduled_notifications;
create policy "scheduled_notifications admin all" on public.scheduled_notifications
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_create_scheduled_notification(
  p_title text, p_body text, p_url text, p_audience text, p_scheduled_at timestamptz
)
returns public.scheduled_notifications
language plpgsql security definer set search_path = public as $$
declare v_row public.scheduled_notifications;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_title is null or char_length(trim(p_title)) = 0 then raise exception 'title required'; end if;
  insert into public.scheduled_notifications (title, body, url, audience, scheduled_at, created_by)
  values (
    trim(p_title),
    nullif(trim(coalesce(p_body, '')), ''),
    coalesce(nullif(trim(coalesce(p_url, '')), ''), '/'),
    coalesce(p_audience, 'all'),
    coalesce(p_scheduled_at, now()),
    auth.uid()
  )
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.admin_create_scheduled_notification(text, text, text, text, timestamptz) from public;
grant execute on function public.admin_create_scheduled_notification(text, text, text, text, timestamptz) to authenticated;

create or replace function public.admin_list_scheduled_notifications(p_limit int default 100)
returns setof public.scheduled_notifications
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select * from public.scheduled_notifications
  order by coalesce(sent_at, scheduled_at) desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_list_scheduled_notifications(int) from public;
grant execute on function public.admin_list_scheduled_notifications(int) to authenticated;

create or replace function public.admin_cancel_scheduled_notification(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.scheduled_notifications where id = p_id and sent_at is null;
end;
$$;
revoke all on function public.admin_cancel_scheduled_notification(uuid) from public;
grant execute on function public.admin_cancel_scheduled_notification(uuid) to authenticated;

-- Processa notificações agendadas vencidas: grava in-app + dispara push
create or replace function public.dispatch_scheduled_notifications()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_uids uuid[];
  v_secret text;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
begin
  select value into v_secret from public.app_secrets where key = 'push_secret';

  for r in
    select * from public.scheduled_notifications
    where sent_at is null and scheduled_at <= now()
    order by scheduled_at
    limit 20
  loop
    -- Resolve público-alvo
    if r.audience = 'pro' then
      select array_agg(id) into v_uids from public.profiles where is_pro = true;
    elsif r.audience = 'with_pets' then
      select array_agg(distinct owner_id) into v_uids from public.pets;
    elsif r.audience = 'inactive' then
      select array_agg(id) into v_uids from public.profiles
        where last_seen_at is null or last_seen_at < now() - interval '7 days';
    else -- 'all'
      select array_agg(id) into v_uids from auth.users;
    end if;

    -- In-app: grava notificação broadcast pra cada usuário do segmento
    if v_uids is not null then
      insert into public.notifications (user_id, kind, title, body, url, created_at)
      select uid, 'broadcast', r.title, r.body, r.url, now()
      from unnest(v_uids) as uid;
    end if;

    -- Push: edge function filtra quem tem subscription ativa
    if v_secret is not null and v_uids is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-petsocial-secret', v_secret),
        body := jsonb_build_object(
          'user_ids', to_jsonb(v_uids),
          'title', r.title,
          'body', coalesce(r.body, ''),
          'url', coalesce(r.url, '/'),
          'tag', 'broadcast-' || r.id::text
        )
      );
    end if;

    update public.scheduled_notifications
      set sent_at = now(), sent_count = coalesce(array_length(v_uids, 1), 0)
      where id = r.id;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. MATÉRIAS — agendamento + push ao publicar
-- ----------------------------------------------------------------------------

alter table public.news_articles add column if not exists scheduled_at timestamptz;
alter table public.news_articles add column if not exists notify_on_publish boolean not null default false;
alter table public.news_articles add column if not exists push_sent_at timestamptz;

alter table public.news_articles drop constraint if exists news_articles_status_check;
alter table public.news_articles add constraint news_articles_status_check
  check (status in ('draft', 'published', 'scheduled'));

create index if not exists news_articles_scheduled_idx
  on public.news_articles(scheduled_at) where status = 'scheduled';

-- Dispara push quando uma matéria passa a 'published' com notify_on_publish=true.
-- BEFORE trigger: marca push_sent_at na mesma escrita (evita reenvio em edições).
create or replace function public.news_notify_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uids uuid[];
  v_secret text;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
begin
  if new.status = 'published'
     and new.notify_on_publish = true
     and new.push_sent_at is null
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'published')
  then
    select value into v_secret from public.app_secrets where key = 'push_secret';
    select array_agg(id) into v_uids from auth.users;

    if v_secret is not null and v_uids is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-petsocial-secret', v_secret),
        body := jsonb_build_object(
          'user_ids', to_jsonb(v_uids),
          'title', '📰 ' || new.title,
          'body', coalesce(nullif(new.dek, ''), 'Nova matéria no Jornal Maestro Pet'),
          'url', '/news/' || new.slug,
          'tag', 'news-' || new.id::text
        )
      );
    end if;

    new.push_sent_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists news_notify_on_publish_trg on public.news_articles;
create trigger news_notify_on_publish_trg
  before insert or update on public.news_articles
  for each row execute function public.news_notify_on_publish();

-- Publica matérias agendadas cuja hora chegou (o trigger acima cuida do push)
create or replace function public.news_publish_scheduled()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.news_articles
    set status = 'published', published_at = now()
    where status = 'scheduled' and scheduled_at <= now();
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. CRON — despacha notificações agendadas + publica matérias agendadas (5 min)
-- ----------------------------------------------------------------------------

-- run_dispatch(): DEFINICAO CANONICA em supabase/mozart-feed.sql (versao superset
-- que tambem chama mozart_publish_due_posts() -> auto-post do Mozart). NAO
-- redefinir aqui — reaplicar este arquivo reverteria run_dispatch e o Mozart
-- pararia de publicar posts agendados. admin_run_dispatch_now() abaixo continua
-- chamando a versao canonica por nome.

-- Admin: dispara o dispatch na hora (pro "enviar agora" não esperar o cron)
create or replace function public.admin_run_dispatch_now()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  perform public.run_dispatch();
end;
$$;
revoke all on function public.admin_run_dispatch_now() from public;
grant execute on function public.admin_run_dispatch_now() to authenticated;

select cron.unschedule('petsocial-dispatch')
where exists (select 1 from cron.job where jobname = 'petsocial-dispatch');
select cron.schedule('petsocial-dispatch', '*/5 * * * *', $$ select public.run_dispatch(); $$);

-- ----------------------------------------------------------------------------
-- Verificação
-- ----------------------------------------------------------------------------
select
  (to_regclass('public.app_ratings') is not null) as has_app_ratings,
  (to_regclass('public.scheduled_notifications') is not null) as has_sched_notif,
  exists (select 1 from information_schema.columns
          where table_name = 'news_articles' and column_name = 'scheduled_at') as news_has_scheduled_at,
  exists (select 1 from information_schema.columns
          where table_name = 'notifications' and column_name = 'title') as notif_has_title,
  (select count(*) from pg_proc where proname in
    ('submit_app_rating','dispatch_scheduled_notifications','news_publish_scheduled','run_dispatch','admin_create_scheduled_notification')) as fn_count,
  (select json_agg(json_build_object('name', jobname, 'sched', schedule)) from cron.job) as jobs;
