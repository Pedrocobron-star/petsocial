-- ============================================================================
-- Maestro Pet -- LGPD: registro de pedidos de exportar/excluir conta (compliance)
-- O app ja faz export/delete self-service (instantaneo). Isto cria a TRILHA pro
-- admin provar que respondeu (quem pediu, o que, quando). Idempotente. ASCII.
-- ============================================================================

create table if not exists public.lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,  -- sobrevive a exclusao da conta
  email text,
  kind text not null check (kind in ('export', 'delete')),
  status text not null default 'completed' check (status in ('pending', 'completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);
create index if not exists lgpd_requests_at_idx on public.lgpd_requests(requested_at desc);

alter table public.lgpd_requests enable row level security;
revoke all on public.lgpd_requests from anon, authenticated;  -- escrita so via RPC
drop policy if exists lgpd_admin_read on public.lgpd_requests;
create policy lgpd_admin_read on public.lgpd_requests for select to authenticated using (public.is_admin());

-- Loga um pedido do PROPRIO usuario (chamado pelo account.tsx em export/delete).
create or replace function public.lgpd_log_request(p_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_kind not in ('export', 'delete') then return; end if;
  insert into public.lgpd_requests(user_id, email, kind, status, completed_at)
  values (auth.uid(), auth.jwt() ->> 'email', p_kind, 'completed', now());
exception when others then
  return;  -- best-effort: logar nunca pode quebrar o export/delete do usuario
end;
$$;
revoke all on function public.lgpd_log_request(text) from public, anon;
grant execute on function public.lgpd_log_request(text) to authenticated;

-- Admin marca/anota (ex.: pedido recebido por e-mail, processado a mao).
create or replace function public.admin_lgpd_update(p_id uuid, p_status text, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.lgpd_requests
    set status = coalesce(p_status, status),
        notes = coalesce(p_notes, notes),
        completed_at = case when p_status = 'completed' then now() else completed_at end
    where id = p_id;
  perform public.log_admin_action('update', 'lgpd_request', p_id::text, jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_lgpd_update(uuid, text, text) from public, anon;
grant execute on function public.admin_lgpd_update(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK: select to_regclass('public.lgpd_requests');  -- nao-nulo
--   select count(*) from pg_proc where proname in ('lgpd_log_request','admin_lgpd_update'); -- 2
-- ============================================================================
