/**
 * Geocodificação de endereço -> lat/lng via Nominatim (OpenStreetMap).
 *
 * ⚠️ Uso GRÁTIS com regras DURAS (ToS do servidor público):
 *  - Máx 1 req/s. Chamar SÓ sob ação explícita do usuário (clique/submit),
 *    NUNCA em loop, batch ou no render. Proibido pré-popular a base inteira.
 *  - Cachear o resultado: persistir lat/lng no banco e nunca re-geocodar.
 *  - countrycodes=br + limit=1 pra reduzir ruído.
 *  - Best-effort: se falhar/vazio, retorna null e o fluxo segue sem coords.
 *  Se o volume crescer, mover pra uma edge function com User-Agent próprio.
 */

export async function geocodeAddress(
  query: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (q.length < 4) return null;
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=' +
      encodeURIComponent(q);
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' }, signal });
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lat = Number(arr[0].lat);
    const lng = Number(arr[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

/** Monta a query de busca a partir dos campos do form de lugar. */
export function buildPlaceQuery(address: string, city?: string, state?: string): string {
  return [address, city, state, 'Brasil'].filter((s) => s && s.trim()).join(', ');
}
