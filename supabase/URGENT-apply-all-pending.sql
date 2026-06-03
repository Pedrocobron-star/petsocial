-- =============================================================================
-- ⚠️ MIGRATIONS PENDENTES — DESCOBERTAS NO QA
-- =============================================================================
-- O QA do tour autenticado revelou que as ALTER TABLE/CREATE TABLE que foram
-- rodadas via Chrome MCP no SQL Editor NÃO foram aplicadas no banco — apesar
-- do dashboard ter mostrado "success". Provavelmente o Run query do confirm
-- dialog não foi clicado.
--
-- COMO RODAR:
-- 1. Abra https://supabase.com/dashboard/project/aefrcwysifgniogumxwk/sql/new
-- 2. Cole o SQL abaixo todo de uma vez
-- 3. Clique em "Run" (Ctrl+Enter) e CONFIRME o dialog se aparecer
-- 4. Aguarde "Success" no painel inferior
-- =============================================================================

-- ===== POSTS: editar tracking + repost ============================
alter table public.posts add column if not exists updated_at timestamptz;
alter table public.posts add column if not exists reposted_from uuid references public.posts(id) on delete set null;
create index if not exists posts_reposted_from_idx on public.posts(reposted_from);

create or replace function public.touch_post_updated_at()
returns trigger language plpgsql as $func$
begin
  if new.caption is distinct from old.caption then new.updated_at := now(); end if;
  return new;
end;
$func$;
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts for each row execute function public.touch_post_updated_at();

-- ===== COMMENTS: edit tracking + replies ===========================
alter table public.comments add column if not exists updated_at timestamptz;
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_id_idx on public.comments(parent_id);

create or replace function public.touch_comment_updated_at()
returns trigger language plpgsql as $func$
begin
  if new.content is distinct from old.content then new.updated_at := now(); end if;
  return new;
end;
$func$;
drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at before update on public.comments for each row execute function public.touch_comment_updated_at();

