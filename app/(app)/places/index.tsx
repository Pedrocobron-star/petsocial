import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { EmptyState } from '@/components/empty-state';
import { PlacesMap } from '@/components/places-map';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { buildPlaceQuery, geocodeAddress } from '@/lib/geocode';
import { formatDistance, getCurrentPosition, haversineKm, type Coords } from '@/lib/geo';
import { PLACE_KIND_META, placeKindMeta } from '@/lib/places-meta';
import { fetchPlaceKindCounts, fetchPlaces, qk, setPlaceCoords } from '@/lib/queries';
import type { PlaceKind, PlaceWithStats } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useTheme } from '@/providers/theme-provider';

const KIND_FILTERS: { value: PlaceKind | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'Tudo', emoji: '🗺️' },
  { value: 'vet', label: PLACE_KIND_META.vet.label, emoji: PLACE_KIND_META.vet.emoji },
  { value: 'pet_shop', label: PLACE_KIND_META.pet_shop.label, emoji: PLACE_KIND_META.pet_shop.emoji },
  { value: 'grooming', label: PLACE_KIND_META.grooming.label, emoji: PLACE_KIND_META.grooming.emoji },
  { value: 'hotel', label: PLACE_KIND_META.hotel.label, emoji: PLACE_KIND_META.hotel.emoji },
  { value: 'daycare', label: PLACE_KIND_META.daycare.label, emoji: PLACE_KIND_META.daycare.emoji },
  { value: 'park', label: PLACE_KIND_META.park.label, emoji: PLACE_KIND_META.park.emoji },
  { value: 'restaurant', label: PLACE_KIND_META.restaurant.label, emoji: PLACE_KIND_META.restaurant.emoji },
  { value: 'cafe', label: PLACE_KIND_META.cafe.label, emoji: PLACE_KIND_META.cafe.emoji },
  { value: 'event', label: PLACE_KIND_META.event.label, emoji: PLACE_KIND_META.event.emoji },
  { value: 'beach', label: PLACE_KIND_META.beach.label, emoji: PLACE_KIND_META.beach.emoji },
  { value: 'training', label: PLACE_KIND_META.training.label, emoji: PLACE_KIND_META.training.emoji },
  { value: 'other', label: PLACE_KIND_META.other.label, emoji: PLACE_KIND_META.other.emoji },
];

// Endereço sentinela dos lugares OSM sem rua — não mostrar cru nem geocodar.
const NO_ADDRESS = 'Ver no mapa';
const PAGE_STEP = 60;
const MAX_PAGE = 500;

type SortKey = 'top' | 'recent' | 'most_reviewed';

const SORT_OPTIONS: { value: SortKey; label: string; emoji: string }[] = [
  { value: 'top', label: 'Top rated', emoji: '⭐' },
  { value: 'most_reviewed', label: 'Mais avaliados', emoji: '💬' },
  { value: 'recent', label: 'Recentes', emoji: '🆕' },
];

export default function PlacesScreen() {
  return (
    <AppThemeProvider app="places">
      <PlacesInner />
    </AppThemeProvider>
  );
}

