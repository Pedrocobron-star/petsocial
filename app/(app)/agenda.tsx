import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { MeetupCard } from '@/components/meetup-card';
import { FONTS } from '@/lib/fonts';
import { placeKindMeta } from '@/lib/places-meta';
import { fetchMeetups, fetchSavedPlaces } from '@/lib/queries';
import type { PlaceWithStats } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

export default function AgendaScreen() {
  const { theme } = useTheme();
  const { activePet } = useActivePet();
  const { session } = useSession();
  const userId = session?.user.id;

  const eventsQuery = useQuery({
    queryKey: ['meetups', 'attending', activePet?.id],
    queryFn: () => fetchMeetups(activePet!.id, 'attending'),
    enabled: !!activePet,
  });
  const placesQuery = useQuery({
    queryKey: ['saved-places', userId],
    queryFn: () => fetchSavedPlaces(userId!),
    enabled: !!userId,
    retry: false,
  });

  const events = eventsQuery.data ?? [];
  const places = placesQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Minha agenda' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text, marginBottom: 2 }}>
          Seu roteiro pet 🐾
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>
          Os rolês que você confirmou e os lugares que salvou — tudo num lugar só.
        </Text>

        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text, marginBottom: 10 }}>
          📅 Rolês que vou
        </Text>
        {events.length > 0 ? (
          events.map((m) => <MeetupCard key={m.id} meetup={m} />)
        ) : (
          <AgendaEmpty
            text="Confirme presença em rolês (botão “Vou!”) pra montar seu roteiro."
            cta="Ver rolês"
            href="/(app)/(tabs)/meetups"
            theme={theme}
          />
        )}

        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 16,
            color: theme.text,
            marginTop: 26,
            marginBottom: 10,
          }}
        >
          📍 Lugares salvos
        </Text>
        {places.length > 0 ? (
          places.map((p) => <SavedPlaceCard key={p.id} place={p} theme={theme} />)
        ) : (
          <AgendaEmpty
            text="Salve lugares pet-friendly (botão de salvar no guia) pra tê-los aqui à mão."
            cta="Explorar lugares"
            href="/(app)/places"
            theme={theme}
          />
        )}
      </ScrollView>
    </View>
  );
}

function AgendaEmpty({
  text,
  cta,
  href,
  theme,
}: {
  text: string;
  cta: string;
  href: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.borderLight,
        backgroundColor: theme.surface,
        padding: 18,
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
        {text}
      </Text>
      <Link href={href as never} asChild>
        <Pressable
          style={{
            backgroundColor: theme.brand,
            paddingHorizontal: 16,
            paddingVertical: 9,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>{cta}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function SavedPlaceCard({
  place,
  theme,
}: {
  place: PlaceWithStats;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  const meta = placeKindMeta(place.kind);
  return (
    <Link href={{ pathname: '/places/[id]', params: { id: place.id } }} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 14,
          backgroundColor: theme.card,
          padding: 12,
          marginBottom: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            backgroundColor: meta.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: meta.color }}>
            {meta.label.toUpperCase()}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
            {place.name}
          </Text>
          <Text numberOfLines={1} style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted }}>
            {place.address}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
