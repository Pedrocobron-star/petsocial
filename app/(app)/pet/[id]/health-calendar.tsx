import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { FONTS } from '@/lib/fonts';
import {
  fetchHealthEventsRange,
  fetchPet,
  qk,
  type HealthEventKind,
  type HealthTimelineEvent,
} from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

/** Cor e label de cada tipo de evento, exibido como dot na grade. */
const EVENT_META: Record<HealthEventKind, { color: string; label: string; emoji: string; href: (petId: string) => string }> = {
  vaccine: { color: '#F97316', label: 'Vacina', emoji: '💉', href: (id) => `/pet/${id}/vaccinations` },
  parasite: { color: '#16A34A', label: 'Parasitas', emoji: '💊', href: (id) => `/pet/${id}/parasites` },
  vet_visit: { color: '#0EA5E9', label: 'Consulta', emoji: '🩺', href: (id) => `/pet/${id}/vet-visits` },
  weight: { color: '#EC4899', label: 'Peso', emoji: '⚖️', href: (id) => `/pet/${id}/weight` },
  medication_started: { color: '#8B5CF6', label: 'Remédio', emoji: '🧪', href: (id) => `/pet/${id}/medications` },
  symptom: { color: '#EF4444', label: 'Sintoma', emoji: '📝', href: (id) => `/pet/${id}/symptoms` },
};

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export default function HealthCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });

  const monthKey = format(cursor, 'yyyy-MM');
  const monthStart = startOfMonth(cursor);

  const eventsQuery = useQuery({
    queryKey: qk.healthMonth(id, monthKey),
    // Limites como DATA pura (não toISOString): as colunas (applied_at, visited_at,
    // weighed_at, start_date) são `date`. Converter pra UTC empurrava o dia 1 do mês
    // pra fora da janela (UTC-3 vira 03:00Z) e vazava o dia 1 do mês seguinte.
    // Início = dia 1; fim = dia 1 do mês seguinte (exclusivo, via .lt no fetch).
    queryFn: () =>
      fetchHealthEventsRange(
        id,
        format(monthStart, 'yyyy-MM-dd'),
        format(addMonths(monthStart, 1), 'yyyy-MM-dd'),
      ),
    enabled: !!id,
  });

  const eventsRaw = eventsQuery.data;
  const events = useMemo(() => eventsRaw ?? [], [eventsRaw]);
  const grid = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);

  const selectedEvents = selectedDay
    ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? []
    : [];

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: petQuery.data ? `Calendário de ${petQuery.data.name}` : 'Calendário' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Navegação de mês */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderRadius: 14,
            padding: 8,
          }}
        >
          <Pressable
            onPress={() => setCursor((c) => subMonths(c, 1))}
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 16,
                color: theme.text,
              }}
            >
              {format(cursor, "MMMM 'de' yyyy", { locale: ptBR }).replace(/^\w/, (c) =>
                c.toUpperCase(),
              )}
            </Text>
            {!isSameMonth(cursor, new Date()) ? (
              <Pressable onPress={() => setCursor(new Date())} hitSlop={6}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.brand, marginTop: 2 }}>
                  Voltar pra hoje
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={() => setCursor((c) => addMonths(c, 1))}
            hitSlop={8}
            style={{ padding: 8 }}
          >
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </Pressable>
        </View>

        {/* Cabeçalho dos dias da semana */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 4 }}>
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.textDim }}>
                {d}
              </Text>
            </View>
          ))}
        </View>

        {/* Grade do mês */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 14,
            padding: 4,
          }}
        >
          {chunk(grid, 7).map((week, weekIdx) => (
            <View key={weekIdx} style={{ flexDirection: 'row' }}>
              {week.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDay.get(dayKey) ?? [];
                const inMonth = isSameMonth(day, cursor);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const kinds = uniqueKinds(dayEvents);

                return (
                  <Pressable
                    key={dayKey}
                    onPress={() => setSelectedDay(day)}
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      padding: 2,
                    }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 6,
                        backgroundColor: isSelected
                          ? theme.brand
                          : isToday
                            ? '#FED7AA'
                            : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isToday || isSelected ? FONTS.bodyBold : FONTS.body,
                          fontSize: 13,
                          color: isSelected
                            ? '#FFFFFF'
                            : !inMonth
                              ? '#CBD5E1'
                              : isToday
                                ? '#9A3412'
                                : theme.text,
                        }}
                      >
                        {format(day, 'd')}
                      </Text>
                      {/* Dots */}
                      <View style={{ flexDirection: 'row', gap: 2, minHeight: 6 }}>
                        {kinds.slice(0, 4).map((kind) => (
                          <View
                            key={kind}
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              backgroundColor: isSelected ? '#FFFFFF' : EVENT_META[kind].color,
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Legenda */}
        <Legend />

        {/* Detalhe do dia selecionado */}
        {selectedDay ? (
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: theme.brand,
                marginTop: 6,
              }}
            >
              {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
            {selectedEvents.length === 0 ? (
              <EmptyState
                emoji="🌤"
                title="Nada registrado"
                description="Esse dia não tem eventos de saúde anotados."
              />
            ) : (
              selectedEvents.map((e) => <EventRow key={`${e.kind}-${e.source_id}`} event={e} petId={id} />)
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Legend() {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: theme.textDim,
        }}
      >
        Legenda
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(Object.keys(EVENT_META) as HealthEventKind[]).map((kind) => {
          const meta = EVENT_META[kind];
          return (
            <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View
                style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: meta.color }}
              />
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {meta.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function EventRow({ event, petId }: { event: HealthTimelineEvent; petId: string }) {
  const { theme } = useTheme();
  const meta = EVENT_META[event.kind];
  return (
    <Link href={meta.href(petId) as never} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          borderLeftWidth: 3,
          borderLeftColor: meta.color,
        }}
      >
        <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
            {event.title}
          </Text>
          {event.detail ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
              {event.detail}
            </Text>
          ) : null}
          {/* Hora só pra eventos com horário real (sintomas = timestamptz).
              Colunas `date` (vacina/consulta/peso) viriam como 00:00 — sem sentido. */}
          {event.date.length > 10 ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim, marginTop: 2 }}>
              {format(parseISO(event.date), 'HH:mm', { locale: ptBR })}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/**
 * Gera grade de 42 dias (6 semanas x 7) começando no domingo da semana do
 * primeiro dia do mês. Dias fora do mês aparecem grayed out.
 */
function buildMonthGrid(month: Date): Date[] {
  const first = startOfMonth(month);
  const startWeekDay = first.getDay(); // 0 = domingo
  const grid: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() - startWeekDay + i);
    grid.push(d);
  }
  return grid;
}

function groupEventsByDay(events: HealthTimelineEvent[]): Map<string, HealthTimelineEvent[]> {
  const map = new Map<string, HealthTimelineEvent[]>();
  for (const e of events) {
    const day = format(parseISO(e.date), 'yyyy-MM-dd');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return map;
}

function uniqueKinds(events: HealthTimelineEvent[]): HealthEventKind[] {
  const seen = new Set<HealthEventKind>();
  for (const e of events) seen.add(e.kind);
  return Array.from(seen);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
