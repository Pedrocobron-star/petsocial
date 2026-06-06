import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { MeetupCard } from '@/components/meetup-card';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { FONTS } from '@/lib/fonts';
import { PLACE_KIND_META } from '@/lib/places-meta';
import { fetchMeetups, qk, type MeetupFilter } from '@/lib/queries';
import type { PlaceKind } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

const FILTERS: { value: MeetupFilter; label: string }[] = [
  { value: 'upcoming', label: 'Próximos' },
  { value: 'attending', label: 'Que vou' },
  { value: 'hosting', label: 'Sou host' },
  { value: 'past', label: 'Passados' },
];

export default function MeetupsScreen() {
  const { activePet } = useActivePet();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<MeetupFilter>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const meetupsQuery = useQuery({
    queryKey: qk.meetups(filter),
    queryFn: () => fetchMeetups(activePet!.id, filter),
    enabled: !!activePet,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: qk.meetups(filter) });
    setRefreshing(false);
  };

  const emptyConfig = emptyByFilter(filter);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          backgroundColor: theme.surface,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>Encontros</Text>
        <Link href="/(app)/meetup/new" asChild>
          <Pressable className="flex-row items-center gap-1 rounded-full bg-brand px-3 py-1.5">
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>Criar</Text>
          </Pressable>
        </Link>
      </View>

      <PlacesPromo />

      <View style={{ borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface }}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <FlatList
        data={meetupsQuery.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MeetupCard meetup={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListEmptyComponent={
          meetupsQuery.isLoading ? null : (
            <EmptyState
              emoji={emptyConfig.emoji}
              title={emptyConfig.title}
              description={emptyConfig.description}
              action={
                filter === 'upcoming' || filter === 'hosting' ? (
                  <Link href="/(app)/meetup/new" asChild>
                    <Button title="Criar encontro" />
                  </Link>
                ) : undefined
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

/** Atalho pro guia de lugares pet-friendly — resolve "onde levar meu pet?". */
function PlacesPromo() {
  const { theme } = useTheme();
  const cats: PlaceKind[] = ['park', 'restaurant', 'cafe', 'hotel', 'beach', 'pet_shop', 'event', 'vet'];
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
          📍 Lugares pet-friendly
        </Text>
        <Link href="/(app)/places" asChild>
          <Pressable hitSlop={6}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: theme.brand }}>
              Ver todos →
            </Text>
          </Pressable>
        </Link>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}
      >
        {cats.map((k) => {
          const m = PLACE_KIND_META[k];
          return (
            <Link key={k} href={{ pathname: '/(app)/places', params: { kind: k } }} asChild>
              <Pressable style={{ alignItems: 'center', width: 64 }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: m.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 5,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{m.emoji}</Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, textAlign: 'center' }}
                >
                  {m.label}
                </Text>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

function emptyByFilter(filter: MeetupFilter) {
  switch (filter) {
    case 'attending':
      return {
        emoji: '🐾',
        title: 'Você não confirmou nada',
        description: 'Veja os próximos encontros e confirme presença pra aparecerem aqui.',
      };
    case 'hosting':
      return {
        emoji: '🎉',
        title: 'Sem encontros como host',
        description: 'Crie um encontro pra reunir a turma.',
      };
    case 'past':
      return {
        emoji: '🕰️',
        title: 'Sem histórico ainda',
        description: 'Quando passar de um encontro, ele aparece aqui.',
      };
    default:
      return {
        emoji: '📅',
        title: 'Sem encontros marcados',
        description: 'Crie o primeiro encontro e convide outros pets.',
      };
  }
}
