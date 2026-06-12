-- ============================================================================
-- PLACES_KIND_COUNTS — contagem de lugares por categoria
--
-- Usada no app pra ESCONDER os chips de categoria que não têm nenhum lugar
-- (ex.: Adestrador, Evento), evitando que o usuário clique e caia numa tela
-- vazia. Read-only, SECURITY INVOKER (places tem SELECT público). Idempotente.
-- ============================================================================

create or replace function public.places_kind_counts()
returns table (kind text, n bigint)
language sql
stable
as $$
  select kind, count(*) as n
  from public.places
  group by kind;
$$;

grant execute on function public.places_kind_counts() to anon, authenticated;
