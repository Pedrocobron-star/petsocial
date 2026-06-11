-- ============================================================================
-- Maestro Pet — Schema completo
-- Cole o arquivo INTEIRO no SQL Editor do Supabase e clique em "Run".
-- ============================================================================

-- Extensões
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABELAS
-- ============================================================================

-- Profiles (tutor): 1:1 com auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Pets: vinculados ao tutor (profile)
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text not null check (species in ('dog','cat','bird','rabbit','reptile','rodent','fish','other')),
  breed text,
  birthdate date,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pets_owner_idx on public.pets(owner_id);

-- Posts: cada post é "feito por" um pet
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists posts_pet_idx on public.posts(pet_id);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- Mídia dos posts (foto ou vídeo). Um post pode ter várias mídias (carrossel).
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  url text not null,
  media_type text not null check (media_type in ('image','video')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists post_media_post_idx on public.post_media(post_id, position);

-- Follows: pet segue pet
create table if not exists public.follows (
  follower_pet_id uuid not null references public.pets(id) on delete cascade,
  followed_pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_pet_id, followed_pet_id),
  check (follower_pet_id <> followed_pet_id)
);
create index if not exists follows_followed_idx on public.follows(followed_pet_id);

-- Likes: pet curte post
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, pet_id)
);
create index if not exists likes_post_idx on public.likes(post_id);

-- Comentários
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  content text not null check (length(content) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);

-- Encontros (meetups): criados por um pet (host)
create table if not exists public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_pet_id uuid not null references public.pets(id) on delete cascade,
  title text not null,
  description text,
  location_name text not null,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists meetups_starts_idx on public.meetups(starts_at);
create index if not exists meetups_host_idx on public.meetups(host_pet_id);

-- RSVPs: pet confirma presença em encontro
create table if not exists public.meetup_rsvps (
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  status text not null default 'going' check (status in ('going','maybe','not_going')),
  created_at timestamptz not null default now(),
  primary key (meetup_id, pet_id)
);

-- ============================================================================
-- VIEWS (contagens agregadas)
-- ============================================================================

create or replace view public.pet_stats as
select
  p.id as pet_id,
  (select count(*) from public.posts po where po.pet_id = p.id) as posts_count,
  (select count(*) from public.follows f where f.followed_pet_id = p.id) as followers_count,
  (select count(*) from public.follows f where f.follower_pet_id = p.id) as following_count
from public.pets p;

create or replace view public.post_stats as
select
  po.id as post_id,
  (select count(*) from public.likes l where l.post_id = po.id) as likes_count,
  (select count(*) from public.comments c where c.post_id = po.id) as comments_count
from public.posts po;

-- ============================================================================
-- TRIGGERS — auto-criar profile quando user se registra
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists pets_set_updated_at on public.pets;
create trigger pets_set_updated_at
  before update on public.pets
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.meetups enable row level security;
alter table public.meetup_rsvps enable row level security;

-- profiles
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- pets
drop policy if exists "pets read all" on public.pets;
create policy "pets read all" on public.pets for select using (true);

drop policy if exists "pets insert own" on public.pets;
create policy "pets insert own" on public.pets for insert with check (auth.uid() = owner_id);

drop policy if exists "pets update own" on public.pets;
create policy "pets update own" on public.pets for update using (auth.uid() = owner_id);

drop policy if exists "pets delete own" on public.pets;
create policy "pets delete own" on public.pets for delete using (auth.uid() = owner_id);

-- posts
drop policy if exists "posts read all" on public.posts;
create policy "posts read all" on public.posts for select using (true);

