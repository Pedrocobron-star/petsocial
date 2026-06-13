-- Feed v128 — repost sem duplicar + resposta notifica o autor do comentário pai.
-- Idempotente. Aplicar no SQL Editor do Supabase.

-- ============================================================================
-- 1) REPOST: 1 por pet por post original
-- ============================================================================
-- Antes não havia guarda: o mesmo pet podia repostar o mesmo post infinitas
-- vezes. Primeiro removemos duplicatas pré-existentes (mantém a mais antiga por
-- pet+original), depois criamos o índice único que garante no banco.
delete from public.posts p
using public.posts q
where p.reposted_from is not null
  and p.reposted_from = q.reposted_from
  and p.pet_id = q.pet_id
  and (p.created_at > q.created_at or (p.created_at = q.created_at and p.id > q.id));

create unique index if not exists posts_unique_repost
  on public.posts (pet_id, reposted_from)
  where reposted_from is not null;

-- ============================================================================
-- 2) RESPOSTA A COMENTÁRIO notifica o autor do comentário pai
-- ============================================================================
-- Antes notify_on_comment só avisava o DONO DO POST. Quem era respondido num
-- comentário (new.parent_id) nunca recebia notificação — conversa de reply
-- ficava muda. Agora avisa também o autor do comentário pai (sem duplicar se
-- ele já é o dono do post, e sem notificar o próprio autor da resposta).
create or replace function public.notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_user uuid;
  actor_owner uuid;
  target_pet uuid;
  parent_owner uuid;
  parent_pet uuid;
begin
  select owner_id into actor_owner from pets where id = new.pet_id;

  -- (a) dono do post — comportamento original
  select pe.owner_id, pe.id into target_user, target_pet
    from posts po join pets pe on pe.id = po.pet_id
    where po.id = new.post_id;
  if target_user is not null and target_user <> actor_owner then
    insert into notifications (user_id, kind, actor_pet_id, target_pet_id, post_id, comment_id)
    values (target_user, 'comment', new.pet_id, target_pet, new.post_id, new.id);
  end if;

  -- (b) autor do comentário pai (só em respostas), se for outra pessoa
  if new.parent_id is not null then
    select pe.owner_id, pe.id into parent_owner, parent_pet
      from comments c join pets pe on pe.id = c.pet_id
      where c.id = new.parent_id;
    if parent_owner is not null
       and parent_owner <> actor_owner
       and parent_owner is distinct from target_user then
      insert into notifications (user_id, kind, actor_pet_id, target_pet_id, post_id, comment_id)
      values (parent_owner, 'comment', new.pet_id, parent_pet, new.post_id, new.id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_notify on public.comments;
create trigger on_comment_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();