-- ===== COMMENT LIKES (nova tabela) ================================
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, pet_id)
);
create index if not exists comment_likes_comment_id_idx on public.comment_likes(comment_id);
create index if not exists comment_likes_pet_id_idx on public.comment_likes(pet_id);
alter table public.comment_likes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_read') then
    create policy comment_likes_read on public.comment_likes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_insert') then
    create policy comment_likes_insert on public.comment_likes for insert with check (
      exists (select 1 from public.pets where pets.id = comment_likes.pet_id and pets.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comment_likes' and policyname='comment_likes_delete') then
    create policy comment_likes_delete on public.comment_likes for delete using (
      exists (select 1 from public.pets where pets.id = comment_likes.pet_id and pets.owner_id = auth.uid())
    );
  end if;
end $$;

-- ===== POST PET TAGS (nova tabela) =================================
create table if not exists public.post_pet_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tagged_pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_pet_id)
);
create index if not exists post_pet_tags_post_id_idx on public.post_pet_tags(post_id);
create index if not exists post_pet_tags_tagged_pet_idx on public.post_pet_tags(tagged_pet_id);
alter table public.post_pet_tags enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_read') then
    create policy post_pet_tags_read on public.post_pet_tags for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_insert') then
    create policy post_pet_tags_insert on public.post_pet_tags for insert with check (
      exists (select 1 from public.posts p join public.pets pe on pe.id = p.pet_id where p.id = post_pet_tags.post_id and pe.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_delete') then
    create policy post_pet_tags_delete on public.post_pet_tags for delete using (
      exists (select 1 from public.posts p join public.pets pe on pe.id = p.pet_id where p.id = post_pet_tags.post_id and pe.owner_id = auth.uid())
    );
  end if;
end $$;

-- ===== POST EDIT HISTORY (Pro feature) ===========================
create table if not exists public.post_edit_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  previous_caption text,
  edited_at timestamptz not null default now()
);
create index if not exists post_edit_history_post_id_idx on public.post_edit_history(post_id);
alter table public.post_edit_history enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_edit_history' and policyname='post_edit_history_read') then
    create policy post_edit_history_read on public.post_edit_history for select using (true);
  end if;
end $$;

create or replace function public.archive_post_edit()
returns trigger language plpgsql security definer as $func$
begin
  if old.caption is distinct from new.caption then
    insert into public.post_edit_history (post_id, previous_caption, edited_at)
    values (old.id, old.caption, now());
  end if;
  return new;
end;
$func$;
drop trigger if exists posts_archive_edits on public.posts;
create trigger posts_archive_edits before update on public.posts for each row execute function public.archive_post_edit();

-- ===== POSTS RLS (edit/delete só pelo dono) =====================
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posts' and policyname='posts_owner_update') then
    create policy posts_owner_update on public.posts for update using (
      exists (select 1 from public.pets where pets.id = posts.pet_id and pets.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='posts' and policyname='posts_owner_delete') then
    create policy posts_owner_delete on public.posts for delete using (
      exists (select 1 from public.pets where pets.id = posts.pet_id and pets.owner_id = auth.uid())
    );
  end if;
end $$;

-- ===== COMMENTS RLS ==============================================
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_owner_update') then
    create policy comments_owner_update on public.comments for update using (
      exists (select 1 from public.pets where pets.id = comments.pet_id and pets.owner_id = auth.uid())
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='comments' and policyname='comments_owner_delete') then
    create policy comments_owner_delete on public.comments for delete using (
      exists (select 1 from public.pets where pets.id = comments.pet_id and pets.owner_id = auth.uid())
    );
  end if;
end $$;

-- ===== PROFILES: push token + LGPD ==============================
alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists push_token_updated_at timestamptz;
create index if not exists profiles_push_token_idx on public.profiles(push_token) where push_token is not null;

-- ===== RPCs: notify_pet_tag, notify_mention, delete, export =====
create or replace function public.notify_pet_tag(
  tagged_pet uuid, actor_pet uuid, post_id_param uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare actor_owner uuid; tagged_owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select owner_id into actor_owner from pets where id = actor_pet;
  if actor_owner is null or actor_owner <> auth.uid() then raise exception 'pet not owned by current user'; end if;
  select owner_id into tagged_owner from pets where id = tagged_pet;
  if tagged_owner is null or tagged_owner = auth.uid() then return; end if;
  insert into notifications (user_id, kind, actor_pet_id, post_id, target_pet_id)
  values (tagged_owner, 'pet_tagged', actor_pet, post_id_param, tagged_pet);
end;
$$;
grant execute on function public.notify_pet_tag(uuid, uuid, uuid) to authenticated;

-- Constraint pra aceitar 'pet_tagged' como kind
do $$ begin
  alter table public.notifications drop constraint if exists notifications_kind_check;
  alter table public.notifications add constraint notifications_kind_check
    check (kind in ('like', 'comment', 'follow', 'mention', 'pet_tagged'));
exception when others then null;
end $$;

-- ===== LGPD: delete_my_account + export_my_data =================
create or replace function public.delete_my_account()
returns json language plpgsql security definer set search_path = public as $func$
declare
  uid uuid; pets_count int; posts_count int; reports_count int; reviews_count int;
begin
  uid := auth.uid();
  if uid is null then raise exception 'Não autenticado'; end if;
  select count(*) into pets_count from public.pets where owner_id = uid;
  select count(*) into posts_count from public.posts p join public.pets pe on pe.id = p.pet_id where pe.owner_id = uid;
  select count(*) into reports_count from public.lost_reports where reporter_user_id = uid;
  select count(*) into reviews_count from public.place_reviews where user_id = uid;
  delete from public.posts where pet_id in (select id from public.pets where owner_id = uid);
  delete from public.lost_reports where reporter_user_id = uid;
  delete from public.place_reviews where user_id = uid;
  delete from public.memorial_messages where user_id = uid;
  delete from public.messages where sender_id = uid;
  delete from public.conversation_participants where user_id = uid;
  delete from public.reports where reporter_user_id = uid;
  delete from public.blocked_users where blocker_id = uid or blocked_id = uid;
  delete from public.ai_conversations where user_id = uid;
  delete from public.subscriptions where user_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.saved_posts where user_id = uid;
  begin delete from public.pet_caretakers where invited_by = uid or user_id = uid;
  exception when undefined_table then null; end;
  delete from public.pets where owner_id = uid;
  delete from public.profiles where id = uid;
  return json_build_object('success', true, 'pets_deleted', pets_count, 'posts_deleted', posts_count, 'lost_reports_deleted', reports_count, 'place_reviews_deleted', reviews_count, 'note', 'Conta de auth permanece até processamento admin (geralmente 30 dias)');
end;
$func$;
revoke all on function public.delete_my_account from public, anon;
grant execute on function public.delete_my_account to authenticated;

create or replace function public.export_my_data()
returns json language plpgsql security definer set search_path = public as $func$
declare uid uuid; result json;
begin
  uid := auth.uid();
  if uid is null then raise exception 'Não autenticado'; end if;
  select json_build_object(
    'export_date', now(), 'user_id', uid,
    'profile', (select row_to_json(p) from public.profiles p where p.id = uid),
    'pets', (select json_agg(row_to_json(pe)) from public.pets pe where pe.owner_id = uid),
    'posts', (select json_agg(row_to_json(po)) from public.posts po join public.pets pe on pe.id = po.pet_id where pe.owner_id = uid),
    'lost_reports', (select json_agg(row_to_json(lr)) from public.lost_reports lr where lr.reporter_user_id = uid),
    'place_reviews', (select json_agg(row_to_json(pr)) from public.place_reviews pr where pr.user_id = uid),
    'subscription', (select row_to_json(s) from public.subscriptions s where s.user_id = uid)
  ) into result;
  return result;
end;
$func$;
revoke all on function public.export_my_data from public, anon;
grant execute on function public.export_my_data to authenticated;

-- ===== FINAL: recarrega schema cache do PostgREST =================
notify pgrst, 'reload schema';

-- ✅ TODAS AS MIGRATIONS PENDENTES APLICADAS