drop policy if exists "posts insert own pet" on public.posts;
create policy "posts insert own pet" on public.posts for insert
  with check (exists (select 1 from public.pets where pets.id = posts.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "posts update own pet" on public.posts;
create policy "posts update own pet" on public.posts for update
  using (exists (select 1 from public.pets where pets.id = posts.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "posts delete own pet" on public.posts;
create policy "posts delete own pet" on public.posts for delete
  using (exists (select 1 from public.pets where pets.id = posts.pet_id and pets.owner_id = auth.uid()));

-- post_media
drop policy if exists "post_media read all" on public.post_media;
create policy "post_media read all" on public.post_media for select using (true);

drop policy if exists "post_media insert own" on public.post_media;
create policy "post_media insert own" on public.post_media for insert
  with check (exists (
    select 1 from public.posts po
    join public.pets pe on pe.id = po.pet_id
    where po.id = post_media.post_id and pe.owner_id = auth.uid()
  ));

-- follows
drop policy if exists "follows read all" on public.follows;
create policy "follows read all" on public.follows for select using (true);

drop policy if exists "follows insert own" on public.follows;
create policy "follows insert own" on public.follows for insert
  with check (exists (select 1 from public.pets where pets.id = follows.follower_pet_id and pets.owner_id = auth.uid()));

drop policy if exists "follows delete own" on public.follows;
create policy "follows delete own" on public.follows for delete
  using (exists (select 1 from public.pets where pets.id = follows.follower_pet_id and pets.owner_id = auth.uid()));

-- likes
drop policy if exists "likes read all" on public.likes;
create policy "likes read all" on public.likes for select using (true);

drop policy if exists "likes insert own" on public.likes;
create policy "likes insert own" on public.likes for insert
  with check (exists (select 1 from public.pets where pets.id = likes.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own" on public.likes for delete
  using (exists (select 1 from public.pets where pets.id = likes.pet_id and pets.owner_id = auth.uid()));

-- comments
drop policy if exists "comments read all" on public.comments;
create policy "comments read all" on public.comments for select using (true);

drop policy if exists "comments insert own" on public.comments;
create policy "comments insert own" on public.comments for insert
  with check (exists (select 1 from public.pets where pets.id = comments.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "comments update own" on public.comments;
create policy "comments update own" on public.comments for update
  using (exists (select 1 from public.pets where pets.id = comments.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own" on public.comments for delete
  using (exists (select 1 from public.pets where pets.id = comments.pet_id and pets.owner_id = auth.uid()));

-- meetups
drop policy if exists "meetups read all" on public.meetups;
create policy "meetups read all" on public.meetups for select using (true);

drop policy if exists "meetups insert own" on public.meetups;
create policy "meetups insert own" on public.meetups for insert
  with check (exists (select 1 from public.pets where pets.id = meetups.host_pet_id and pets.owner_id = auth.uid()));

drop policy if exists "meetups update own" on public.meetups;
create policy "meetups update own" on public.meetups for update
  using (exists (select 1 from public.pets where pets.id = meetups.host_pet_id and pets.owner_id = auth.uid()));

drop policy if exists "meetups delete own" on public.meetups;
create policy "meetups delete own" on public.meetups for delete
  using (exists (select 1 from public.pets where pets.id = meetups.host_pet_id and pets.owner_id = auth.uid()));

-- meetup_rsvps
drop policy if exists "rsvps read all" on public.meetup_rsvps;
create policy "rsvps read all" on public.meetup_rsvps for select using (true);

drop policy if exists "rsvps upsert own" on public.meetup_rsvps;
create policy "rsvps upsert own" on public.meetup_rsvps for insert
  with check (exists (select 1 from public.pets where pets.id = meetup_rsvps.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "rsvps update own" on public.meetup_rsvps;
create policy "rsvps update own" on public.meetup_rsvps for update
  using (exists (select 1 from public.pets where pets.id = meetup_rsvps.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "rsvps delete own" on public.meetup_rsvps;
create policy "rsvps delete own" on public.meetup_rsvps for delete
  using (exists (select 1 from public.pets where pets.id = meetup_rsvps.pet_id and pets.owner_id = auth.uid()));

-- ============================================================================
-- STORAGE BUCKETS (criados via SQL)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

-- Policies de storage: qualquer um lê; usuário autenticado upa em pasta com seu user_id
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');

drop policy if exists "avatars auth upload" on storage.objects;
create policy "avatars auth upload" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars auth update" on storage.objects;
create policy "avatars auth update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "avatars auth delete" on storage.objects;
create policy "avatars auth delete" on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "posts public read" on storage.objects;
create policy "posts public read" on storage.objects for select using (bucket_id = 'posts');

drop policy if exists "posts auth upload" on storage.objects;
create policy "posts auth upload" on storage.objects for insert
  with check (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "posts auth delete" on storage.objects;
create policy "posts auth delete" on storage.objects for delete
  using (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- PET MILESTONES — marcos do pet (diário/timeline)
-- ============================================================================

create table if not exists public.pet_milestones (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  title text not null,
  description text,
  happened_at date not null,
  emoji text default '✨',
  photo_url text,
  created_at timestamptz not null default now()
);
create index if not exists pet_milestones_pet_idx on public.pet_milestones(pet_id, happened_at desc);

alter table public.pet_milestones enable row level security;

drop policy if exists "pet_milestones read all" on public.pet_milestones;
create policy "pet_milestones read all" on public.pet_milestones for select using (true);

drop policy if exists "pet_milestones insert own" on public.pet_milestones;
create policy "pet_milestones insert own" on public.pet_milestones for insert
  with check (exists (select 1 from public.pets where pets.id = pet_milestones.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "pet_milestones update own" on public.pet_milestones;
create policy "pet_milestones update own" on public.pet_milestones for update
  using (exists (select 1 from public.pets where pets.id = pet_milestones.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "pet_milestones delete own" on public.pet_milestones;
create policy "pet_milestones delete own" on public.pet_milestones for delete
  using (exists (select 1 from public.pets where pets.id = pet_milestones.pet_id and pets.owner_id = auth.uid()));

-- ============================================================================
-- LOST & FOUND — pets perdidos / encontrados
-- ============================================================================

create table if not exists public.lost_reports (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid references public.pets(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lost', 'found')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  pet_name text,
  species text,
  breed text,
  color text,
  last_seen_location text not null,
  last_seen_at timestamptz,
  description text,
  contact_info text not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lost_reports_status_idx on public.lost_reports(status, created_at desc);
create index if not exists lost_reports_kind_idx on public.lost_reports(kind, status, created_at desc);

alter table public.lost_reports enable row level security;

drop policy if exists "lost_reports read all" on public.lost_reports;
create policy "lost_reports read all" on public.lost_reports for select using (true);

drop policy if exists "lost_reports insert own" on public.lost_reports;
create policy "lost_reports insert own" on public.lost_reports for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "lost_reports update own" on public.lost_reports;
create policy "lost_reports update own" on public.lost_reports for update
  using (auth.uid() = reporter_user_id);

drop policy if exists "lost_reports delete own" on public.lost_reports;
create policy "lost_reports delete own" on public.lost_reports for delete
  using (auth.uid() = reporter_user_id);

drop trigger if exists lost_reports_set_updated_at on public.lost_reports;
create trigger lost_reports_set_updated_at
  before update on public.lost_reports
  for each row execute function public.set_updated_at();

-- ============================================================================
-- VACCINATIONS — carteira de vacinação do pet
-- ============================================================================

create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null,
  applied_at date not null,
  next_dose_at date,
  vet_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vaccinations_pet_idx on public.vaccinations(pet_id, applied_at desc);

alter table public.vaccinations enable row level security;

drop policy if exists "vaccinations read all" on public.vaccinations;
create policy "vaccinations read all" on public.vaccinations for select using (true);

drop policy if exists "vaccinations insert own pet" on public.vaccinations;
create policy "vaccinations insert own pet" on public.vaccinations for insert
  with check (exists (select 1 from public.pets where pets.id = vaccinations.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "vaccinations update own pet" on public.vaccinations;
create policy "vaccinations update own pet" on public.vaccinations for update
  using (exists (select 1 from public.pets where pets.id = vaccinations.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "vaccinations delete own pet" on public.vaccinations;
create policy "vaccinations delete own pet" on public.vaccinations for delete
  using (exists (select 1 from public.pets where pets.id = vaccinations.pet_id and pets.owner_id = auth.uid()));

drop trigger if exists vaccinations_set_updated_at on public.vaccinations;
create trigger vaccinations_set_updated_at
  before update on public.vaccinations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- MEETUP CATEGORIES + PET SOCIAL TEMPERAMENT
-- ============================================================================

-- Categoria de encontro (passeio, banho, social, etc)
alter table public.meetups add column if not exists category text default 'social';
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'meetups' and constraint_name = 'meetups_category_check'
  ) then
    alter table public.meetups
      add constraint meetups_category_check
      check (category in ('walk', 'social', 'training', 'play', 'birthday', 'bath', 'other'));
  end if;
end $$;

-- Comportamento social do pet
alter table public.pets add column if not exists social_temperament text;
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'pets' and constraint_name = 'pets_temperament_check'
  ) then
    alter table public.pets
      add constraint pets_temperament_check
      check (social_temperament is null or social_temperament in ('sociable', 'shy', 'needs_space', 'mixed'));
  end if;
end $$;

-- ============================================================================
-- SAVED POSTS (bookmarks) — salvar é ação do tutor, não do pet
-- ============================================================================

create table if not exists public.saved_posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists saved_posts_user_idx on public.saved_posts(user_id, created_at desc);

alter table public.saved_posts enable row level security;

drop policy if exists "saved_posts read own" on public.saved_posts;
create policy "saved_posts read own" on public.saved_posts for select using (auth.uid() = user_id);

drop policy if exists "saved_posts insert own" on public.saved_posts;
create policy "saved_posts insert own" on public.saved_posts for insert with check (auth.uid() = user_id);

drop policy if exists "saved_posts delete own" on public.saved_posts;
create policy "saved_posts delete own" on public.saved_posts for delete using (auth.uid() = user_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('like','comment','follow')),
  actor_pet_id uuid references public.pets(id) on delete cascade,
  target_pet_id uuid references public.pets(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read = false;

alter table public.notifications enable row level security;

drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select using (auth.uid() = user_id);

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications for update using (auth.uid() = user_id);

drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications for delete using (auth.uid() = user_id);

-- Triggers que criam notificações automaticamente
create or replace function public.notify_on_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_user uuid;
  actor_owner uuid;
  target_pet uuid;
begin
  select pe.owner_id, pe.id into target_user, target_pet
    from posts po join pets pe on pe.id = po.pet_id
    where po.id = new.post_id;
  select owner_id into actor_owner from pets where id = new.pet_id;
  if target_user is null or target_user = actor_owner then
    return new;
  end if;
  insert into notifications (user_id, kind, actor_pet_id, target_pet_id, post_id)
  values (target_user, 'like', new.pet_id, target_pet, new.post_id);
  return new;
end;
$$;

drop trigger if exists on_like_notify on public.likes;
create trigger on_like_notify
  after insert on public.likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_user uuid;
  actor_owner uuid;
  target_pet uuid;
begin
  select pe.owner_id, pe.id into target_user, target_pet
    from posts po join pets pe on pe.id = po.pet_id
    where po.id = new.post_id;
  select owner_id into actor_owner from pets where id = new.pet_id;
  if target_user is null or target_user = actor_owner then
    return new;
  end if;
  insert into notifications (user_id, kind, actor_pet_id, target_pet_id, post_id, comment_id)
  values (target_user, 'comment', new.pet_id, target_pet, new.post_id, new.id);
  return new;
end;
$$;

drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_follow()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_user uuid;
  actor_owner uuid;
begin
  select owner_id into target_user from pets where id = new.followed_pet_id;
  select owner_id into actor_owner from pets where id = new.follower_pet_id;
  if target_user is null or target_user = actor_owner then
    return new;
  end if;
  insert into notifications (user_id, kind, actor_pet_id, target_pet_id)
  values (target_user, 'follow', new.follower_pet_id, new.followed_pet_id);
  return new;
end;
$$;

drop trigger if exists on_follow_notify on public.follows;
create trigger on_follow_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ============================================================================
-- CONVERSATIONS & MESSAGES — DM tutor-a-tutor (Sprint 9)
-- ============================================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index if not exists conversations_last_msg_idx on public.conversations(last_message_at desc);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conv_participants_user_idx on public.conversation_participants(user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Helper function: checa se o user atual é participante de uma conversa.
-- SECURITY DEFINER bypassa RLS pra evitar recursão infinita nas policies.
create or replace function public.is_conversation_participant(conv_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;

-- conversations: vê quem participa
drop policy if exists "conversations read own" on public.conversations;
create policy "conversations read own" on public.conversations for select
  using (public.is_conversation_participant(id));

drop policy if exists "conversations insert auth" on public.conversations;
create policy "conversations insert auth" on public.conversations for insert with check (auth.uid() is not null);

-- participants: vê apenas linhas das conversas em que está
drop policy if exists "conv_participants read own" on public.conversation_participants;
create policy "conv_participants read own" on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "conv_participants insert self or via rpc" on public.conversation_participants;
create policy "conv_participants insert self or via rpc" on public.conversation_participants for insert
  with check (auth.uid() is not null);

drop policy if exists "conv_participants update own" on public.conversation_participants;
create policy "conv_participants update own" on public.conversation_participants for update
  using (auth.uid() = user_id);

-- messages: lê mensagens das conversas onde é participante
drop policy if exists "messages read own" on public.messages;
create policy "messages read own" on public.messages for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages insert own" on public.messages;
create policy "messages insert own" on public.messages for insert
  with check (auth.uid() = sender_id and public.is_conversation_participant(conversation_id));

-- Atualiza last_message_at quando nova mensagem chega
create or replace function public.bump_conversation_last_msg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists on_message_bump_conv on public.messages;
create trigger on_message_bump_conv
  after insert on public.messages
  for each row execute function public.bump_conversation_last_msg();

-- RPC: pega ou cria conversa 1:1 entre user atual e outro user.
-- Retorna o id da conversa. Idempotente.
create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  existing_conv uuid;
  new_conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other_user_id = me then raise exception 'cannot DM self'; end if;
  if not exists (select 1 from auth.users where id = other_user_id) then
    raise exception 'other user not found';
  end if;

  -- procura conversa 1:1 existente
  select c.id into existing_conv
  from conversations c
  join conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = me
  join conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = other_user_id
  where (select count(*) from conversation_participants where conversation_id = c.id) = 2
  limit 1;

  if existing_conv is not null then return existing_conv; end if;

  insert into conversations default values returning id into new_conv;
  insert into conversation_participants (conversation_id, user_id) values (new_conv, me), (new_conv, other_user_id);
  return new_conv;
end;
$$;

grant execute on function public.get_or_create_dm(uuid) to authenticated;

-- ============================================================================
-- PET HEALTH — medicamentos, consultas e pesagens (Sprint 10)
-- ============================================================================

-- Medicamentos: agenda + período
create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text not null check (frequency in ('daily','twice_daily','weekly','monthly','as_needed')),
  time_of_day text,                                -- ex: "08:00, 20:00"
  start_date date not null default current_date,
  end_date date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medications_pet_idx on public.medications(pet_id, active, start_date desc);

-- Log de cada dose administrada
create table if not exists public.medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  administered_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists medication_logs_med_idx on public.medication_logs(medication_id, administered_at desc);

-- Visitas ao vet — timeline
create table if not exists public.vet_visits (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  visited_at date not null,
  vet_name text,
  clinic_name text,
  reason text not null,
  diagnosis text,
  treatment text,
  weight_kg numeric(5,2),
  next_visit_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vet_visits_pet_idx on public.vet_visits(pet_id, visited_at desc);

-- Pesagens — separado pra permitir pesagem em casa sem visita
create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  weighed_at date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg < 200),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists weight_records_pet_idx on public.weight_records(pet_id, weighed_at desc);

alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.vet_visits enable row level security;
alter table public.weight_records enable row level security;

-- RLS: dono do pet faz tudo; ninguém mais vê (saúde é privada)

drop policy if exists "medications own" on public.medications;
create policy "medications own" on public.medications for all
  using (exists (select 1 from public.pets where pets.id = medications.pet_id and pets.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets where pets.id = medications.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "medication_logs own" on public.medication_logs;
create policy "medication_logs own" on public.medication_logs for all
  using (exists (
    select 1 from public.medications m join public.pets p on p.id = m.pet_id
    where m.id = medication_logs.medication_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.medications m join public.pets p on p.id = m.pet_id
    where m.id = medication_logs.medication_id and p.owner_id = auth.uid()
  ));

drop policy if exists "vet_visits own" on public.vet_visits;
create policy "vet_visits own" on public.vet_visits for all
  using (exists (select 1 from public.pets where pets.id = vet_visits.pet_id and pets.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets where pets.id = vet_visits.pet_id and pets.owner_id = auth.uid()));

drop policy if exists "weight_records own" on public.weight_records;
create policy "weight_records own" on public.weight_records for all
  using (exists (select 1 from public.pets where pets.id = weight_records.pet_id and pets.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets where pets.id = weight_records.pet_id and pets.owner_id = auth.uid()));

drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function public.set_updated_at();

drop trigger if exists vet_visits_set_updated_at on public.vet_visits;
create trigger vet_visits_set_updated_at
  before update on public.vet_visits
  for each row execute function public.set_updated_at();

-- ============================================================================
-- BLOCKS & REPORTS — Privacidade e Moderação (Sprint 11)
-- ============================================================================

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocked_users_blocker_idx on public.blocked_users(blocker_id);

alter table public.blocked_users enable row level security;

drop policy if exists "blocks own select" on public.blocked_users;
create policy "blocks own select" on public.blocked_users for select using (auth.uid() = blocker_id);

drop policy if exists "blocks own insert" on public.blocked_users;
create policy "blocks own insert" on public.blocked_users for insert with check (auth.uid() = blocker_id);

drop policy if exists "blocks own delete" on public.blocked_users;
create policy "blocks own delete" on public.blocked_users for delete using (auth.uid() = blocker_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_kind text not null check (target_kind in ('post','comment','user','pet','message','lost_report')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','inappropriate','animal_abuse','impersonation','misinformation','other')),
  notes text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now()
);
create index if not exists reports_reporter_idx on public.reports(reporter_user_id, created_at desc);
create index if not exists reports_target_idx on public.reports(target_kind, target_id);

alter table public.reports enable row level security;

drop policy if exists "reports own select" on public.reports;
create policy "reports own select" on public.reports for select using (auth.uid() = reporter_user_id);

drop policy if exists "reports own insert" on public.reports;
create policy "reports own insert" on public.reports for insert with check (auth.uid() = reporter_user_id);

-- ============================================================================
-- HASHTAGS & MENTIONS (Sprint 12)
-- ============================================================================

create table if not exists public.hashtags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists hashtags_name_idx on public.hashtags(lower(name));

create table if not exists public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag_id uuid not null references public.hashtags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, hashtag_id)
);
create index if not exists post_hashtags_tag_idx on public.post_hashtags(hashtag_id, created_at desc);

alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;

drop policy if exists "hashtags read all" on public.hashtags;
create policy "hashtags read all" on public.hashtags for select using (true);

drop policy if exists "hashtags insert auth" on public.hashtags;
create policy "hashtags insert auth" on public.hashtags for insert with check (auth.uid() is not null);

drop policy if exists "post_hashtags read all" on public.post_hashtags;
create policy "post_hashtags read all" on public.post_hashtags for select using (true);

drop policy if exists "post_hashtags insert own post" on public.post_hashtags;
create policy "post_hashtags insert own post" on public.post_hashtags for insert
  with check (exists (
    select 1 from public.posts po join public.pets pe on pe.id = po.pet_id
    where po.id = post_hashtags.post_id and pe.owner_id = auth.uid()
  ));

drop policy if exists "post_hashtags delete own post" on public.post_hashtags;
create policy "post_hashtags delete own post" on public.post_hashtags for delete
  using (exists (
    select 1 from public.posts po join public.pets pe on pe.id = po.pet_id
    where po.id = post_hashtags.post_id and pe.owner_id = auth.uid()
  ));

-- Estende notifications pra suportar menção (@ user)
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'notifications' and constraint_name = 'notifications_kind_check'
  ) then
    -- Já existe? primeiro drop o antigo via constraint name
    null;
  end if;
end $$;

-- Atualiza o check pra incluir 'mention' (drop e recria a constraint)
do $$
begin
  alter table public.notifications drop constraint if exists notifications_kind_check;
  alter table public.notifications add constraint notifications_kind_check
    check (kind in ('like','comment','follow','mention'));
exception when others then null;
end $$;

-- ============================================================================
-- PUSH TOKENS — Expo notifications (Sprint 13, usado em mobile build)
-- ============================================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens own all" on public.push_tokens;
create policy "push_tokens own all" on public.push_tokens for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- PLACES — pet shops, vets, hotéis, parques (Sprint 14)
-- ============================================================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('vet','pet_shop','hotel','daycare','park','grooming','training','other')),
  description text,
  address text not null,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  hours text,
  photo_url text,
  added_by_user_id uuid references auth.users(id) on delete set null,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists places_kind_idx on public.places(kind, city);
create index if not exists places_city_idx on public.places(city);

create table if not exists public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);
create index if not exists place_reviews_place_idx on public.place_reviews(place_id, created_at desc);

alter table public.places enable row level security;
alter table public.place_reviews enable row level security;

drop policy if exists "places read all" on public.places;
create policy "places read all" on public.places for select using (true);

drop policy if exists "places insert auth" on public.places;
create policy "places insert auth" on public.places for insert
  with check (auth.uid() is not null and auth.uid() = added_by_user_id);

drop policy if exists "places update own" on public.places;
create policy "places update own" on public.places for update
  using (auth.uid() = added_by_user_id);

drop policy if exists "place_reviews read all" on public.place_reviews;
create policy "place_reviews read all" on public.place_reviews for select using (true);

drop policy if exists "place_reviews insert own" on public.place_reviews;
create policy "place_reviews insert own" on public.place_reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists "place_reviews update own" on public.place_reviews;
create policy "place_reviews update own" on public.place_reviews for update
  using (auth.uid() = user_id);

drop policy if exists "place_reviews delete own" on public.place_reviews;
create policy "place_reviews delete own" on public.place_reviews for delete
  using (auth.uid() = user_id);

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

drop trigger if exists place_reviews_set_updated_at on public.place_reviews;
create trigger place_reviews_set_updated_at
  before update on public.place_reviews
  for each row execute function public.set_updated_at();

-- View com média de rating por lugar
create or replace view public.place_stats as
select
  p.id as place_id,
  coalesce(avg(r.rating)::numeric(3,2), 0) as avg_rating,
  count(r.id)::int as review_count
from public.places p
left join public.place_reviews r on r.place_id = p.id
group by p.id;

-- ============================================================================
-- SUBSCRIPTIONS — Pet Pro Premium (Sprint 16, monetização)
-- ============================================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  status text not null default 'free'
    check (status in ('free','active','trialing','past_due','canceled','incomplete')),
  plan text check (plan in ('monthly','yearly')),
  -- Stripe IDs (preenchidos quando paga)
  stripe_customer_id text,
  stripe_subscription_id text unique,
  -- Mercado Pago IDs (Pix BR)
  mp_customer_id text,
  mp_subscription_id text,
  -- Período da cobrança ativa
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- Trial gratuito de 7 dias (futuro)
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status) where status != 'free';

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions read own" on public.subscriptions;
create policy "subscriptions read own" on public.subscriptions for select using (auth.uid() = user_id);

-- Insert/update apenas via SECURITY DEFINER functions (webhook do Stripe/MP)
drop policy if exists "subscriptions insert own free" on public.subscriptions;
create policy "subscriptions insert own free" on public.subscriptions for insert
  with check (auth.uid() = user_id and status = 'free');

-- Log de eventos de assinatura (auditoria + analytics)
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in (
    'checkout_started','subscription_created','payment_succeeded','payment_failed',
    'subscription_canceled','subscription_renewed','trial_started','trial_ended','plan_changed'
  )),
  provider text check (provider in ('stripe','mercadopago','manual')),
  amount_cents int,
  currency text default 'BRL',
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists subscription_events_user_idx on public.subscription_events(user_id, created_at desc);

alter table public.subscription_events enable row level security;

drop policy if exists "subscription_events read own" on public.subscription_events;
create policy "subscription_events read own" on public.subscription_events for select using (auth.uid() = user_id);

-- Trigger pra criar subscription 'free' default quando user é criado
create or replace function public.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, status)
  values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_default_sub on public.profiles;
create trigger on_profile_created_default_sub
  after insert on public.profiles
  for each row execute function public.create_default_subscription();

-- Backfill subscriptions pra usuários existentes
insert into public.subscriptions (user_id, status)
select id, 'free' from public.profiles
on conflict (user_id) do nothing;

-- Helper: o user atual é Pro?
create or replace function public.is_user_pro()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select status in ('active','trialing') from public.subscriptions where user_id = auth.uid()),
    false
  );
$$;

-- Fonte UNICA desta funcao (free-tier-limits.sql aponta pra ca). Conta 'trialing'
-- como Pro, igual sync_profile_is_pro (admin-grant-pro.sql).
revoke all on function public.is_user_pro() from public;
grant execute on function public.is_user_pro() to authenticated;

-- updated_at automático
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- MEGA 17 — Memorial + Personality + AI Assistant (Sprint 17)
-- ============================================================================

-- 1. Pet Memorial — quando pet vai para a ponte do arco-íris
alter table public.pets add column if not exists memorial_at date;
alter table public.pets add column if not exists memorial_note text;

create table if not exists public.memorial_messages (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (length(message) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists memorial_messages_pet_idx on public.memorial_messages(pet_id, created_at desc);

alter table public.memorial_messages enable row level security;

drop policy if exists "memorial_messages read all" on public.memorial_messages;
create policy "memorial_messages read all" on public.memorial_messages for select using (true);

drop policy if exists "memorial_messages insert auth" on public.memorial_messages;
create policy "memorial_messages insert auth" on public.memorial_messages for insert
  with check (auth.uid() = author_user_id);

drop policy if exists "memorial_messages delete own" on public.memorial_messages;
create policy "memorial_messages delete own" on public.memorial_messages for delete
  using (auth.uid() = author_user_id);

-- 2. Personality — resultado do quiz
alter table public.pets add column if not exists personality_type text
  check (personality_type is null or personality_type in (
    'adventurer','cuddler','playful','shy','independent','royal'
  ));
alter table public.pets add column if not exists personality_taken_at timestamptz;

-- 3. AI Assistant — conversas com IA treinada
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_idx on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null check (length(content) between 1 and 8000),
  tokens_used int,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv_idx on public.ai_messages(conversation_id, created_at);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "ai_conv own" on public.ai_conversations;
create policy "ai_conv own" on public.ai_conversations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_msg own" on public.ai_messages;
create policy "ai_msg own" on public.ai_messages for all
  using (exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
  ));

drop trigger if exists ai_conv_set_updated_at on public.ai_conversations;
create trigger ai_conv_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();

-- ============================================================================
-- REALTIME — adicionar tabelas à publication pra Supabase Realtime stream
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.likes;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.comments;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
