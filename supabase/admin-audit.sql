-- ============================================================================
-- Admin audit log — trilha de acoes destrutivas do admin (deletes etc.)
-- Deletes em news/offers/places sao hard-delete e irreversiveis; isto registra
-- QUEM apagou O QUE e QUANDO, pra forense / rede de seguranca contra erro humano.
-- ============================================================================

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  admin_email text,
  action text not null,        -- 'delete' | 'update' | 'create' ...
  entity text not null,        -- 'news_article' | 'offer' | 'place' ...
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_created_idx on public.admin_audit(created_at desc);

alter table public.admin_audit enable row level security;
drop policy if exists admin_audit_read on public.admin_audit;
create policy admin_audit_read on public.admin_audit
  for select to authenticated using (public.is_admin());

-- Registro via RPC (SECURITY DEFINER, so admin grava). Inserts diretos do client
-- ficam bloqueados (sem policy de insert) — tudo passa por aqui.
create or replace function public.log_admin_action(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.admin_audit(admin_id, admin_email, action, entity, entity_id, meta)
  values (auth.uid(), auth.jwt() ->> 'email', p_action, p_entity, p_entity_id, p_meta);
end;
$$;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
