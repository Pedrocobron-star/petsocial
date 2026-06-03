import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import {
  fetchAdoptionListings,
  listingChips,
  SPECIES_META,
  type AdoptionListing,
  type AdoptionSpecies,
} from '@/lib/adoption';
import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

export default function AdoptionFeedScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [species, setSpecies] = useState<AdoptionSpecies | 'all'>('all');

  const query = useQuery({
    queryKey: ['adoption-listings'],
    queryFn: () => fetchAdoptionListings(),
  });
  const all = query.data ?? [];
  const listings = species === 'all' ? all : all.filter((l) => l.species === species);
  const availableCount = all.filter((l) => l.status === 'available').length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Adoção',
          headerShown: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(app)/adoption/new' as never)}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}
            >
              <Ionicons name="add-circle" size={20} color={theme.brand} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>Anunciar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={560}>
          {/* Header */}
          <View
            style={{
              backgroundColor: '#FEF2F2',
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: '#FECACA',
              overflow: 'hidden',
            }}
          >
            <Text style={{ position: 'absolute', right: -4, bottom: -12, fontSize: 70, opacity: 0.1 }}>🏠</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#991B1B' }}>
              Encontre um amigo
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#B91C1C', marginTop: 4, lineHeight: 19 }}>
              {availableCount > 0
                ? `${availableCount} ${availableCount === 1 ? 'pet esperando' : 'pets esperando'} um lar. Adote com responsabilidade 💛`
                : 'Pets pra adoção responsável, anunciados pela comunidade e ONGs.'}
            </Text>
          </View>

          {/* Filtro de espécie */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
            <SpChip label="Todos" active={species === 'all'} onPress={() => setSpecies('all')} />
            {(Object.keys(SPECIES_META) as AdoptionSpecies[]).map((s) => (
              <SpChip
                key={s}
                label={`${SPECIES_META[s].emoji} ${SPECIES_META[s].label}`}
                active={species === s}
                onPress={() => setSpecies(s)}
              />
            ))}
          </View>

          {query.isLoading ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 30 }} />
          ) : listings.length === 0 ? (
            <EmptyState
              emoji="🐾"
              title="Nenhum pet por aqui ainda"
              description="Seja o primeiro a anunciar um pet pra adoção, ou volte em breve. Cada divulgação ajuda a achar um lar."
              action={
                <PressScale
                  onPress={() => router.push('/(app)/adoption/new' as never)}
                  style={{
                    backgroundColor: theme.brand,
                    paddingHorizontal: 18,
                    paddingVertical: 11,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="add-circle" size={16} color="#fff" />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>Anunciar um pet</Text>
                </PressScale>
              }
            />
          ) : (
            <View style={{ gap: 12 }}>
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </View>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function SpChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? theme.brand : theme.borderLight,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? '#fff' : theme.textDim }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ListingCard({ listing }: { listing: AdoptionListing }) {
  const { theme } = useTheme();
  const chips = listingChips(listing);
  const cover = listing.image_urls?.[0];
  const adopted = listing.status === 'adopted';

  return (
    <Link href={{ pathname: '/(app)/adoption/[id]', params: { id: listing.id } }} asChild>
      <PressScale
        style={{
          backgroundColor: theme.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: theme.borderLight,
          overflow: 'hidden',
          opacity: adopted ? 0.7 : 1,
        }}
      >
        <View>
          {cover ? (
            <Image source={{ uri: cover }} style={{ width: '100%', height: 180 }} contentFit="cover" />
          ) : (
            <View style={{ width: '100%', height: 180, backgroundColor: theme.borderLight, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 56 }}>{SPECIES_META[listing.species].emoji}</Text>
            </View>
          )}
          {adopted ? (
            <View
              style={{
                position: 'absolute',
                top: 10,
                left: 10,
                backgroundColor: '#16A34A',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff' }}>✓ Adotado</Text>
            </View>
          ) : null}
        </View>

        <View style={{ padding: 14, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text }}>{listing.pet_name}</Text>
            {listing.city ? (
              <Text style={{ marginLeft: 'auto', fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                📍 {listing.city}{listing.uf ? `/${listing.uf}` : ''}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {chips.map((c, i) => (
              <View key={i} style={{ backgroundColor: theme.borderLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textDim }}>{c}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, lineHeight: 18 }} numberOfLines={2}>
            {listing.description}
          </Text>
        </View>
      </PressScale>
    </Link>
  );
}
