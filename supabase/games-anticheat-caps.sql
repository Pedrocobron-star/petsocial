-- ============================================================================
-- Maestro Pet — Conserto dos tetos anti-cheat dos jogos (2026-06)
--
-- BUG: o teto fisico de game_scores_guard era MENOR que o maximo legitimo:
--   - caminho: cap 300, mas 5 fases x (100 + ate 50 de bonus) = 750 -> TODO run
--     completo de Facil/Medio (5 fases) era REJEITADO.
--   - treats: cap 600, mas o combo de 30s passa de 1000 num run forte -> rejeitado.
--   - quiz: cap 300, max real ~216 -> ok (nao mexe no comportamento).
-- E o erro do insert era engolido no client (.catch(()=>{})) -> o jogador via
-- "750 pts" mas o score NUNCA entrava no ranking, sem nenhum aviso.
--
-- FIX: tetos generosos (so bloqueiam tampering grosseiro tipo 999999; nao sao
-- anti-cheat real — jogo casual client-side). Mantem o anti-spam de 10s.
-- Idempotente. Fonte canonica: tournaments.sql (que ja carrega estes tetos).
-- ============================================================================
create or replace function public.game_scores_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_max int;
  v_recent int;
begin
  -- teto fisico por jogo (ACIMA do maximo legitimo de cada jogo)
  v_max := case new.game when 'treats' then 5000 when 'quiz' then 800 when 'caminho' then 1500 else 10000 end;
  if new.score < 0 or new.score > v_max then
    raise exception 'pontuacao invalida' using errcode = '22023';
  end if;
  -- anti-spam: no minimo 10s entre submits do mesmo user no mesmo jogo
  select count(*) into v_recent from public.game_scores
    where user_id = new.user_id and game = new.game and created_at > now() - interval '10 seconds';
  if v_recent > 0 then
    raise exception 'aguarde alguns segundos antes de enviar outra pontuacao' using errcode = '22023';
  end if;
  return new;
end;
$$;
-- trigger ja existe (tournaments.sql); a funcao foi so recriada (create or replace).

-- ============================================================================
-- FIM. Read-back: select pg_get_functiondef('public.game_scores_guard'::regproc)
--   deve mostrar 5000/800/1500.
-- ============================================================================