function PlacesInner() {
  const { theme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  // Aceita ?kind=vet (ou outros) pra pré-filtrar — vindo do health hub etc.
  const initialKind = isValidPlaceKind(params.kind) ? (params.kind as PlaceKind) : 'all';
  const [kind, setKind] = useState<PlaceKind | 'all'>(initialKind);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('top');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [myLoc, setMyLoc] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [nearMeTried, setNearMeTried] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_STEP);
  const qc = useQueryClient();
  // Lugares já tentados geocodar nesta sessão (evita re-tentar falhas em loop).
  const geocodeTriedRef = useRef<Set<string>>(new Set());
  const [geocodingLeft, setGeocodingLeft] = useState(0);
  const autoLocTriedRef = useRef(false);

  // Toggle "perto de mim": pega localização e ordena por distância (sobrepõe o sort).
  const toggleNearMe = async () => {
    if (myLoc) {
      setMyLoc(null);
      setNearMeTried(false);
      return;
    }
    setLocating(true);
    const c = await getCurrentPosition();
    setLocating(false);
    setNearMeTried(true);
    setMyLoc(c);
  };

  // Localização AO ABRIR: com milhares de lugares, mostrar "perto de você" por
  // padrão. Tenta 1x no mount (silencioso). Se negar, cai no default + aviso.
  useEffect(() => {
    if (autoLocTriedRef.current) return;
    autoLocTriedRef.current = true;
    (async () => {
      setLocating(true);
      const c = await getCurrentPosition();
      setLocating(false);
      setNearMeTried(true);
      if (c) setMyLoc(c);
    })();
  }, []);

  // Contagem por categoria → esconde chips de kind sem nenhum lugar.
  const kindCountsQuery = useQuery({
    queryKey: qk.placeKindCounts(),
    queryFn: fetchPlaceKindCounts,
    staleTime: 5 * 60_000,
  });
  const kindCounts = kindCountsQuery.data;
  const visibleKindFilters = useMemo(() => {
    if (!kindCounts) return KIND_FILTERS;
    return KIND_FILTERS.filter(
      (k) => k.value === 'all' || (kindCounts[k.value] ?? 0) > 0 || k.value === kind,
    );
  }, [kindCounts, kind]);

  // Se o query param mudar via deep link, sincroniza
  useEffect(() => {
    if (isValidPlaceKind(params.kind)) {
      setKind(params.kind as PlaceKind);
    }
  }, [params.kind]);

  // Mudou filtro/busca/localização → volta pro 1º "page".
  useEffect(() => {
    setPageSize(PAGE_STEP);
  }, [kind, search, myLoc]);

  const filter = {
    kind: kind === 'all' ? undefined : kind,
    search: search.trim() || undefined,
    // "Perto de mim" ativo → o servidor traz os mais próximos (entre milhares).
    near: myLoc ? { lat: myLoc.lat, lng: myLoc.lng } : undefined,
    limit: pageSize,
  };
  const filterKey = `${kind}-${search.trim()}-${myLoc ? `${myLoc.lat.toFixed(3)},${myLoc.lng.toFixed(3)}` : 'all'}-${pageSize}`;
  const query = useQuery({
    queryKey: qk.places(filterKey),
    queryFn: () => fetchPlaces(filter),
  });
  // Provavelmente há mais resultados se a página veio cheia.
  const maybeMore = (query.data?.length ?? 0) >= pageSize && pageSize < MAX_PAGE;

  const places = useMemo(() => {
    const all = query.data ?? [];
    // Anexa distância quando temos a localização do usuário e o lugar tem coords.
    const withDist = all.map((p) => ({
      ...p,
      distanceKm:
        myLoc && p.latitude != null && p.longitude != null
          ? haversineKm(myLoc.lat, myLoc.lng, p.latitude, p.longitude)
          : undefined,
    }));
    const sorted = [...withDist].sort((a, b) => {
      // "Perto de mim" sobrepõe os outros sorts: lugares sem coords vão pro fim.
      if (myLoc) {
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      }
      if (sort === 'top') {
        // Top rated: prioriza review_count >= 1 e maior rating, desempata por contagem
        if (a.review_count === 0 && b.review_count > 0) return 1;
        if (b.review_count === 0 && a.review_count > 0) return -1;
        if (a.avg_rating !== b.avg_rating) return b.avg_rating - a.avg_rating;
        return b.review_count - a.review_count;
      }
      if (sort === 'most_reviewed') {
        return b.review_count - a.review_count;
      }
      // recent
      return (a.created_at < b.created_at ? 1 : -1);
    });
    return sorted;
  }, [query.data, sort, myLoc]);

  // LISTA ↔ MAPA: ao abrir o Mapa, geocoda (Nominatim/OSM, grátis) os lugares que
  // têm endereço mas ainda não têm coordenada, e grava de volta (RPC set_place_coords).
  // Assim todo lugar da lista também aparece no mapa. Throttle de 1,2s respeita o
  // ToS do Nominatim (≤1 req/s); cap de 20 por abertura pra não martelar o serviço.
  useEffect(() => {
    if (view !== 'map') return;
    const all = query.data ?? [];
    const pending = all.filter(
      (p) =>
        p.latitude == null &&
        p.address &&
        p.address.trim().length > 3 &&
        p.address.trim() !== NO_ADDRESS &&
        !geocodeTriedRef.current.has(p.id),
    );
    if (pending.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      const batch = pending.slice(0, 20);
      setGeocodingLeft(batch.length);
      let filled = 0;
      for (const p of batch) {
        if (cancelled) break;
        geocodeTriedRef.current.add(p.id);
        try {
          const g = await geocodeAddress(
            buildPlaceQuery(p.address, p.city ?? undefined, p.state ?? undefined),
            controller.signal,
          );
          if (g) {
            await setPlaceCoords(p.id, g.lat, g.lng);
            filled++;
          }
        } catch {
          // best-effort (inclui abort) — segue/encerra
        }
        if (cancelled) break;
        setGeocodingLeft((n) => Math.max(0, n - 1));
        // throttle pro ToS do Nominatim (1 req/s)
        await new Promise((r) => setTimeout(r, 1200));
      }
      if (!cancelled) {
        setGeocodingLeft(0);
        if (filled > 0) qc.invalidateQueries({ queryKey: ['places'] });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort(); // aborta o fetch em voo → sem 2 requests concorrentes no toggle rápido
    };
  }, [view, query.data, qc]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Lugares',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Link href={'/(app)/agenda' as never} asChild>
                <Pressable
                  hitSlop={10}
                  style={{ paddingHorizontal: 8 }}
                  accessibilityLabel="Lugares salvos"
                >
                  <Ionicons name="bookmark-outline" size={22} color={theme.accent.color} />
                </Pressable>
              </Link>
              <Link href={'/(app)/places/new' as never} asChild>
                <Pressable hitSlop={10} style={{ paddingHorizontal: 8 }} accessibilityLabel="Adicionar lugar">
                  <Ionicons name="add" size={26} color={theme.accent.color} />
                </Pressable>
              </Link>
            </View>
          ),
        }}
      />

      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.borderLight,
            borderRadius: 999,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="search" size={18} color={theme.textDim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por nome ou endereço..."
            placeholderTextColor={theme.textDim}
            style={{ flex: 1, fontFamily: FONTS.body, fontSize: 14, color: theme.text }}
          />
          {search.length > 0 ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>

        {/* Toggle Lista / Mapa + Perto de mim */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              gap: 4,
              backgroundColor: theme.borderLight,
              borderRadius: 999,
              padding: 3,
            }}
          >
          {(['list', 'map'] as const).map((v) => {
            const active = view === v;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? theme.accent.color : 'transparent',
                }}
              >
                <Ionicons
                  name={v === 'list' ? 'list' : 'map'}
                  size={14}
                  color={active ? theme.accent.onAccent : theme.textDim}
                />
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12.5,
                    color: active ? theme.accent.onAccent : theme.textDim,
                  }}
                >
                  {v === 'list' ? 'Lista' : 'Mapa'}
                </Text>
              </Pressable>
            );
          })}
          </View>

          {/* Perto de mim — ordena por distância (web/PWA) */}
          <Pressable
            onPress={toggleNearMe}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Ordenar por lugares perto de mim"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: myLoc ? theme.accent.color : theme.border,
              backgroundColor: myLoc ? theme.accent.surface : 'transparent',
              opacity: locating ? 0.6 : 1,
            }}
          >
            <Ionicons
              name={myLoc ? 'navigate' : 'navigate-outline'}
              size={14}
              color={myLoc ? theme.accent.color : theme.textDim}
            />
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                color: myLoc ? theme.accent.dark : theme.textDim,
              }}
            >
              {locating ? 'Localizando…' : myLoc ? 'Perto de mim ✓' : 'Perto de mim'}
            </Text>
          </Pressable>
        </View>

        {/* Localização negada/indisponível → orienta a ativar ou buscar */}
        {!locating && myLoc === null && nearMeTried ? (
          <Pressable
            onPress={toggleNearMe}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: theme.accent.surface,
              borderWidth: 1,
              borderColor: theme.accent.color,
            }}
          >
            <Ionicons name="navigate-outline" size={16} color={theme.accent.color} />
            <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.accent.dark }}>
              Ative a localização pra ver o que tá perto de você — ou busque por nome/cidade e use as categorias.
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.accent.color }}>Ativar</Text>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingTop: 10, paddingBottom: 4 }}
        >
          {visibleKindFilters.map((k) => {
            const active = kind === k.value;
            return (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: active ? theme.accent.color : theme.borderLight,
                }}
              >
                <Text style={{ fontSize: 13 }}>{k.emoji}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: active ? theme.accent.onAccent : theme.text,
                  }}
                >
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort options — só quando há resultados pra ordenar */}
        {places.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            {/* Quando "perto de mim" tá on, ele sobrepõe o sort — mostra explícito */}
            {myLoc ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: theme.accent.surface,
                  borderWidth: 1,
                  borderColor: theme.accent.color,
                }}
              >
                <Ionicons name="navigate" size={11} color={theme.accent.dark} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.accent.dark }}>
                  Por distância
                </Text>
              </View>
            ) : null}
            {SORT_OPTIONS.map((s) => {
              const active = sort === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => {
                    // Sort manual desliga "perto de mim" (que sobrepõe a ordenação).
                    setMyLoc(null);
                    setNearMeTried(false);
                    setSort(s.value);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: active && !myLoc ? theme.accent.surface : 'transparent',
                    borderWidth: 1,
                    borderColor: active && !myLoc ? theme.accent.color : theme.borderLight,
                  }}
                >
                  <Text style={{ fontSize: 11 }}>{s.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      color: active ? theme.accent.dark : theme.textDim,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {view === 'map' ? (
        <View style={{ flex: 1 }}>
          {geocodingLeft > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: theme.accent.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
              }}
            >
              <ActivityIndicator size="small" color={theme.accent.color} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.accent.dark }}>
                Localizando lugares no mapa… ({geocodingLeft})
              </Text>
            </View>
          ) : null}
          <PlacesMap
            places={places.map((p) => ({
              id: p.id,
              name: p.name,
              latitude: p.latitude,
              longitude: p.longitude,
              emoji: placeKindMeta(p.kind).emoji,
            }))}
            onSelect={(id) => router.push({ pathname: '/places/[id]', params: { id } } as never)}
            accent={theme.accent.color}
          />
        </View>
      ) : (
      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceCard place={item} distanceKm={item.distanceKm} />}
        contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -12, marginTop: -12, marginBottom: 12 }}>
            <AreaHero area="places" />
          </View>
        }
        ListFooterComponent={
          maybeMore ? (
            <Pressable
              onPress={() => setPageSize((p) => Math.min(p + PAGE_STEP, MAX_PAGE))}
              disabled={query.isFetching}
              style={{
                marginTop: 4,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: query.isFetching ? 0.6 : 1,
              }}
            >
              {query.isFetching ? (
                <ActivityIndicator size="small" color={theme.accent.color} />
              ) : (
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.accent.color }}>
                  Carregar mais lugares
                </Text>
              )}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          query.isLoading ? null : (
            <EmptyState
              emoji="🗺️"
              title={search || kind !== 'all' ? 'Nada por aqui' : 'Sem lugares ainda'}
              description={
                search || kind !== 'all'
                  ? 'Tente outro filtro ou termo de busca.'
                  : 'Conhece um pet shop, vet ou parque incrível? Adicione e ajude outros tutores!'
              }
              action={
                <Link href={'/(app)/places/new' as never} asChild>
                  <Button title="+ Adicionar lugar" />
                </Link>
              }
            />
          )
        }
      />
      )}
    </View>
  );
}

