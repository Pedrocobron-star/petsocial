-- ============================================================================
-- P1 — Moderação + Engajamento (lançamento)
--   #18: dedup de denúncias (1 por reporter+alvo) → evita flood da fila.
--   #11: todo pet novo segue o Mozart → feed do mascote aparece de cara.
-- Idempotente. APLICADO 2026-06-18.
-- ============================================================================

-- #18: limpa duplicatas existentes (mantém a 1ª) e impede novas.
delete from public.reports r using public.reports r2
  where r.reporter_user_id = r2.reporter_user_id
    and r.target_kind = r2.target_kind
    and r.target_id = r2.target_id
    and (r.created_at, r.id) > (r2.created_at, r2.id);
create unique index if not exists reports_dedup_idx
  on public.reports(reporter_user_id, target_kind, target_id);
-- O client (createReport) faz upsert ignoreDuplicates → 2ª denúncia não dá erro.

-- #11: auto-follow do Mozart no cadastro de qualquer pet (menos o próprio Mozart).
create or replace function public.pets_autofollow_mozart()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> 'd0c0ffee-0000-4000-8000-00000000beef' then
    insert into public.follows (follower_pet_id, followed_pet_id)
    values (new.id, 'd0c0ffee-0000-4000-8000-00000000beef')
    on conflict do nothing;
  end if;
  return new;
exception when others then
  return new; -- nunca bloqueia o cadastro do pet
end;
$$;
drop trigger if exists pets_autofollow_mozart_ins on public.pets;
create trigger pets_autofollow_mozart_ins after insert on public.pets
  for each row execute function public.pets_autofollow_mozart();
