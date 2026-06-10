-- ============================================================================
-- daily-missions.sql — Missão do Dia (foto do dia) + pontuação por hashtag +
-- notificações diárias 8h (foto) e 17h (jogo) + seed dos posts do Mozart.
-- Idempotente. Roda no Supabase SQL editor (projeto aefrcwysifgniogumxwk).
-- Depende de: is_admin(), hashtags, post_hashtags, posts, pets, notifications,
--             app_secrets.push_secret, pg_net, pg_cron, send-web-push, mozart_posts.
-- Fuso das notificações: BRT (America/Sao_Paulo, UTC-3) -> 8h=11 UTC, 17h=20 UTC.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABELA daily_missions — 1 objetivo por dia do mês (1..31), editável no admin
-- ----------------------------------------------------------------------------
create table if not exists public.daily_missions (
  id uuid primary key default gen_random_uuid(),
  day_of_month int not null unique check (day_of_month between 1 and 31),
  title text not null,
  prompt text not null,
  hashtag text not null,         -- guardado com casing pra exibir (#CantinhoFavorito); o match é case-insensitive
  points int not null default 15 check (points between 1 and 100),
  emoji text not null default '📸',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.daily_missions enable row level security;

drop policy if exists "daily_missions read all" on public.daily_missions;
create policy "daily_missions read all" on public.daily_missions
  for select using (true);

drop policy if exists "daily_missions admin write" on public.daily_missions;
create policy "daily_missions admin write" on public.daily_missions
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. TABELA daily_mission_completions — prova do dia (1 por usuário por dia)
-- ----------------------------------------------------------------------------
create table if not exists public.daily_mission_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  completion_date date not null,
  day_of_month int not null,
  hashtag text not null,
  post_id uuid references public.posts(id) on delete set null,
  points int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, completion_date)
);
create index if not exists dmc_user_idx on public.daily_mission_completions(user_id, completion_date desc);

alter table public.daily_mission_completions enable row level security;

drop policy if exists "dmc read own" on public.daily_mission_completions;
create policy "dmc read own" on public.daily_mission_completions
  for select using (auth.uid() = user_id);

drop policy if exists "dmc admin read" on public.daily_mission_completions;
create policy "dmc admin read" on public.daily_mission_completions
  for select using (public.is_admin());
-- Sem policy de insert: só o trigger (security definer) grava.

-- ----------------------------------------------------------------------------
-- 3. TRIGGER — ao linkar hashtag a um post, se bater com a hashtag do dia, pontua
-- ----------------------------------------------------------------------------
create or replace function public.daily_mission_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tag text;
  v_owner uuid;
  v_today date;
  v_day int;
  v_mission public.daily_missions%rowtype;
