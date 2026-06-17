-- ============================================================================
-- Maestro Pet — Seguir EDITORIA + push de matéria nova na editoria seguida
--
-- Item 4 do jornal: o usuário segue uma editoria (ex.: "Saúde e Prevenção") e
-- recebe push quando sai matéria nova nela — mesmo com o app FECHADO.
--
-- Como evita push duplicado:
--   - notify_on_publish = TRUE  → matéria "grande": push pra TODA a base (como já era).
--   - notify_on_publish = FALSE → matéria normal: push só pros SEGUIDORES da editoria.
--   Os dois casos são mutuamente exclusivos → ninguém recebe duas vezes.
--
-- Pré-requisito: app_secrets.push_secret + edge send-web-push (já existentes).
-- Idempotente. Aplicar depois de push-harden.sql / retention-v1.sql.
-- ============================================================================

-- 1) Tabela de follows de editoria -------------------------------------------
create table if not exists public.category_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.news_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index if not exists category_follows_cat_idx on public.category_follows(category_id);

alter table public.category_follows enable row level security;

drop policy if exists "category_follows read own" on public.category_follows;
create policy "category_follows read own" on public.category_follows
  for select using (auth.uid() = user_id);

drop policy if exists "category_follows insert own" on public.category_follows;
create policy "category_follows insert own" on public.category_follows
  for insert with check (auth.uid() = user_id);

drop policy if exists "category_follows delete own" on public.category_follows;
create policy "category_follows delete own" on public.category_follows
  for delete using (auth.uid() = user_id);

-- 2) Push ao publicar: base toda (flag) OU seguidores da editoria ------------
-- Substitui news_notify_on_publish pra também atender os seguidores da editoria.
create or replace function public.news_notify_on_publish()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uids uuid[];
  v_secret text;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_cat_name text;
  v_body text;
begin
  if new.status = 'published'
     and new.push_sent_at is null
     and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'published')
  then
    select value into v_secret from public.app_secrets where key = 'push_secret';

    if new.notify_on_publish = true then
      -- Matéria "grande": avisa a base toda.
      select array_agg(id) into v_uids from auth.users;
      v_body := coalesce(nullif(new.dek, ''), 'Nova matéria no Jornal Maestro Pet');
    else
      -- Matéria normal: avisa só quem segue a editoria.
      select array_agg(distinct cf.user_id) into v_uids
        from public.category_follows cf
        where cf.category_id = new.category_id;
      select name into v_cat_name from public.news_categories where id = new.category_id;
      v_body := coalesce(nullif(new.dek, ''),
                         'Nova matéria em ' || coalesce(v_cat_name, 'uma editoria que você segue'));
    end if;

    if v_secret is not null and v_uids is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-petsocial-secret', v_secret),
        body := jsonb_build_object(
          'user_ids', to_jsonb(v_uids),
          'title', '📰 ' || new.title,
          'body', v_body,
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
