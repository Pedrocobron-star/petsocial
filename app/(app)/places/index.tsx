import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { PLACE_KIND_META, placeKindMeta } from '@/lib/places-meta';
import { fetchPlaces, qk } from '@/lib/queries';
import type { PlaceKind, PlaceSpecies, PlaceWithStats } from '@/lib/types';
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
];

const SPECIES_FILTERS: { value: PlaceSpecies; label: string; emoji: string }[] = [
  { value: 'all', label: 'Pra todos', emoji: '🐾' },
  { value: 'dog', label: 'Cães', emoji: '🐶' },
  { value: 'cat', label: 'Gatos', emoji: '🐱' },
  { value: 'other', label: 'Outras', emoji: '🐰' },
];

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
  const params = useLocalSearchParams<{ kind?: string }>();
  // Aceita ?kind=vet (ou outros) pra pré-filtrar — vindo do health hub etc.
  const initialKind = isValidPlaceKind(params.kind) ? (params.kind as PlaceKind) : 'all';
  const [kind, setKind] = useState<PlaceKind | 'all'>(initialKind);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('top');
  const [species, setSpecies] = useState<PlaceSpecies>('all');

  // Se o query param mudar via deep link, sincroniza
  useEffect(() => {
    if (isValidPlaceKind(params.kind)) {
      setKind(params.kind as PlaceKind);
    }
  }, [params.kind]);

  const filter = { kind: kind === 'all' ? undefined : kind, search: search.trim() || undefined };
  const filterKey = `${kind}-${search.trim()}`;
  const query = useQuery({
    queryKey: qk.places(filterKey),
    queryFn: () => fetchPlaces(filter),
  });

  const places = useMemo(() => {
    const all = query.data ?? [];
    const sorted = [...all].sort((a, b) => {
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
    // Filtro por espécie (client-side): 'all' do lugar aparece em qualquer filtro
    if (species === 'all') return sorted;
    return sorted.filter((p) => {
      const sp = p.species ?? 'all';
      return sp === 'all' || sp === species;
    });
  }, [query.data, sort, species]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Pet Map',
          headerRight: () => (
            <Link href={'/(app)/places/new' as never} asChild>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 8 }}>
                <Ionicons name="add" size={26} color={theme.accent.color} />
              </Pressable>
            </Link>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingTop: 10, paddingBottom: 4 }}
        >
          {KIND_FILTERS.map((k) => {
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

        {/* Filtro por espécie — pra quem é o lugar */}
        <View style={{ flexDirection: 'row', gap: 6, paddingTop: 8 }}>
          {SPECIES_FILTERS.map((s) => {
            const active = species === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setSpecies(s.value)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: active ? theme.accent.color : theme.border,
                  backgroundColor: active ? theme.accent.surface : 'transparent',
                }}
              >
                <Text style={{ fontSize: 12 }}>{s.emoji}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11.5,
                    color: active ? theme.accent.dark : theme.textMuted,
                  }}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sort options — só quando há resultados pra ordenar */}
        {places.length > 1 ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
            {SORT_OPTIONS.map((s) => {
              const active = sort === s.value;
              return (
                <Pressable
                  key={s.value}
                  onPress={() => setSort(s.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 8,
                    backgroundColor: active ? theme.accent.surface : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? theme.accent.color : theme.borderLight,
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

      <FlatList
        data={places}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PlaceCard place={item} />}
        contentContainerStyle={{ padding: 12, gap: 10, flexGrow: 1 }}
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
    </View>
  );
}

function PlaceCard({ place }: { place: PlaceWithStats }) {
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
        <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Ionicons name="location-outline" size={14} color={theme.textDim} style={{ marginTop: 2 }} />
            <Text
              style={{
                flex: 1,
                fontFamily: FONTS.body,
                fontSize: 13,
                color: theme.text,
                lineHeight: 18,
              }}
              numberOfLines={2}
            >
              {place.address}
              {place.city ? <Text style={{ color: theme.textDim }}> · {place.city}</Text> : null}
            </Text>
          </View>
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
