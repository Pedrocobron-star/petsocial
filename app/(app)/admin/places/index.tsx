import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { adminListPlaces } from '@/lib/places-admin';
import { PLACE_KIND_META } from '@/lib/places-meta';
import type { Place } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminPlacesListScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: ['admin-places-list', search],
    queryFn: () => adminListPlaces(search),
    refetchOnMount: 'always',
    enabled: isAdmin,
  });
  const places = query.data ?? [];

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Lugares · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="location" size={22} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>Guia de lugares</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {places.length} {places.length === 1 ? 'lugar' : 'lugares'}
            </Text>
          </View>
          <Link href="/(app)/admin/places/new" asChild>
            <Pressable
              style={{
                backgroundColor: '#F59E0B',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color="#1A1410" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>Novo</Text>
            </Pressable>
          </Link>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome…"
          placeholderTextColor={theme.textDim}
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.borderLight,
            borderRadius: 10,
            padding: 12,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: theme.text,
          }}
        />

        {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}

        {query.isError ? (
          <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>Erro ao carregar</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error ? query.error.message : 'desconhecido'}
            </Text>
          </View>
        ) : null}

        {places.length === 0 && !query.isLoading ? (
          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 14,
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <Text style={{ fontSize: 38 }}>📍</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>Nenhum lugar</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center' }}>
              Cadastre vets, parques, cafés, praias e eventos pet-friendly pro guia.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          {places.map((p) => (
            <PlaceRow key={p.id} place={p} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PlaceRow({ place }: { place: Place }) {
  const { theme } = useTheme();
  const meta = PLACE_KIND_META[place.kind];
  return (
    <Link href={{ pathname: '/(app)/admin/places/[id]', params: { id: place.id } }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: meta?.bg ?? '#FFEDD5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{meta?.emoji ?? '📍'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
              {place.name}
            </Text>
            {place.verified ? <Ionicons name="checkmark-circle" size={13} color="#16A34A" /> : null}
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
            {meta?.label ?? place.kind}
            {place.city ? ` · ${place.city}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
