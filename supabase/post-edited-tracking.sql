-- ============================================================================
-- POST EDITED TRACKING
-- ============================================================================
-- Adiciona updated_at em posts pra rastrear quando foram editados.
-- Trigger atualiza updated_at automaticamente em UPDATE da caption.
-- Frontend mostra "editado" quando updated_at > created_at + tolerância.
-- ============================================================================

-- 1. Adiciona coluna se não existir
alter table public.posts
  add column if not exists updated_at timestamptz;

-- 2. Backfill: posts antigos não foram editados (updated_at = null)
-- Não fazer SET updated_at = created_at pra não marcar tudo como "editado".

-- 3. Trigger que atualiza updated_at quando caption muda
create or replace function public.touch_post_updated_at()
returns trigger
language plpgsql
as $func$
begin
  -- Só marca como editado se a caption realmente mudou
  if new.caption is distinct from old.caption then
    new.updated_at := now();
  end if;
  return new;
end;
$func$;

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row
  execute function public.touch_post_updated_at();

-- 4. RLS: garantir que só o dono do pet do post pode editar/deletar
-- (provavelmente já existe, mas garantindo)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'posts_owner_update'
  ) then
    create policy posts_owner_update on public.posts
      for update using (
        exists (
          select 1 from public.pets
          where pets.id = posts.pet_id
            and pets.owner_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts'
      and policyname = 'posts_owner_delete'
  ) then
    create policy posts_owner_delete on public.posts
      for delete using (
        exists (
          select 1 from public.pets
          where pets.id = posts.pet_id
            and pets.owner_id = auth.uid()
        )
      );
  end if;
end$$;

notify pgrst, 'reload schema';
