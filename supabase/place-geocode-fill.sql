-- ============================================================================
-- SET_PLACE_COORDS — preenchimento comunitário de coordenadas (lista ↔ mapa)
--
-- Problema: a RLS de UPDATE de `places` só deixa o DONO (ou admin) editar. Mas
-- pra LISTA e MAPA mostrarem o MESMO conteúdo, qualquer usuário que abrir o mapa
-- precisa conseguir geocodar (via Nominatim/OSM, grátis) um lugar que ainda não
-- tem lat/lng e gravar a coordenada de volta — senão o lugar some do mapa.
--
-- Solução: RPC SECURITY DEFINER que preenche lat/lng SÓ SE estiverem NULL
-- (geocode comunitário, idempotente). NÃO permite "mover" um lugar já
-- posicionado — então não dá pra abusar pra reposicionar lugares dos outros.
-- Valida faixa de coordenada e exige usuário logado.
--
-- Idempotente. Aplicar depois de schema.sql.
-- ============================================================================

create or replace function public.set_place_coords(
  p_place_id uuid,
  p_lat double precision,
  p_lng double precision
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- exige usuário autenticado
  if auth.uid() is null then
    return;
  end if;
  if p_lat is null or p_lng is null then
    return;
  end if;
  -- Anti-poisoning: só aceita coordenada dentro da bounding box do BRASIL
  -- (inclui ilhas oceânicas). O client geocoda com countrycodes=br, então
  -- resultado legítimo SEMPRE cai aqui; isso bloqueia um usuário mal-intencionado
  -- de fixar o primeiro preenchimento num ponto de outro país. Dentro do Brasil
  -- ainda é "first-writer-wins", mas dono/admin corrigem pela RLS normal.
  if p_lat < -34.0 or p_lat > 6.0 or p_lng < -74.5 or p_lng > -28.0 then
    return;
  end if;
  -- preenche SÓ se ainda não tem coordenada (anti-abuso: não move lugar já fixado)
  update public.places
     set latitude = p_lat,
         longitude = p_lng
   where id = p_place_id
     and latitude is null
     and longitude is null;
end;
$$;

revoke all on function public.set_place_coords(uuid, double precision, double precision) from public, anon;
grant execute on function public.set_place_coords(uuid, double precision, double precision) to authenticated;
