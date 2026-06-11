-- =============================================================================
-- ⚠️ DEPRECADO — era um bundle de QA "aplicar tudo que faltou". QUASE tudo aqui
-- foi SUPERADO pelas migrations dedicadas; manter as definicoes duplicadas era
-- footgun (CREATE OR REPLACE FUNCTION reverte a canonica ao reaplicar). Fontes
-- da verdade:
--   - posts.updated_at/reposted_from + touch_post_updated_at + trigger:  supabase/post-edited-tracking.sql
--   - comment_likes/post_pet_tags/post_edit_history + touch_comment_updated_at +
--     archive_post_edit + RLS owner de posts/comments:                   supabase/social-features.sql
--   - delete_my_account + export_my_data (LGPD):                         supabase/delete-account-rpc.sql
--   - notifications_kind_check (SUPERSET, ja inclui 'broadcast'):        supabase/retention-v1.sql
--     (a versao que existia aqui era mais ESTREITA — barraria 'broadcast' — outro footgun.)
--
-- O UNICO conteudo que so existe aqui (e por isso ficou) e a RPC notify_pet_tag
-- (chamada por lib/queries.ts) + as colunas profiles.push_token.
-- =============================================================================

-- profiles: colunas de push token (idempotente)
alter table public.profiles add column if not exists push_token text;
alter table public.profiles add column if not exists push_token_updated_at timestamptz;
create index if not exists profiles_push_token_idx on public.profiles(push_token) where push_token is not null;

-- RPC UNICA: notifica o dono de um pet marcado num post (kind 'pet_tagged').
-- Depende de notifications_kind_check aceitar 'pet_tagged' (ver retention-v1.sql).
create or replace function public.notify_pet_tag(
  tagged_pet uuid, actor_pet uuid, post_id_param uuid default null
)
returns void language plpgsql security definer set search_path = public as $$
declare actor_owner uuid; tagged_owner uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select owner_id into actor_owner from pets where id = actor_pet;
  if actor_owner is null or actor_owner <> auth.uid() then raise exception 'pet not owned by current user'; end if;
  select owner_id into tagged_owner from pets where id = tagged_pet;
  if tagged_owner is null or tagged_owner = auth.uid() then return; end if;
  insert into notifications (user_id, kind, actor_pet_id, post_id, target_pet_id)
  values (tagged_owner, 'pet_tagged', actor_pet, post_id_param, tagged_pet);
end;
$$;
grant execute on function public.notify_pet_tag(uuid, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
