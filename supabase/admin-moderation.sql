-- ============================================================================
-- MODERAÇÃO ADMIN — fila de denúncias + remoção de conteúdo + banir usuário
--
-- A tabela public.reports (schema.sql:879) JÁ coleta denúncias em produção, mas
-- a RLS é só own-select: o admin nem conseguia LER. Este arquivo dá ao admin
-- (is_admin) o poder de: listar denúncias, resolver (status), remover post/
-- comentário abusivo de TERCEIRO (hard-delete via SECURITY DEFINER, fura a RLS
-- de dono), e banir/desbanir usuário. Toda ação destrutiva loga em admin_audit.
--
-- Idempotente. Aplicar DEPOIS de schema.sql, admin-sponsored-and-analytics.sql
-- (is_admin) e admin-audit.sql (log_admin_action).
-- ============================================================================

-- ---------- coluna de ban no profile ----------
alter table public.profiles add column if not exists banned_at timestamptz;
alter table public.profiles add column if not exists banned_reason text;

-- ---------- enforcement: usuário banido não posta ----------
create or replace function public.enforce_not_banned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.pets pe
    join public.profiles pr on pr.id = pe.owner_id
    where pe.id = new.pet_id and pr.banned_at is not null
  ) then
    raise exception 'Conta suspensa: não é possível publicar.' using errcode = 'P0001';
  end if;
  return new;
exception when others then
  -- só relança o nosso erro de ban; qualquer outro problema não bloqueia o post
  if sqlerrm like 'Conta suspensa%' then raise; end if;
  return new;
end;
$$;
drop trigger if exists posts_block_banned on public.posts;
create trigger posts_block_banned before insert on public.posts
  for each row execute function public.enforce_not_banned();

-- ---------- listar a fila de denúncias ----------
create or replace function public.admin_list_reports(p_status text default null, p_limit int default 100)
returns table (
  id uuid, target_kind text, target_id uuid, reason text, notes text, status text,
  created_at timestamptz, reporter_email text, reporter_name text, target_reports_count int
)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select r.id, r.target_kind, r.target_id, r.reason, r.notes, r.status, r.created_at,
         u.email::text, pr.display_name,
         (select count(*)::int from public.reports r2
            where r2.target_kind = r.target_kind and r2.target_id = r.target_id) as target_reports_count
  from public.reports r
  left join auth.users u on u.id = r.reporter_user_id
  left join public.profiles pr on pr.id = r.reporter_user_id
  where (p_status is null or r.status = p_status)
  order by (r.status = 'open') desc, r.created_at desc
  limit p_limit;
end;
$$;
revoke all on function public.admin_list_reports(text, int) from public, anon;
grant execute on function public.admin_list_reports(text, int) to authenticated;

-- ---------- resolver denúncia (mudar status) ----------
create or replace function public.admin_resolve_report(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status not in ('open','reviewed','dismissed','actioned') then
    raise exception 'status inválido' using errcode = '22023';
  end if;
  update public.reports set status = p_status where id = p_id;
  perform public.log_admin_action('resolve', 'report', p_id, jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_resolve_report(uuid, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;

-- ---------- remover post abusivo (hard-delete, fura RLS de dono) ----------
create or replace function public.admin_delete_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.posts where id = p_post_id;  -- post_media/likes/comments caem por cascade
  -- marca denúncias desse post como tratadas
  update public.reports set status = 'actioned'
    where target_kind = 'post' and target_id = p_post_id and status in ('open','reviewed');
  perform public.log_admin_action('delete', 'post', p_post_id);
end;
$$;
revoke all on function public.admin_delete_post(uuid) from public, anon;
grant execute on function public.admin_delete_post(uuid) to authenticated;

-- ---------- remover comentário abusivo ----------
create or replace function public.admin_delete_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.comments where id = p_comment_id;
  update public.reports set status = 'actioned'
    where target_kind = 'comment' and target_id = p_comment_id and status in ('open','reviewed');
  perform public.log_admin_action('delete', 'comment', p_comment_id);
end;
$$;
revoke all on function public.admin_delete_comment(uuid) from public, anon;
grant execute on function public.admin_delete_comment(uuid) to authenticated;

-- ---------- banir / desbanir usuário ----------
create or replace function public.admin_ban_user(p_user_id uuid, p_ban boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ban then
    update public.profiles set banned_at = now(), banned_reason = p_reason where id = p_user_id;
    perform public.log_admin_action('ban', 'user', p_user_id, jsonb_build_object('reason', p_reason));
  else
    update public.profiles set banned_at = null, banned_reason = null where id = p_user_id;
    perform public.log_admin_action('unban', 'user', p_user_id);
  end if;
end;
$$;
revoke all on function public.admin_ban_user(uuid, boolean, text) from public, anon;
grant execute on function public.admin_ban_user(uuid, boolean, text) to authenticated;
