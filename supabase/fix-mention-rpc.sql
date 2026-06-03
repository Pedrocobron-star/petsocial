-- Fix: notify_mention RPC pra criar notificações de menção
-- A tabela notifications não tem policy INSERT explícita (só era preenchida por triggers SECURITY DEFINER).
-- Pra menções vindas do cliente, criamos uma RPC SECURITY DEFINER que bypassa RLS.

create or replace function public.notify_mention(
  target_user uuid,
  actor_pet uuid,
  post_id_param uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_owner uuid;
begin
  -- Sanity checks
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  -- O actor_pet precisa ser do user atual (não pode menção em nome de outro)
  select owner_id into actor_owner from pets where id = actor_pet;
  if actor_owner is null or actor_owner <> auth.uid() then
    raise exception 'pet not owned by current user';
  end if;
  -- Não notifica a si mesmo
  if target_user = auth.uid() then return; end if;
  -- Insere
  insert into notifications (user_id, kind, actor_pet_id, post_id)
  values (target_user, 'mention', actor_pet, post_id_param);
end;
$$;

grant execute on function public.notify_mention(uuid, uuid, uuid) to authenticated;
