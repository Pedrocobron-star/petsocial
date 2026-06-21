-- ============================================================================
-- Maestro Pet -- 4o jogo "Mozart Corre" (runner): libera a chave 'runner'.
--
-- O app novo chama game_begin('runner', dificuldade). Sem esta migracao o
-- game_begin REJEITA 'runner' e o score do runner nunca salva (jogo ainda roda,
-- mas fora do ranking). Aplicar ANTES (ou logo apos) subir o client.
--
-- O que muda:
--   1. check de game_sessions.game  -> inclui 'runner'
--   2. check de game_scores.game    -> inclui 'runner'
--   3. check de tournaments.game    -> inclui 'runner' (pra poder ter torneio)
--   4. game_begin                   -> aceita 'runner'
--   5. game_submit                  -> piso de duracao 0 (runner morre rapido)
--                                      e teto plausivel 8000 pro runner
-- game_scores_guard ja cobre runner pelo ramo ELSE (teto 10000) -- sem mudanca.
-- Idempotente. ASCII-only (seguro pra colar no editor SQL).
-- ============================================================================

-- 1/2/3. troca os CHECKs de valor de 'game' pra incluir 'runner' (acha o
-- constraint pelo proprio texto, entao funciona qualquer que seja o nome dele).
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.game_sessions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%treats%'
  loop execute format('alter table public.game_sessions drop constraint %I', r.conname); end loop;
  alter table public.game_sessions
    add constraint game_sessions_game_check check (game in ('treats','quiz','caminho','runner'));
end $$;

do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.game_scores'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%treats%'
  loop execute format('alter table public.game_scores drop constraint %I', r.conname); end loop;
  alter table public.game_scores
    add constraint game_scores_game_check check (game in ('treats','quiz','caminho','runner'));
end $$;

do $$
declare r record;
begin
  if to_regclass('public.tournaments') is not null then
    for r in
      select conname from pg_constraint
      where conrelid = 'public.tournaments'::regclass and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%treats%'
    loop execute format('alter table public.tournaments drop constraint %I', r.conname); end loop;
    alter table public.tournaments
      add constraint tournaments_game_check check (game in ('treats','quiz','caminho','runner'));
  end if;
end $$;

-- 4. game_begin aceita 'runner'
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

-- 5. game_submit: piso 0 e teto 8000 pro runner (duracao variavel, morre rapido)
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

  v_elapsed := extract(epoch from (now() - s.started_at));
  v_min := case s.game when 'treats' then 20 when 'caminho' then 5 else 0 end;
  if v_elapsed < v_min then
    raise exception 'partida curta demais' using errcode = '22023';
  end if;

  v_max := case s.game
             when 'treats' then 3000
             when 'quiz' then 400
             when 'caminho' then 1200
             when 'runner' then 8000
             else 10000 end;
  if p_score < 0 or p_score > v_max then
    raise exception 'pontuacao invalida' using errcode = '22023';
  end if;

  update public.game_sessions set used_at = now() where id = s.id;

  insert into public.game_scores(user_id, pet_id, game, score, difficulty)
  values (auth.uid(), p_pet_id, s.game, p_score, s.difficulty);
end;
$$;
revoke all on function public.game_submit(uuid, int, uuid) from public, anon;
grant execute on function public.game_submit(uuid, int, uuid) to authenticated;

notify pgrst, 'reload schema';

-- ============================================================================
-- READ-BACK (aba NOVA do editor):
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid='public.game_sessions'::regclass and contype='c'
--       and pg_get_constraintdef(oid) ilike '%treats%';   -- deve listar 'runner'
--   select pg_get_constraintdef(oid) from pg_constraint
--     where conrelid='public.game_scores'::regclass and contype='c'
--       and pg_get_constraintdef(oid) ilike '%treats%';    -- deve listar 'runner'
--   select pg_get_functiondef('public.game_begin(text,smallint)'::regprocedure) ilike '%runner%'; -- t
--   select pg_get_functiondef('public.game_submit(uuid,int,uuid)'::regprocedure) ilike '%runner%'; -- t
-- ============================================================================
