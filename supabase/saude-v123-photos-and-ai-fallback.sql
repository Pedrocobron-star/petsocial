-- Saúde v123 — fotos em vacinas + consultas, e flag is_fallback no chat da IA.
-- Idempotente (add column if not exists). Aplicar no SQL editor do Supabase.

-- 1) Fotos nos registros de saúde
--    Vacinas: carteirinha, etiqueta do lote, nota fiscal.
--    Consultas: receita, exame, laudo.
alter table public.vaccinations
  add column if not exists photo_urls text[] not null default '{}';

alter table public.vet_visits
  add column if not exists photo_urls text[] not null default '{}';

-- 2) Chat IA: marca respostas automáticas locais (IA fora do ar / erro).
--    Mensagens com is_fallback=true NÃO contam na cota diária do plano free —
--    não faz sentido gastar cota numa não-resposta nem empurrar o tutor pro
--    paywall por causa dela.
alter table public.ai_messages
  add column if not exists is_fallback boolean not null default false;
