-- ============================================================================
-- CHAT / DM — Hardening de seguranca (Onda 1 da auditoria do Mensagens)
--
-- Fecha:
-- (1) IDOR/RLS: a policy de INSERT em conversation_participants era
--     `with check (auth.uid() is not null)` — qualquer autenticado podia se
--     inserir como participante de uma conversa ALHEIA (sabendo o uuid) e LER a
--     DM de terceiros (is_conversation_participant passa a valer). Mesmo padrao
--     na policy de INSERT de conversations e no UPDATE sem with check.
--     -> O app NUNCA insere participant/conversation pelo cliente: a unica
--        criacao e via get_or_create_dm (SECURITY DEFINER, dono=postgres,
--        bypassa RLS/grants). Logo REVOGAR o insert direto nao quebra nada.
-- (2) Bloqueio de DM: consolida has_block_between + trigger enforce_dm_block no
--     schema canonico (antes so no avulso block-dm-hardening.sql) e faz
--     get_or_create_dm RECUSAR abrir a conversa quando ha bloqueio (defesa em
--     profundidade alem do gate do cliente).
--
-- Idempotente + REPLAY-SAFE. ASCII-only (seguro pra colar no editor SQL).
-- ============================================================================

-- ---- (2a) Helper: existe bloqueio entre A e B (qualquer direcao)? ----------
create or replace function public.has_block_between(a uuid, b uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;
grant execute on function public.has_block_between(uuid, uuid) to authenticated;

-- ---- (2b) Trigger: barra INSERT de mensagem se ha bloqueio -----------------
create or replace function public.enforce_dm_block()
returns trigger language plpgsql security definer set search_path = public as $$
declare other_id uuid;
begin
  select user_id into other_id
    from public.conversation_participants
    where conversation_id = new.conversation_id and user_id <> new.sender_id
    limit 1;
  if other_id is not null and public.has_block_between(new.sender_id, other_id) then
    raise exception 'Nao e possivel enviar: ha bloqueio entre os usuarios.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_dm_block on public.messages;
create trigger trg_enforce_dm_block
  before insert on public.messages
  for each row execute function public.enforce_dm_block();

-- ---- (2c) get_or_create_dm recusa quando ha bloqueio -----------------------
-- (mesma funcao do schema.sql + a checagem de bloqueio; abrir DM da lista de
--  conversas NAO passa por aqui, entao ler historico antigo segue possivel; o
--  que isto barra e INICIAR/reabrir a DM pelo perfil quando ha bloqueio.)
create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
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
  if public.has_block_between(me, other_user_id) then
    raise exception 'Nao e possivel abrir conversa: ha bloqueio entre os usuarios.' using errcode = 'P0001';
  end if;

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

-- ---- (1) TRANCAR o insert direto (IDOR) ------------------------------------
-- So get_or_create_dm (definer) escreve em conversations/conversation_participants.
drop policy if exists "conversations insert auth" on public.conversations;
drop policy if exists "conv_participants insert self or via rpc" on public.conversation_participants;
revoke insert on public.conversations from authenticated, anon;
revoke insert on public.conversation_participants from authenticated, anon;

-- UPDATE de participant: so a propria linha, e com with check (antes faltava).
-- O cliente so atualiza last_read_at (markConversationRead).
drop policy if exists "conv_participants update own" on public.conversation_participants;
create policy "conv_participants update own" on public.conversation_participants for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba NOVA do editor):
--   select count(*) from pg_policies where tablename='conversation_participants' and cmd='INSERT'; -- 0
--   select count(*) from pg_policies where tablename='conversations' and cmd='INSERT';            -- 0
--   select has_table_privilege('authenticated','public.conversation_participants','insert'),
--          has_table_privilege('authenticated','public.conversations','insert');                  -- f,f
--   select count(*) from pg_trigger where tgname='trg_enforce_dm_block';                          -- 1
--   select pg_get_functiondef('public.get_or_create_dm(uuid)'::regprocedure) like '%has_block_between%'; -- t
-- ============================================================================
