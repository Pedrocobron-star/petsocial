-- ============================================================================
-- mozart-profile.sql — Perfil oficial do Mozart (conta-bot) + mensagens
-- programadas (editáveis pelo admin) + DM de boas-vindas automática.
-- Idempotente. Roda no SQL editor (projeto aefrcwysifgniogumxwk).
-- UUID fixo do Mozart: d0c0ffee-0000-4000-8000-00000000cafe
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. Conta-bot do Mozart em auth.users (UUID fixo, senha aleatória — ninguém loga).
--    O trigger handle_new_user cria o profile automaticamente.
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
)
values (
  'd0c0ffee-0000-4000-8000-00000000cafe',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mozart@maestropet.app',
  crypt(gen_random_uuid()::text, gen_salt('bf')), now(),
  now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Mozart 🐾"}'::jsonb,
  false
)
on conflict (id) do nothing;

-- 2. Completa o profile do Mozart (avatar + bio).
insert into public.profiles (id, display_name, avatar_url, bio)
values (
  'd0c0ffee-0000-4000-8000-00000000cafe',
  'Mozart 🐾',
  'https://maestropet.com/mozart/rosto.png',
  'Mascote oficial do Maestro Pet. Tô aqui pra te dar as boas-vindas e as novidades! 🐾'
)
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  bio = excluded.bio;

-- 3. Flag de boas-vindas já enviada.
alter table public.profiles add column if not exists mozart_welcomed boolean not null default false;

-- 4. Mensagens programadas do Mozart (o admin edita).
create table if not exists public.mozart_messages (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.mozart_messages enable row level security;

drop policy if exists "mozart_messages read" on public.mozart_messages;
create policy "mozart_messages read" on public.mozart_messages for select using (true);

drop policy if exists "mozart_messages admin write" on public.mozart_messages;
create policy "mozart_messages admin write" on public.mozart_messages
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed das boas-vindas (só se a tabela estiver vazia).
insert into public.mozart_messages (content, sort_order)
select v.content, v.sort_order from (values
  ('Oi! Eu sou o Mozart 🐾 o mascote do Maestro Pet. Que bom te ver por aqui! 💛', 0),
  ('Aqui você cuida da saúde do seu pet (vacinas, carteirinha, lembretes), compartilha fotos na comunidade e ainda joga uns joguinhos. Toda novidade boa, eu te aviso por aqui! 😉🐶', 1)
) as v(content, sort_order)
where not exists (select 1 from public.mozart_messages);

-- 5. RPC: envia a DM de boas-vindas do Mozart pro usuário logado (idempotente).
create or replace function public.mozart_send_welcome()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_mozart uuid := 'd0c0ffee-0000-4000-8000-00000000cafe';
  v_conv uuid;
  v_already boolean;
  r record;
begin
  if v_user is null or v_user = v_mozart then return; end if;

  select mozart_welcomed into v_already from public.profiles where id = v_user;
  if v_already is null or v_already = true then return; end if;
  if not exists (select 1 from public.profiles where id = v_mozart) then return; end if;

  -- Reaproveita a conversa Mozart↔usuário se já existir.
  select c.id into v_conv
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = v_user
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = v_mozart
  limit 1;

  if v_conv is null then
    insert into public.conversations (last_message_at) values (now()) returning id into v_conv;
    insert into public.conversation_participants (conversation_id, user_id, last_read_at)
      values (v_conv, v_user, '1970-01-01T00:00:00Z'), (v_conv, v_mozart, now());
  end if;

  for r in select content from public.mozart_messages where active order by sort_order, created_at loop
    insert into public.messages (conversation_id, sender_id, content) values (v_conv, v_mozart, r.content);
  end loop;

  update public.profiles set mozart_welcomed = true where id = v_user;
end;
$$;
revoke all on function public.mozart_send_welcome() from public;
grant execute on function public.mozart_send_welcome() to authenticated;

-- 6. Admin: lista/edita as mensagens programadas do Mozart.
create or replace function public.admin_list_mozart_messages()
returns setof public.mozart_messages language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select * from public.mozart_messages order by sort_order, created_at;
end;
$$;
revoke all on function public.admin_list_mozart_messages() from public;
grant execute on function public.admin_list_mozart_messages() to authenticated;

-- ----------------------------------------------------------------------------
-- Verificação
-- ----------------------------------------------------------------------------
select
  (select count(*) from auth.users where id = 'd0c0ffee-0000-4000-8000-00000000cafe') as mozart_user,
  (select display_name from public.profiles where id = 'd0c0ffee-0000-4000-8000-00000000cafe') as mozart_name,
  (select count(*) from public.mozart_messages) as msg_count,
  (select count(*) from pg_proc where proname = 'mozart_send_welcome') as has_send_fn,
  exists (select 1 from information_schema.columns
          where table_name = 'profiles' and column_name = 'mozart_welcomed') as has_flag;
