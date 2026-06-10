import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfDay } from 'date-fns';
import { Link, Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EventCalendar } from '@/components/agenda/event-calendar';
import { MeetupCard } from '@/components/meetup-card';
import { PressScale } from '@/components/ui/press-scale';
import { groupByDay, mergeIntoAgenda } from '@/lib/agenda-merge';
import { FONTS } from '@/lib/fonts';
import { placeKindMeta } from '@/lib/places-meta';
import { fetchAgendaRaw, fetchMeetups, fetchSavedPlaces, qk } from '@/lib/queries';
import type { AgendaItem, PlaceWithStats } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

type ViewMode = 'list' | 'calendar';

export default function AgendaScreen() {
  const { theme } = useTheme();
  const { activePet } = useActivePet();
  const { session } = useSession();
  const router = useRouter();
  const userId = session?.user.id;
  const petId = activePet?.id;

  const [view, setView] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Agenda de saúde/cuidados do pet ativo (mesma fonte da agenda do pet)
  const rawQuery = useQuery({
    queryKey: petId ? qk.petAgenda(petId, 'home') : ['pet-agenda', 'none'],
    queryFn: () => fetchAgendaRaw(petId!),
    enabled: !!petId,
  });

  const careItems: AgendaItem[] = useMemo(() => {
    if (!rawQuery.data) return [];
    const start = addDays(startOfDay(new Date()), -30).toISOString();
    const end = addDays(startOfDay(new Date()), 120).toISOString();
    return mergeIntoAgenda(rawQuery.data, start, end);
  }, [rawQuery.data]);

  const careGroups = useMemo(() => {
    const groups = groupByDay(careItems);
    if (!selectedDate) return groups;
    const key = selectedDate.toISOString().slice(0, 10);
    return groups.filter((g) => g.dayKey === key);
  }, [careItems, selectedDate]);

  const eventsQuery = useQuery({
    queryKey: ['meetups', 'attending', petId],
    queryFn: () => fetchMeetups(petId!, 'attending'),
    enabled: !!petId,
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
        <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, marginBottom: 14 }}>
          Cuidados de saúde, rolês confirmados e lugares salvos — tudo num lugar só.
        </Text>

        {/* Toggle Lista / Mês */}
        <View
          style={{
            flexDirection: 'row',
            gap: 2,
            backgroundColor: theme.borderLight,
            borderRadius: 999,
            padding: 3,
            alignSelf: 'flex-start',
            marginBottom: 14,
          }}
        >
          <ToggleBtn icon="list" label="Lista" active={view === 'list'} onPress={() => setView('list')} theme={theme} />
          <ToggleBtn icon="calendar" label="Mês" active={view === 'calendar'} onPress={() => setView('calendar')} theme={theme} />
        </View>

        {view === 'calendar' ? (
          <View style={{ marginBottom: 16 }}>
            {petId ? (
              <EventCalendar items={careItems} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
            ) : (
              <AgendaEmpty
                text="Cadastre um pet pra ver a agenda de saúde no calendário."
                cta="Ver meus pets"
                href="/(app)/pets-overview"
                theme={theme}
              />
            )}
          </View>
        ) : null}

        {/* Cuidados do pet (saúde) */}
        <SectionTitle theme={theme}>
          🩺 Cuidados {activePet ? `de ${activePet.name}` : 'do pet'}
        </SectionTitle>
        {!petId ? (
          <AgendaEmpty text="Cadastre um pet pra acompanhar vacinas, vermífugo e consultas." cta="Adicionar pet" href="/(app)/pet/new" theme={theme} />
        ) : careGroups.length === 0 ? (
          <AgendaEmpty
            text={selectedDate ? 'Nada nesse dia.' : 'Sem cuidados agendados. Registre vacinas e consultas pra montar a agenda.'}
            cta="Abrir agenda do pet"
            href={`/(app)/pet/${petId}/agenda`}
            theme={theme}
          />
        ) : (
          <View style={{ gap: 4, marginBottom: 6 }}>
            {careGroups.map((g) => (
              <View key={g.dayKey} style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, letterSpacing: 0.8, color: theme.brand, marginBottom: 6, marginTop: 4 }}>
                  {g.dayLabel}
                </Text>
                {g.items.map((it) => (
                  <CareRow
                    key={it.key}
                    item={it}
                    theme={theme}
                    onPress={() => router.push(`/(app)/pet/${it.pet_id}/agenda` as never)}
                  />
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Rolês */}
        <SectionTitle theme={theme}>🎉 Rolês que vou</SectionTitle>
        {events.length > 0 ? (
          events.map((m) => <MeetupCard key={m.id} meetup={m} />)
        ) : (
          <AgendaEmpty text="Confirme presença em rolês (botão “Vou!”) pra montar seu roteiro." cta="Ver rolês" href="/(app)/(tabs)/meetups" theme={theme} />
        )}

        {/* Lugares */}
        <SectionTitle theme={theme}>📍 Lugares salvos</SectionTitle>
        {places.length > 0 ? (
          places.map((p) => <SavedPlaceCard key={p.id} place={p} theme={theme} />)
        ) : (
          <AgendaEmpty text="Salve lugares pet-friendly (botão de salvar no guia) pra tê-los aqui à mão." cta="Explorar lugares" href="/(app)/places" theme={theme} />
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children, theme }: { children: React.ReactNode; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text, marginTop: 22, marginBottom: 10 }}>
      {children}
    </Text>
  );
}

function ToggleBtn({
  icon,
  label,
  active,
  onPress,
  theme,
}: {
  icon: 'list' | 'calendar';
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <PressScale
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? theme.surface : 'transparent',
      }}
    >
      <Ionicons name={icon} size={15} color={active ? theme.brand : theme.textDim} />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: active ? theme.text : theme.textDim }}>{label}</Text>
    </PressScale>
  );
}

function CareRow({
  item,
  theme,
  onPress,
}: {
  item: AgendaItem;
  theme: ReturnType<typeof useTheme>['theme'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: item.tint.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={1}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted }} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}
      </View>
      {item.log?.status === 'done' ? (
        <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
      )}
    </Pressable>
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
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>{text}</Text>
      <Link href={href as never} asChild>
        <Pressable style={{ backgroundColor: theme.brand, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 }}>
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
          style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: meta.color }}>{meta.label.toUpperCase()}</Text>
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
