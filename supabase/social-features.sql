-- ============================================================================
-- SOCIAL FEATURES: Editar/apagar comentários, replies, curtir, repost, tags
-- ============================================================================

-- ===== 1. Comments: updated_at + trigger ====================================
alter table public.comments
  add column if not exists updated_at timestamptz;

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_id_idx on public.comments(parent_id);

create or replace function public.touch_comment_updated_at()
returns trigger language plpgsql as $func$
begin
  if new.content is distinct from old.content then
    new.updated_at := now();
  end if;
  return new;
end;
$func$;

drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at
  before update on public.comments
  for each row execute function public.touch_comment_updated_at();

-- RLS pra editar/apagar comentários (só autor)
do $$
begin
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
end$$;

-- ===== 2. Comment likes =====================================================
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, pet_id)
);

create index if not exists comment_likes_comment_id_idx on public.comment_likes(comment_id);
create index if not exists comment_likes_pet_id_idx on public.comment_likes(pet_id);

alter table public.comment_likes enable row level security;

do $$
begin
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
end$$;

-- ===== 3. Repost: posts.reposted_from =======================================
alter table public.posts
  add column if not exists reposted_from uuid references public.posts(id) on delete set null;

create index if not exists posts_reposted_from_idx on public.posts(reposted_from);

-- ===== 4. Post pet tags (mencionar outros pets no post) =====================
create table if not exists public.post_pet_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tagged_pet_id uuid not null references public.pets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, tagged_pet_id)
);

create index if not exists post_pet_tags_post_id_idx on public.post_pet_tags(post_id);
create index if not exists post_pet_tags_tagged_pet_idx on public.post_pet_tags(tagged_pet_id);

alter table public.post_pet_tags enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_read') then
    create policy post_pet_tags_read on public.post_pet_tags for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_insert') then
    -- Só o dono do pet do post pode adicionar tags
    create policy post_pet_tags_insert on public.post_pet_tags for insert with check (
      exists (
        select 1 from public.posts p
        join public.pets pe on pe.id = p.pet_id
        where p.id = post_pet_tags.post_id and pe.owner_id = auth.uid()
      )
    );
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_pet_tags' and policyname='post_pet_tags_delete') then
    create policy post_pet_tags_delete on public.post_pet_tags for delete using (
      exists (
        select 1 from public.posts p
        join public.pets pe on pe.id = p.pet_id
        where p.id = post_pet_tags.post_id and pe.owner_id = auth.uid()
      )
    );
  end if;
end$$;

-- ===== 5. Post edit history (Pro feature) ===================================
create table if not exists public.post_edit_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  previous_caption text,
  edited_at timestamptz not null default now()
);

create index if not exists post_edit_history_post_id_idx on public.post_edit_history(post_id);

alter table public.post_edit_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='post_edit_history' and policyname='post_edit_history_read') then
    -- Qualquer um pode ler histórico (transparência social)
    create policy post_edit_history_read on public.post_edit_history for select using (true);
  end if;
end$$;

-- Trigger: ao editar caption, salvar versão anterior no histórico
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
create trigger posts_archive_edits
  before update on public.posts
  for each row execute function public.archive_post_edit();

-- ===== 6. View: comments_with_counts (otimização de fetch) ==================
create or replace view public.comments_with_counts as
select
  c.*,
  coalesce((select count(*) from public.comment_likes cl where cl.comment_id = c.id), 0) as likes_count,
  coalesce((select count(*) from public.comments cr where cr.parent_id = c.id), 0) as replies_count
from public.comments c;

notify pgrst, 'reload schema';
