-- ============================================================================
-- Maestro Pet — Personas (3 pets administrados pelo admin, com posts agendados)
--
-- Semeia o feed com conteúdo crível. Extensão direta do sistema do Mozart
-- (mozart-feed.sql), mas pra N personas e SEM tratamento "oficial": aparecem
-- como usuários comuns. Cada persona é um tutor (auth.users + profile) com 1 pet.
-- Emails @maestropet.app → o trigger assign_founder_number (founder-promo.sql)
-- as IGNORA, então não consomem número de fundador.
--
-- REGRA (decisão do dono): conteúdo = rotina pet. NUNCA usar persona pra
-- fabricar avaliação/elogio do próprio app (publicidade enganosa) nem pra
-- impersonar pessoa real. Isso é responsabilidade do admin ao postar.
--
-- Idempotente. Depende de mozart-profile.sql (pgcrypto) + is_admin() + run_dispatch().
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Contas-tutor das personas (UUID fixo, senha aleatória — ninguém loga).
--    handle_new_user cria o profile; o display_name vem do raw_user_meta_data.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values
  ('b0000001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','camila.persona@maestropet.app', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Camila Souza"}'::jsonb, false),
  ('b0000002-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','rafael.persona@maestropet.app', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Rafael Lima"}'::jsonb, false),
  ('b0000003-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','bia.persona@maestropet.app', crypt(gen_random_uuid()::text, gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"Bia Fernandes"}'::jsonb, false)
on conflict (id) do nothing;

-- 2. Profiles dos tutores (garante display_name/bio mesmo se o trigger variar).
insert into public.profiles (id, display_name, bio)
values
  ('b0000001-0000-4000-8000-000000000001','Camila Souza','mãe da Nina 🐱 amante de soneca no sol'),
  ('b0000002-0000-4000-8000-000000000002','Rafael Lima','pai do Thor 🎾 corrida no parque todo dia'),
  ('b0000003-0000-4000-8000-000000000003','Bia Fernandes','tutora da Pipoca 🐩 viciada em petiscos')
on conflict (id) do update set display_name = excluded.display_name, bio = excluded.bio;

-- 3. Pets das personas (aparecem como pets comuns no feed).
insert into public.pets (id, owner_id, name, species, breed, bio)
values
  ('c0000001-0000-4000-8000-000000000001','b0000001-0000-4000-8000-000000000001','Nina','cat','SRD','Gata dengosa, PhD em soneca no sol 🐱'),
  ('c0000002-0000-4000-8000-000000000002','b0000002-0000-4000-8000-000000000002','Thor','dog','Golden Retriever','Energia infinita e amor eterno por bolinha 🎾'),
  ('c0000003-0000-4000-8000-000000000003','b0000003-0000-4000-8000-000000000003','Pipoca','dog','Poodle','Pequena no tamanho, gigante no carinho 🐩')
on conflict (id) do update set name = excluded.name, species = excluded.species, breed = excluded.breed, bio = excluded.bio;

-- 4. Organizador de posts das personas (o admin cria/agenda aqui). pet_id na
--    própria linha → uma tabela serve as 3 personas.
create table if not exists public.persona_posts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  caption text not null,
  media_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_at timestamptz,
  published_post_id uuid references public.posts(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists persona_posts_sched_idx on public.persona_posts(scheduled_at) where status = 'scheduled';
create index if not exists persona_posts_pet_idx on public.persona_posts(pet_id, created_at desc);

alter table public.persona_posts enable row level security;
drop policy if exists "persona_posts admin all" on public.persona_posts;
create policy "persona_posts admin all" on public.persona_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- 5. Publica os agendados vencidos: cria um post REAL pelo pet da persona.
create or replace function public.persona_publish_due_posts()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_post uuid;
begin
  for r in
    select * from public.persona_posts
    where status = 'scheduled' and scheduled_at <= now()
    order by scheduled_at
    limit 20
  loop
    insert into public.posts (pet_id, caption) values (r.pet_id, r.caption) returning id into v_post;
    if r.media_url is not null and char_length(trim(r.media_url)) > 0 then
      insert into public.post_media (post_id, url, media_type, position)
      values (v_post, r.media_url, 'image', 0);
    end if;
    update public.persona_posts
      set status = 'published', published_post_id = v_post, published_at = now(), updated_at = now()
      where id = r.id;
  end loop;
end;
$$;

-- 6. Inclui no run_dispatch (cron petsocial-dispatch a cada 5 min). Mantém as
--    chamadas existentes + adiciona personas.
create or replace function public.run_dispatch()
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.news_publish_scheduled();
  perform public.dispatch_scheduled_notifications();
  perform public.mozart_publish_due_posts();
  perform public.persona_publish_due_posts();
end;
$$;

-- ----------------------------------------------------------------------------
-- Verificação
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.pets where id in (
    'c0000001-0000-4000-8000-000000000001',
    'c0000002-0000-4000-8000-000000000002',
    'c0000003-0000-4000-8000-000000000003')) as persona_pets,
  (to_regclass('public.persona_posts') is not null) as has_table,
  (select count(*) from pg_proc where proname = 'persona_publish_due_posts') as has_fn;