begin
  select lower(h.name) into v_tag from public.hashtags h where h.id = new.hashtag_id;
  if v_tag is null then return new; end if;

  select pe.owner_id into v_owner
  from public.posts po
  join public.pets pe on pe.id = po.pet_id
  where po.id = new.post_id;
  if v_owner is null then return new; end if;

  v_today := (now() at time zone 'America/Sao_Paulo')::date;
  v_day := extract(day from v_today)::int;

  select * into v_mission from public.daily_missions
   where day_of_month = v_day and active = true limit 1;
  if v_mission.id is null then return new; end if;

  if lower(v_mission.hashtag) = v_tag then
    insert into public.daily_mission_completions
      (user_id, completion_date, day_of_month, hashtag, post_id, points)
    values (v_owner, v_today, v_day, v_mission.hashtag, new.post_id, v_mission.points)
    on conflict (user_id, completion_date) do nothing;

    if found then
      insert into public.notifications (user_id, kind, title, body, url, created_at)
      values (v_owner, 'broadcast',
        '🏆 Missão do dia cumprida!',
        'Você ganhou ' || v_mission.points || ' pontos com #' || v_mission.hashtag || '. Volta amanhã pra próxima foto do dia!',
        '/achievements', now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists daily_mission_check_trg on public.post_hashtags;
create trigger daily_mission_check_trg
  after insert on public.post_hashtags
  for each row execute function public.daily_mission_check();

-- ----------------------------------------------------------------------------
-- 4. RPC get_today_mission — missão de hoje + meu status (feito hoje, total, streak)
-- ----------------------------------------------------------------------------
create or replace function public.get_today_mission()
returns table (
  day_of_month int, title text, prompt text, hashtag text, points int, emoji text,
  done_today boolean, total_completions int, total_points int, streak int
)
language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_day int := extract(day from v_today)::int;
  v_uid uuid := auth.uid();
  v_streak int := 0;
  v_cursor date := v_today;
begin
  if v_uid is not null then
    -- se ainda não fez hoje, conta a partir de ontem (não zera antes da meia-noite)
    if not exists (select 1 from public.daily_mission_completions
                   where user_id = v_uid and completion_date = v_today) then
      v_cursor := v_today - 1;
    end if;
    loop
      exit when not exists (select 1 from public.daily_mission_completions
                            where user_id = v_uid and completion_date = v_cursor);
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
    end loop;
  end if;

  return query
  select m.day_of_month, m.title, m.prompt, m.hashtag, m.points, m.emoji,
    (v_uid is not null and exists (select 1 from public.daily_mission_completions c
       where c.user_id = v_uid and c.completion_date = v_today)) as done_today,
    coalesce((select count(*)::int from public.daily_mission_completions c where c.user_id = v_uid), 0) as total_completions,
    coalesce((select sum(c.points)::int from public.daily_mission_completions c where c.user_id = v_uid), 0) as total_points,
    v_streak as streak
  from public.daily_missions m
  where m.day_of_month = v_day and m.active = true
  limit 1;
end;
$$;
revoke all on function public.get_today_mission() from public;
grant execute on function public.get_today_mission() to authenticated;

-- ----------------------------------------------------------------------------
-- 5. NOTIFICAÇÕES DIÁRIAS — 8h foto do dia, 17h desafio de jogo
-- ----------------------------------------------------------------------------
create or replace function public.notify_daily_photo_mission()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uids uuid[]; v_secret text; v_mission public.daily_missions%rowtype;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_day int := extract(day from (now() at time zone 'America/Sao_Paulo'))::int;
  v_title text; v_body text;
begin
  select * into v_mission from public.daily_missions where day_of_month = v_day and active = true limit 1;
  if v_mission.id is null then return; end if;

  v_title := '📸 Foto do dia: ' || v_mission.title;
  v_body := v_mission.prompt || ' Poste com #' || v_mission.hashtag || ' e ganhe ' || v_mission.points || ' pontos!';

  select array_agg(id) into v_uids from auth.users;
  if v_uids is null then return; end if;

  insert into public.notifications (user_id, kind, title, body, url, created_at)
  select uid, 'broadcast', v_title, v_body, '/', now() from unnest(v_uids) as uid;

  select value into v_secret from public.app_secrets where key = 'push_secret';
  if v_secret is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-petsocial-secret', v_secret),
      body := jsonb_build_object('user_ids', to_jsonb(v_uids), 'title', v_title, 'body', v_body, 'url', '/', 'tag', 'daily-photo')
    );
  end if;
end;
$$;

create or replace function public.notify_daily_game_challenge()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uids uuid[]; v_secret text;
  v_url text := 'https://aefrcwysifgniogumxwk.supabase.co/functions/v1/send-web-push';
  v_title text := '🎮 Desafio de jogo do dia!';
  v_body text := 'O desafio diário dos joguinhos já está rolando. Bora pontuar e subir no ranking da matilha?';
begin
  select array_agg(id) into v_uids from auth.users;
  if v_uids is null then return; end if;

  insert into public.notifications (user_id, kind, title, body, url, created_at)
  select uid, 'broadcast', v_title, v_body, '/games', now() from unnest(v_uids) as uid;

  select value into v_secret from public.app_secrets where key = 'push_secret';
  if v_secret is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-petsocial-secret', v_secret),
      body := jsonb_build_object('user_ids', to_jsonb(v_uids), 'title', v_title, 'body', v_body, 'url', '/games', 'tag', 'daily-game')
    );
  end if;
end;
$$;

-- Admin: dispara as notificações na hora (pra testar sem esperar o cron)
create or replace function public.admin_run_daily_notifications(p_which text default 'both')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_which in ('both', 'photo') then perform public.notify_daily_photo_mission(); end if;
  if p_which in ('both', 'game') then perform public.notify_daily_game_challenge(); end if;
end;
$$;
revoke all on function public.admin_run_daily_notifications(text) from public;
grant execute on function public.admin_run_daily_notifications(text) to authenticated;

select cron.unschedule('petsocial-daily-photo') where exists (select 1 from cron.job where jobname = 'petsocial-daily-photo');
select cron.schedule('petsocial-daily-photo', '0 11 * * *', $$ select public.notify_daily_photo_mission(); $$);

select cron.unschedule('petsocial-daily-game') where exists (select 1 from cron.job where jobname = 'petsocial-daily-game');
select cron.schedule('petsocial-daily-game', '0 20 * * *', $$ select public.notify_daily_game_challenge(); $$);

