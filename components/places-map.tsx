import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

export interface MapPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  emoji?: string;
}

// ----------------------------------------------------------------------------
// Mapa de Lugares — Leaflet + OpenStreetMap (aberto, sem chave, custo ZERO).
// Carregado do CDN em runtime só no WEB (PWA). Mostra os lugares como pins +
// "centralizar em mim" via geolocalização do navegador.
// ----------------------------------------------------------------------------

function injectCss(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}
function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('script-failed:' + src));
    document.body.appendChild(s);
  });
}

let leafletPromise: Promise<unknown> | null = null;
function loadLeaflet(): Promise<unknown> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new Error('no-dom'));
  const w = window as unknown as { L?: { markerClusterGroup?: unknown } };
  if (w.L && w.L.markerClusterGroup) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = (async () => {
    injectCss('leaflet-css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
    if (!w.L) await injectScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
    // Plugin de clustering (agrupa pinos no zoom-out). Opcional: se o CDN falhar,
    // o mapa segue funcionando com pins soltos (fallback no layer).
    injectCss('leaflet-cluster-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css');
    injectCss('leaflet-cluster-default-css', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css');
    try {
      if (!w.L?.markerClusterGroup) {
        await injectScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
      }
    } catch {
      /* segue sem cluster */
    }
    return w.L;
  })();
  return leafletPromise;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export function PlacesMap({
  places,
  onSelect,
  accent,
}: {
  places: MapPlace[];
  onSelect: (id: string) => void;
  accent: string;
}) {
  const { theme } = useTheme();
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let map: any;
    loadLeaflet()
      .then((L: any) => {
        if (!containerRef.current) return;
        map = L.map(containerRef.current, { zoomControl: true }).setView([-14.235, -51.925], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        }).addTo(map);
        // Agrupa os pinos no zoom-out (markercluster). Fallback pra layer simples
        // se o plugin não tiver carregado.
        map._placeLayer = (
          L.markerClusterGroup
            ? L.markerClusterGroup({
                chunkedLoading: true,
                maxClusterRadius: 55,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
              })
            : L.layerGroup()
        ).addTo(map);
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {});
    return () => {
      if (map) map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map || !map._placeLayer) return;
    const layer = map._placeLayer;
    layer.clearLayers();
    const pts: [number, number][] = [];
    places.forEach((p) => {
      if (p.latitude == null || p.longitude == null) return;
      const icon = L.divIcon({
        className: '',
        html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">${p.emoji ?? '📍'}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const m = L.marker([p.latitude, p.longitude], { icon });
      m.bindPopup(`<b>${escapeHtml(p.name)}</b><br/><a href="#" data-pid="${p.id}">Ver detalhes</a>`);
      m.on('click', () => onSelect(p.id));
      layer.addLayer(m); // funciona pra markerClusterGroup E layerGroup
      pts.push([p.latitude, p.longitude]);
    });
    if (pts.length > 0) {
      try {
        map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
      } catch {
        /* noop */
      }
    }
  }, [ready, places, onSelect]);

  const locateMe = () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const L = (window as any).L;
        const map = mapRef.current;
        if (L && map) {
          const { latitude, longitude } = pos.coords;
          if (userMarkerRef.current) userMarkerRef.current.remove();
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.4)"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          userMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(map);
          map.setView([latitude, longitude], 14);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 }}>
        <Ionicons name="map" size={40} color={theme.textDim} />
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, textAlign: 'center' }}>
          O mapa abre no app web (PWA). Por aqui, use a lista.
        </Text>
      </View>
    );
  }

  const withCoords = places.filter((p) => p.latitude != null && p.longitude != null).length;

  return (
    <View style={{ flex: 1 }}>
      <View ref={containerRef} style={{ flex: 1, backgroundColor: theme.borderLight }} />

      {/* Aviso quando nenhum lugar tem coordenada ainda */}
      {ready && withCoords === 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            right: 12,
            backgroundColor: theme.surface,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: theme.borderLight,
          }}
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center' }}>
            Nenhum lugar com localização no mapa ainda. Ao adicionar um lugar, marque a posição pra
            ele aparecer aqui.
          </Text>
        </View>
      ) : null}

      {/* Botão "centralizar em mim" */}
      <Pressable
        onPress={locateMe}
        accessibilityLabel="Centralizar na minha localização"
        style={{
          position: 'absolute',
          right: 14,
          bottom: 24,
          backgroundColor: '#FFFFFF',
          borderRadius: 999,
          width: 46,
          height: 46,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Ionicons name={locating ? 'hourglass-outline' : 'locate'} size={22} color={accent} />
      </Pressable>
    </View>
  );
}