function PlaceCard({ place, distanceKm }: { place: PlaceWithStats; distanceKm?: number }) {
  const { theme } = useTheme();
  const meta = placeKindMeta(place.kind);

  return (
    <Link href={{ pathname: '/places/[id]' as never, params: { id: place.id } as never }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        {/* Hero colorido por categoria */}
        <View
          style={{
            backgroundColor: meta.bg,
            paddingVertical: 16,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: meta.color,
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: meta.text,
                }}
              >
                {meta.label}
              </Text>
              {place.verified ? (
                <Ionicons name="checkmark-circle" size={11} color="#16A34A" />
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 18,
                color: theme.text,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {place.name}
            </Text>
          </View>
          {place.review_count > 0 ? (
            <View
              style={{
                backgroundColor: '#FFFFFF',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 12,
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  {place.avg_rating.toFixed(1)}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: theme.textDim }}>
                {place.review_count} {place.review_count === 1 ? 'review' : 'reviews'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Endereço + cidade */}
        <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={theme.textDim} style={{ marginTop: 2 }} />
            {place.address && place.address !== NO_ADDRESS ? (
              <Text
                style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text, lineHeight: 18 }}
                numberOfLines={2}
              >
                {place.address}
                {place.city ? <Text style={{ color: theme.textDim }}> · {place.city}</Text> : null}
              </Text>
            ) : (
              <Text
                style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, lineHeight: 18 }}
                numberOfLines={2}
              >
                {place.city || 'Endereço não informado'}
              </Text>
            )}
          </View>
          {distanceKm != null ? (
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: meta.bg,
              }}
            >
              <Ionicons name="navigate" size={11} color={meta.color} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: meta.text }}>
                a {formatDistance(distanceKm)} de você
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

function isValidPlaceKind(value: string | undefined): value is PlaceKind {
  if (!value) return false;
  return [
    'vet',
    'pet_shop',
    'grooming',
    'hotel',
    'daycare',
    'park',
    'training',
    'restaurant',
    'cafe',
    'event',
    'beach',
    'other',
  ].includes(value);
}