-- ----------------------------------------------------------------------------
-- 6. SEED das 31 missões (voz fofa, zero travessão). Upsert por dia.
-- ----------------------------------------------------------------------------
insert into public.daily_missions (day_of_month, title, prompt, hashtag, points, emoji) values
  (1,  'O trono dele',        'Mostre o cantinho favorito do seu pet, aquele lugar que ele escolheu como dele e ninguem mais pode ocupar. 🐾', 'CantinhoFavorito', 15, '🛋️'),
  (2,  'Olhar de pidao',      'Fotografe aquela carinha de pidao que seu pet faz na hora da comida. Aquele olhar que ninguem resiste, voce sabe qual e. 🐶', 'CaraDePidao', 15, '🥺'),
  (3,  'Dorminhoco do dia',   'Registre seu pet no soninho mais gostoso, todo derretido. Quanto mais posicao engracada de dormir, melhor. 💛', 'Dorminhoco', 15, '😴'),
  (4,  'Modo brincadeira',    'Capture seu pet no auge da brincadeira, cheio de energia e felicidade. Pode ser correndo atras da bolinha ou pulando por ai. ✨', 'HoraDeBrincar', 15, '🎾'),
  (5,  'Aventura no passeio', 'Mostre seu pet curtindo o passeio: cheirando tudo, explorando a rua ou parado admirando a vista. ☀️', 'PasseioDoDia', 15, '🌳'),
  (6,  'Sabadou da preguica', 'Fim de semana chegou. Fotografe seu pet naquela preguica deliciosa de sabado, esticadao sem vontade de levantar. 🐾', 'PreguicaDeSabado', 20, '🛌'),
  (7,  'Petisco a vista',     'Registre a reacao do seu pet quando ele ve o petisco chegando. Aquela ansiedade fofa toda no rostinho. 🦴', 'HoraDoPetisco', 20, '🦴'),
  (8,  'Linguinha de fora',   'Pegue o momento perfeito da linguinha pra fora do seu pet. Quanto mais comprida e boba, mais ponto. 🐶', 'LinguinhaDeFora', 15, '👅'),
  (9,  'Orelhas em destaque', 'Faca um close nas orelhas do seu pet, sejam elas em pe, caidas ou no vento. As orelhinhas merecem o protagonismo hoje. 🐾', 'OrelhasFofas', 15, '👂'),
  (10, 'Patinhas perfeitas',  'Tire uma foto das patinhas do seu pet, aqueles dedinhos e coxins fofos. Bonus se forem aquelas patas gigantes de filhote. 💛', 'PatinhasFofas', 15, '🐾'),
  (11, 'Brinquedo numero um', 'Mostre o brinquedo preferido do seu pet, aquele velho de guerra que ele ama mais que tudo. Conte a historia dele na legenda. ✨', 'BrinquedoPreferido', 15, '🧸'),
  (12, 'Throwback de filhote','Garimpe aquela foto de quando seu pet era filhote e poste hoje. Vale comparar com como ele esta agora. 🐶💛', 'ThrowbackFilhote', 20, '🍼'),
  (13, 'Eu e meu pet',        'Capture um momento de carinho entre voce e seu pet, juntinhos na mesma foto. Selfie de dupla conta tambem. 🐾', 'EuEMeuPet', 20, '🤳'),
  (14, 'Bocejo da preguica',  'Pegue seu pet no meio daquele bocejo enorme e preguicoso. Timing dificil, mas a foto fica impagavel. ☀️', 'BocejoPreguicoso', 15, '🥱'),
  (15, 'Vigia da janela',     'Fotografe seu pet olhando pela janela, observando o movimento la fora todo concentrado. O guardiao do lar em acao. 🐶', 'OlhandoPelaJanela', 15, '🪟'),
  (16, 'Recem saido do banho','Registre seu pet depois do banho: cheirosinho, molhado ou enroladinho na toalha. Aquela cara de poucos amigos pos banho vale ouro. ✨', 'DepoisDoBanho', 15, '🛁'),
  (17, 'Zoomies ativados',    'Capture seu pet no modo bagunca total, correndo feito um foguete pela casa. Foto tremida e bem vinda, faz parte. 🐾', 'ModoZoomies', 15, '💨'),
  (18, 'Cara de culpado',     'Flagrou alguma travessura? Fotografe a cara de culpado do seu pet ao lado da arte que ele aprontou. 🐶', 'CaraDeCulpado', 15, '😇'),
  (19, 'Soneca no solzinho',  'Mostre seu pet cochilando naquele quadradinho de sol, todo aquecido e em paz. O lugar mais disputado da casa. ☀️💛', 'SonecaNoSol', 15, '☀️'),
  (20, 'Sorrisao do dia',     'Pegue aquele bocao aberto que parece um sorriso enorme do seu pet. Felicidade pura em forma de foto. 🐶✨', 'SorrisaoDePet', 20, '😁'),
  (21, 'Melhor amigo peludo', 'Tem outro pet em casa ou um amiguinho do parque? Fotografe a dupla junta, naquela amizade que derrete o coracao. 🐾💛', 'MelhorAmigoPeludo', 20, '🐶'),
  (22, 'Festa do soninho',    'Mostre seu pet completamente apagado em uma posicao impossivel de dormir. Quanto mais esparramado, mais ponto. 💤', 'EsparramadoNoSono', 15, '💤'),
  (23, 'Pose de modelo',      'Convide seu pet pra um ensaio rapido e capture aquela pose digna de capa de revista. Olhar pro horizonte conta pontos. ✨', 'PoseDeModelo', 15, '📸'),
  (24, 'Focinho fofo',        'Faca um super close no focinho do seu pet, aquele narizinho molhado e perfeito. Detalhe que a gente ama beijar. 🐶💛', 'FocinhoFofo', 15, '👃'),
  (25, 'Cobertor e aconchego','Registre seu pet todo enroladinho no cobertor ou na coberta favorita. Aquele casulo de fofura no friozinho. 🐾', 'EnroladinhoNoCobertor', 15, '🛏️'),
  (26, 'Cabeca de lado',      'Capture aquele momento em que seu pet vira a cabecinha de lado, curioso e confuso. O gesto mais fofo que existe. 🐶', 'CabecinhaDeLado', 15, '🤔'),
  (27, 'Hora da janta',       'Mostre seu pet de olho na vasilha na hora da refeicao, aquela concentracao total no prato. Bom apetite, peludo. 🦴', 'HoraDaJanta', 15, '🍽️'),
  (28, 'Domingou relax',      'Domingo e dia de relaxar. Fotografe seu pet no descanso supremo, sem compromisso nenhum com a vida. ☀️💛', 'DomingoDeRelax', 20, '😌'),
  (29, 'Caca ao brinquedo',   'Registre seu pet na missao de cacar ou esconder o brinquedo, todo focado na presa imaginaria. Espirito cacador ativado. 🐾', 'ModoCacador', 15, '🔦'),
  (30, 'Barriguinha pra cima','Pegue seu pet deitado de barriga pra cima pedindo carinho, todo entregue e confiante. Cocega na pancinha obrigatoria. 🐶💛', 'BarriguinhaParaCima', 15, '🙃'),
  (31, 'Foto da retrospectiva','Ultimo dia do mes. Escolha a foto mais especial do seu pet desse mes inteiro e compartilhe contando por que ela e a favorita. 💛✨', 'RetrospectivaDoMes', 25, '💛')
