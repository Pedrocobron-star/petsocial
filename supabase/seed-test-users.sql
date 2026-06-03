-- ============================================================================
-- Seed de teste — cria 2 tutores fakes com pets pra testar o DM e o feed.
-- IDEMPOTENTE: pode rodar várias vezes que não duplica nada.
--
-- Credenciais criadas:
--   maria@test.com  / Test123!
--   joao@test.com   / Test123!
--
-- Pets criados:
--   Luna   (gata Siamesa)   — dona: Maria
--   Thor   (Golden)         — dono: João
-- ============================================================================

do $$
declare
  user_maria_id uuid;
  user_joao_id uuid;
begin
  -- ----- Maria -----
  select id into user_maria_id from auth.users where email = 'maria@test.com';
  if user_maria_id is null then
    user_maria_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      user_maria_id,
      'authenticated',
      'authenticated',
      'maria@test.com',
      crypt('Test123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"Maria Silva"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      user_maria_id,
      format('{"sub":"%s","email":"%s"}', user_maria_id::text, 'maria@test.com')::jsonb,
      'email',
      user_maria_id::text,
      now(), now(), now()
    );
  end if;

  -- ----- João -----
  select id into user_joao_id from auth.users where email = 'joao@test.com';
  if user_joao_id is null then
    user_joao_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      user_joao_id,
      'authenticated',
      'authenticated',
      'joao@test.com',
      crypt('Test123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"display_name":"João Costa"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      user_joao_id,
      format('{"sub":"%s","email":"%s"}', user_joao_id::text, 'joao@test.com')::jsonb,
      'email',
      user_joao_id::text,
      now(), now(), now()
    );
  end if;

  -- ----- Garante que profiles existam (o trigger geralmente já criou) -----
  insert into public.profiles (id, display_name, bio)
  values
    (user_maria_id, 'Maria Silva', 'Mãe da Luna 🐱 amante de café e gatos ☕'),
    (user_joao_id, 'João Costa', 'Pai do Thor 🐶 corredor de fim de semana 🏃')
  on conflict (id) do update set
    display_name = excluded.display_name,
    bio = excluded.bio;

  -- ----- Pets -----
  if not exists (select 1 from public.pets where owner_id = user_maria_id and name = 'Luna') then
    insert into public.pets (owner_id, name, species, breed, bio, social_temperament)
    values (
      user_maria_id,
      'Luna',
      'cat',
      'Siamesa',
      'Adoro caixas, janelas ensolaradas e atacar os pés do meu humano às 4 da manhã 🌞',
      'shy'
    );
  end if;

  if not exists (select 1 from public.pets where owner_id = user_joao_id and name = 'Thor') then
    insert into public.pets (owner_id, name, species, breed, bio, social_temperament)
    values (
      user_joao_id,
      'Thor',
      'dog',
      'Golden Retriever',
      'Sempre pronto pra uma caminhada! Sou amigo de todos os pets do parque 🦴',
      'sociable'
    );
  end if;

  raise notice 'Seed criada/atualizada — maria@test.com e joao@test.com prontos. Senha: Test123!';
end $$;
