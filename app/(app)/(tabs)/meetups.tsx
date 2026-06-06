import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { MeetupCard } from '@/components/meetup-card';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { FONTS } from '@/lib/fonts';
import { fetchMeetups, qk, type MeetupFilter } from '@/lib/queries';
import type { MeetupWithDetails } from '@/lib/types';
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

  // "Bombando" — eventos com mais confirmados (curadoria automática por RSVP)
  const featuredQuery = useQuery({
    queryKey: qk.meetups('upcoming'),
    queryFn: () => fetchMeetups(activePet!.id, 'upcoming'),
    enabled: !!activePet,
  });
  const featured = [...(featuredQuery.data ?? [])]
    .sort((a, b) => b.rsvps_count - a.rsvps_count)
    .slice(0, 6);

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
        <View>
          <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>Rolês</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: theme.textDim, marginTop: -2 }}>
            Encontros e eventos pra ir com seu pet 🗓️
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Link href="/(app)/agenda" asChild>
            <Pressable
              hitSlop={6}
              accessibilityLabel="Minha agenda"
              style={{ backgroundColor: theme.borderLight, padding: 8, borderRadius: 999 }}
            >
              <Ionicons name="bookmark-outline" size={18} color={theme.text} />
            </Pressable>
          </Link>
          <Link href="/(app)/meetup/new" asChild>
            <Pressable className="flex-row items-center gap-1 rounded-full bg-brand px-3 py-1.5">
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>Criar</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      {featured.length >= 3 ? <FeaturedStrip events={featured} /> : null}

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

/** Faixa "Bombando" — eventos com mais confirmados, pra descobrir o que tá rolando. */
function FeaturedStrip({ events }: { events: MeetupWithDetails[] }) {
  const { theme } = useTheme();
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
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 15,
          color: theme.text,
          paddingHorizontal: 16,
          marginBottom: 10,
        }}
      >
        🔥 Bombando
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}
      >
        {events.map((m) => {
          const d = new Date(m.starts_at);
          return (
            <Link key={m.id} href={{ pathname: '/meetup/[id]', params: { id: m.id } }} asChild>
              <Pressable
                style={{
                  width: 190,
                  borderRadius: 14,
                  backgroundColor: theme.card,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#C2410C' }}>
                  {format(d, "dd 'de' MMM • HH:mm", { locale: ptBR })}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 14,
                    color: theme.text,
                    marginTop: 4,
                    lineHeight: 18,
                  }}
                >
                  {m.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Ionicons name="paw" size={12} color={theme.textDim} />
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: theme.textMuted }}>
                    {m.rsvps_count} {m.rsvps_count === 1 ? 'confirmado' : 'confirmados'}
                  </Text>
                </View>
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
