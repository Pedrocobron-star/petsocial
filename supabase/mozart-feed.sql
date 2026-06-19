-- ============================================================================
-- mozart-feed.sql — Mozart posta no feed. Pet oficial do Mozart + organizador
-- de posts (rascunho/agendado/publicado) editável pelo admin + cron que publica.
-- Idempotente. Depende de mozart-profile.sql (conta-bot) + is_admin() + run_dispatch().
-- Pet do Mozart: d0c0ffee-0000-4000-8000-00000000beef (dono = conta-bot cafe).
-- ============================================================================

-- 1. Pet oficial do Mozart (dono = a conta-bot do Mozart).
insert into public.pets (id, owner_id, name, species, bio, avatar_url)
values (
  'd0c0ffee-0000-4000-8000-00000000beef',
  'd0c0ffee-0000-4000-8000-00000000cafe',
  'Mozart',
  'dog',
  'Mascote oficial do Maestro Pet 🐾 Dicas, novidades e a alegria dos bichos.',
  'https://maestropet.com/mozart/rosto.png'
)
on conflict (id) do update set
  name = excluded.name,
  avatar_url = excluded.avatar_url,
  bio = excluded.bio;

-- 2. Organizador dos posts do Mozart (o admin cria/agenda aqui).
create table if not exists public.mozart_posts (
  id uuid primary key default gen_random_uuid(),
  caption text not null,
  media_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_at timestamptz,
  published_post_id uuid references public.posts(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mozart_posts_sched_idx
  on public.mozart_posts(scheduled_at) where status = 'scheduled';
create index if not exists mozart_posts_recent_idx on public.mozart_posts(created_at desc);

alter table public.mozart_posts enable row level security;
drop policy if exists "mozart_posts admin all" on public.mozart_posts;
create policy "mozart_posts admin all" on public.mozart_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- 3. Publica os posts agendados vencidos: cria um post REAL pelo pet do Mozart.
create or replace function public.mozart_publish_due_posts()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_pet uuid := 'd0c0ffee-0000-4000-8000-00000000beef';
  v_post uuid;
begin
  for r in
    select * from public.mozart_posts
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit 20
  loop
    insert into public.posts (pet_id, caption) values (v_pet, r.caption) returning id into v_post;
    if r.media_url is not null and char_length(trim(r.media_url)) > 0 then
      insert into public.post_media (post_id, url, media_type, position)
      values (v_post, r.media_url, 'image', 0);
    end if;
    update public.mozart_posts
      set status = 'published', published_post_id = v_post, published_at = now(), updated_at = now()
      where id = r.id;
  end loop;
end;
$$;

-- 4. Inclui no run_dispatch (o cron petsocial-dispatch já roda a cada 5 min).
create or replace function public.run_dispatch()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.news_publish_scheduled();
  perform public.dispatch_scheduled_notifications();
  perform public.mozart_publish_due_posts();
end;
$$;

-- ----------------------------------------------------------------------------
-- Verificação
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.pets where id = 'd0c0ffee-0000-4000-8000-00000000beef') as has_mozart_pet,
  (to_regclass('public.mozart_posts') is not null) as has_table,
  (select count(*) from pg_proc where proname = 'mozart_publish_due_posts') as has_fn;
