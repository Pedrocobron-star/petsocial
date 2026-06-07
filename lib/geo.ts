// Geolocalização leve pra Achados & Perdidos. Sem dependência nativa:
// usa navigator.geolocation (web/PWA). Em nativo sem expo-location, resolve null.

export interface Coords {
  lat: number;
  lng: number;
}

/** Pega a localização atual. Resolve null se indisponível ou se o usuário negar. */
export function getCurrentPosition(): Promise<Coords | null> {
  return new Promise((resolve) => {
    const geo = (globalThis as { navigator?: { geolocation?: Geolocation } })?.navigator?.geolocation;
    if (!geo) {
      resolve(null);
      return;
    }
    geo.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60_000 },
    );
  });
}

/** Distância em km entre dois pontos (fórmula de haversine). */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Formata distância pra UI: "320 m", "2,4 km", "12 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}
