-- ============================================================================
-- Maestro Pet -- ANTI-CHEAT SERVER-SIDE dos Jogos (sessao + piso de duracao)
--
-- PROBLEMA: ate aqui o unico anti-cheat era o teto de magnitude em
-- game_scores_guard (5000/800/1500) + anti-spam 10s, e o insert era DIRETO
-- (policy "game_scores insert own"). Qualquer um abre o console do PWA e faz
--   supabase.from('game_scores').insert({ score: 1500, ... })
-- pondo um placar plausivel-mas-falso no topo do ranking. Teto de magnitude
-- nao pega isso (1500 e atingivel de verdade).
--
-- SOLUCAO: sessao carimbada no SERVIDOR.
--   game_begin(game, dificuldade) -> abre uma sessao com started_at = now() e
--     devolve o id. O client chama no inicio da partida.
--   game_submit(session, score, pet) -> valida dono + sessao nao usada + a
--     DURACAO MEDIDA NO SERVIDOR (now() - started_at, impossivel falsificar)
--     contra um piso por jogo + teto plausivel, e SO entao grava em game_scores.
-- O insert direto e REVOGADO: a unica porta de escrita passa a ser game_submit
-- (SECURITY DEFINER), entao o cliente nao consegue mais inserir score cru.
--
-- Piso de duracao SO onde nao penaliza jogador rapido legitimo:
--   treats  = rodada fixa de 30s -> piso 20s (nenhum run legitimo dura < 20s).
--   caminho = animacao ~0.3s/passo + 1.1s/fase -> piso 5s (ate quem decora a
--             solucao gasta mais que isso so na animacao).
--   quiz    = SEM piso -> pontuar alto EXIGE responder rapido; um piso
--             rejeitaria o jogador bom (foi exatamente o erro do v139, que
--             rejeitava run legitimo e engolia o erro).
--
-- NB: isto NAO e anti-cheat perfeito (jogo casual, client-side, sem premio em
-- dinheiro): um trapaceiro determinado ainda pode esperar o piso e mandar UM
-- placar plausivel. Mas o ranking pega o MAX por usuario, entao floodar nao
-- ajuda; e a barra sobe de "1 linha no console" pra "tem que simular o tempo".
--
-- Idempotente. ASCII-only (seguro pra colar via clipboard no editor SQL).
-- ORDEM DE APLICACAO: aplicar ESTE arquivo ANTES de subir o client novo (o
-- client novo chama game_begin/game_submit; bundles antigos faziam insert
-- direto e PARAM de salvar score quando a policy e revogada -- o PWA se
-- auto-atualiza via SW, ver lib/pwa-bootstrap.ts).
-- ============================================================================

-- ---- TABELA: sessoes de jogo -----------------------------------------------
create table if not exists public.game_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  game        text not null check (game in ('treats', 'quiz', 'caminho', 'runner')),
  difficulty  smallint not null check (difficulty in (1, 2, 3)),
  started_at  timestamptz not null default now(),
  used_at     timestamptz
);
create index if not exists game_sessions_user_idx
  on public.game_sessions(user_id, started_at desc);

alter table public.game_sessions enable row level security;
-- sem policies: ninguem le/escreve direto. So as RPCs SECURITY DEFINER mexem.
revoke all on public.game_sessions from anon, authenticated;

-- ---- RPC: abre a sessao (inicio da partida) --------------------------------
create or replace function public.game_begin(p_game text, p_difficulty smallint)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado' using errcode = '42501';
  end if;
  if p_game not in ('treats', 'quiz', 'caminho', 'runner') then
    raise exception 'jogo invalido' using errcode = '22023';
  end if;
  insert into public.game_sessions(user_id, game, difficulty)
  values (auth.uid(), p_game, coalesce(p_difficulty, 2))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.game_begin(text, smallint) from public, anon;
grant execute on function public.game_begin(text, smallint) to authenticated;

-- ---- RPC: valida + grava o placar (fim da partida) -------------------------
-- A dificuldade e o jogo vem da SESSAO (travados no begin), nao do client.
create or replace function public.game_submit(p_session uuid, p_score int, p_pet_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s        public.game_sessions;
  v_elapsed numeric;
  v_min     numeric;
  v_max     int;
begin
  if auth.uid() is null then
    raise exception 'nao autenticado' using errcode = '42501';
  end if;

  select * into s from public.game_sessions
    where id = p_session and user_id = auth.uid();
  if not found then
    raise exception 'sessao invalida' using errcode = '22023';
  end if;
  if s.used_at is not null then
    raise exception 'sessao ja usada' using errcode = '22023';
  end if;

  -- duracao MEDIDA NO SERVIDOR (o client nao controla)
  v_elapsed := extract(epoch from (now() - s.started_at));
  v_min := case s.game when 'treats' then 20 when 'caminho' then 5 else 0 end;
  if v_elapsed < v_min then
    raise exception 'partida curta demais' using errcode = '22023';
  end if;

  -- teto PLAUSIVEL por jogo (max real x margem: treats ~1900, quiz 216,
  -- caminho 750). Bem abaixo do teto bruto antigo (5000/800/1500), mas com
  -- folga generosa pra nunca barrar um run legitimo (licao do v139).
  v_max := case s.game when 'treats' then 3000 when 'quiz' then 400 when 'caminho' then 1200 when 'runner' then 8000 else 10000 end;
  if p_score < 0 or p_score > v_max then
    raise exception 'pontuacao invalida' using errcode = '22023';
  end if;

  -- consome a sessao ANTES de gravar (um placar por sessao)
  update public.game_sessions set used_at = now() where id = s.id;

  -- game_scores_guard (anti-spam 10s + teto bruto) ainda roda neste insert.
  insert into public.game_scores(user_id, pet_id, game, score, difficulty)
  values (auth.uid(), p_pet_id, s.game, p_score, s.difficulty);
end;
$$;
revoke all on function public.game_submit(uuid, int, uuid) from public, anon;
grant execute on function public.game_submit(uuid, int, uuid) to authenticated;

-- ---- PASSO FINAL: TRANCAR o insert direto (RODAR SO DEPOIS DO DEPLOY) -------
-- Tranca o insert direto -> a partir daqui SO game_submit (SECURITY DEFINER,
-- ignora RLS) escreve em game_scores. **NAO rodar antes de deployar o client
-- novo**: o bundle v141 em producao faz insert direto e PARA de salvar score
-- sem esta policy. Por isso o revoke fica COMENTADO — aplicar este arquivo cria
-- a infra (tabela + RPCs) SEM quebrar producao, e o revoke e um passo manual
-- separado, feito quando o client novo (game_begin/game_submit) ja estiver no ar
-- e o SW tiver propagado.
--   >>> DESCOMENTE E RODE APOS O DEPLOY: <<<
-- drop policy if exists "game_scores insert own" on public.game_scores;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (rodar numa aba NOVA do editor; nao recarregar a que rodou):
--   select to_regclass('public.game_sessions');                       -- nao-nulo
--   select count(*) from pg_proc where proname in ('game_begin','game_submit'); -- 2
--   select has_function_privilege('authenticated','public.game_begin(text,smallint)','execute'),
--          has_function_privilege('authenticated','public.game_submit(uuid,int,uuid)','execute'); -- t,t
--   select count(*) from pg_policies
--     where tablename='game_scores' and cmd='INSERT';   -- 1 ANTES do deploy (insert ainda liberado), 0 DEPOIS de rodar o revoke
--   select count(*) from pg_policies
--     where tablename='game_scores' and cmd='SELECT';                  -- 1 (read-all intacto)
-- ============================================================================
