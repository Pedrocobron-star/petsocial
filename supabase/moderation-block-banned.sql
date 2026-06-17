-- ============================================================================
-- Maestro Pet — Usuário banido não comenta nem manda DM
--
-- O enforce_not_banned() (admin-moderation.sql) só estava ligado em POSTS. Um
-- banido seguia comentando e mandando mensagem. Aqui fechamos os outros 2:
--   - comments: reusa enforce_not_banned (comments têm pet_id → dono → banned)
--   - messages: nova função pelo sender_id (auth.users) → profiles.banned_at
-- Mesmo padrão: só relança o erro de ban; outro erro não bloqueia a ação.
-- Idempotente. Aplicar depois de admin-moderation.sql.
-- ============================================================================

-- Comentário: banido não comenta (reusa a função existente; comments.pet_id)
drop trigger if exists comments_block_banned on public.comments;
create trigger comments_block_banned before insert on public.comments
  for each row execute function public.enforce_not_banned();

-- Mensagem/DM: banido não envia (checa sender_id direto)
create or replace function public.enforce_not_banned_sender()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.profiles pr
    where pr.id = new.sender_id and pr.banned_at is not null
  ) then
    raise exception 'Conta suspensa: não é possível enviar mensagens.' using errcode = 'P0001';
  end if;
  return new;
exception when others then
  if sqlerrm like 'Conta suspensa%' then raise; end if;
  return new;
end;
$$;
drop trigger if exists messages_block_banned on public.messages;
create trigger messages_block_banned before insert on public.messages
  for each row execute function public.enforce_not_banned_sender();

-- ============================================================================
-- FIM. Agora o ban cobre post + comentário + DM.
-- ============================================================================