on conflict (day_of_month) do update set
  title = excluded.title, prompt = excluded.prompt, hashtag = excluded.hashtag,
  points = excluded.points, emoji = excluded.emoji, active = true, updated_at = now();

-- ----------------------------------------------------------------------------
-- 7. CORRIGE o post inaugural do Mozart (tirar travessão da legenda ao vivo)
-- ----------------------------------------------------------------------------
update public.posts
set caption = 'Oi, eu sou o Mozart! 🐾 Que alegria te ver por aqui no Maestro Pet. Aqui a gente cuida da saude do seu bichinho e celebra cada momento com ele. Me conta: qual o nome do seu pet? 💛'
where pet_id = 'd0c0ffee-0000-4000-8000-00000000beef'
  and caption like 'Oi, eu sou o Mozart%Bem-vindo ao Maestro Pet%';

-- ----------------------------------------------------------------------------
-- 8. SEED dos posts do Mozart como RASCUNHO (Pedro sobe as fotos depois)
--    Só insere se ainda não houver rascunhos com a mesma legenda (idempotente).
-- ----------------------------------------------------------------------------
insert into public.mozart_posts (caption, status)
select v.caption, 'draft'
from (values
  ('Oi oi, focinho novo no pedaço! 🐾 Eu sou o Mozart e fico todo bobo de rabo quando alguém chega aqui. Senta, fica à vontade e me conta: quem é o pet mais lindo da sua casa?'),
  ('Chegou agora? Que delícia! 💛 Aqui a gente é uma matilha grande de gente boa e bicho fofo. Pode soltar o pelo, abanar o rabo e ficar quanto tempo quiser. A casa é sua.'),
  ('Já viu a missão de hoje? A foto do dia tá esperando o seu pet brilhar! ☀️ Tira aquele clique fofura e posta. Eu prometo abanar o rabo pra cada carinha que aparecer no feed.'),
  ('Hoje é dia de foto do dia e meu coração de cachorro tá batendo forte! ✨ Mostra esse focinho aí, vai. Pode ser foto dormindo, brincando ou fazendo bagunça, eu amo todas.'),
  ('Psiu, já anotou a vacininha do seu pet por aqui? 🐶 Eu adoro deixar minha carteirinha digital organizada, fica tudo bonito e em ordem. Cuidar com carinho também é jeito de amar.'),
  ('A carteirinha digital é tipo meu álbum de saúde favorito! 💛 Dá pra guardar vacina, vermífugo e tudinho num cantinho só. Bora deixar a do seu pet completinha?'),
  ('Subi na balança hoje e fiquei todo prosa! 🦴 Anotar o peso de vez em quando ajuda a gente a perceber como o pet tá indo. Que tal registrar o do seu também?'),
  ('Cansou de rolar o feed? Bora brincar! ✨ Os joguinhos aqui são pura diversão de matilha. Eu já tô com a patinha coçando pra começar. Vem comigo?'),
  ('Quem disse que cachorro não joga? 🐾 Eu corro atrás da bolinha e da pontuação também! Chama os amigos, entra nos joguinhos e mostra que a sua matilha é craque.'),
  ('Olha quanta gente boa e quanto focinho fofo por aqui! 💛 Cada pet que chega deixa a nossa matilha mais cheia de amor. Tô orgulhoso demais de fazer parte disso com vocês.'),
  ('Sabe o que mais aquece meu coração peludo? Ver vocês trocando carinho nos comentários. ✨ A gente aqui é família de focinho. Obrigado por fazer desse cantinho um lugar tão gostoso.'),
  ('Dica do Mozart: água fresquinha sempre por perto faz a diferença no dia! 🐾 Eu adoro dar uma paradinha pra beber entre uma corrida e outra. Capricha no potinho do seu pet, viu?'),
  ('Tá calor? Passeio cedinho ou no fim da tarde é mais gostoso pras nossas patinhas! ☀️ Asfalto quente queima focinho de cachorro. Sombra e carinho nunca são demais.'),
  ('Escovar o pelo é meu momento de mimo favorito! 💛 Além de deixar a gente cheiroso e bonito, é puro carinho disfarçado de cuidado. Reserva um tempinho pra isso com o seu pet.'),
  ('Tá esperando o quê pra me apresentar seu focinho? 🐶 Quero ver essa carinha linda! Posta aí embaixo que eu passo abanando o rabo em cada um.'),
  ('Conta pra mim: como é o seu pet quando fica feliz? 🐾 O meu rabo vira hélice de helicóptero! Mostra um clique dessa felicidade aí pra alegrar a matilha toda.'),
  ('Lembrete fofo do dia: o vermífugo do seu pet tá em dia? 💛 Eu deixo o meu anotadinho na carteirinha pra não esquecer nada. Cuidar por dentro também é amor.'),
  ('Quero ver o feed lotado de fofura hoje! ✨ Posta a foto do dia, curte os amigos e deixa um comentário gostoso. A matilha fica mais feliz quando todo mundo participa.'),
  ('Pra quem chegou hoje e pra quem já é de casa: que bom ter vocês aqui! 🐾 Aqui ninguém fica de canto, todo focinho tem vez. Bora abanar o rabo juntos?'),
  ('Sabia que anotar as consultas ajuda a gente a lembrar de tudo na próxima visita? 💛 Eu guardo as minhas na carteirinha digital e fica fácil consultar. Organização que cabe na patinha!')
) as v(caption)
where not exists (select 1 from public.mozart_posts mp where mp.caption = v.caption);

-- ----------------------------------------------------------------------------
-- Verificação
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.daily_missions) as missions_count,
  (to_regclass('public.daily_mission_completions') is not null) as has_completions,
  (select count(*) from pg_proc where proname in
     ('daily_mission_check','get_today_mission','notify_daily_photo_mission','notify_daily_game_challenge')) as fn_count,
  (select count(*) from public.mozart_posts where status = 'draft') as mozart_drafts,
  (select json_agg(json_build_object('name', jobname, 'sched', schedule))
     from cron.job where jobname in ('petsocial-daily-photo','petsocial-daily-game')) as new_jobs;
