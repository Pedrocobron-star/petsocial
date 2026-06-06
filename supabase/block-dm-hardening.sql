-- ============================================================================
-- Hardening de DM: impedir mensagem entre usuários bloqueados (nos 2 sentidos)
-- Rode no Supabase SQL Editor. Idempotente e ADITIVO (não altera RLS/funções
-- existentes, então não há risco de quebrar DMs que já funcionam).
--
-- Contexto: o app já bloqueia o botão "Mensagem" no cliente quando VOCÊ bloqueou
-- o tutor, mas isso não cobre "ele me bloqueou" nem chamadas diretas à API.
-- Este trigger garante no banco que nenhuma mensagem seja inserida se houver
-- bloqueio entre o remetente e o outro participante da conversa.
-- ============================================================================

-- Helper: existe bloqueio entre A e B (qualquer direção)?
create or replace function public.has_block_between(a uuid, b uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.has_block_between(uuid, uuid) to authenticated;

-- Trigger: barra INSERT de mensagem se há bloqueio com o outro participante.
create or replace function public.enforce_dm_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_id uuid;
begin
  select user_id into other_id
    from public.conversation_participants
    where conversation_id = new.conversation_id
      and user_id <> new.sender_id
    limit 1;

  if other_id is not null and public.has_block_between(new.sender_id, other_id) then
    raise exception 'Não é possível enviar: há bloqueio entre os usuários.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_dm_block on public.messages;
create trigger trg_enforce_dm_block
  before insert on public.messages
  for each row execute function public.enforce_dm_block();

-- OPCIONAL: também impedir ABRIR a conversa. O trigger acima já impede o ENVIO
-- (a proteção essencial contra assédio). Se quiser bloquear até a criação do DM,
-- edite a função get_or_create_dm pra dar `raise exception` quando
-- has_block_between(auth.uid(), p_other_user_id) for verdadeiro.
