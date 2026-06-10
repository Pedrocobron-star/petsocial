import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text, View } from 'react-native';

import { EventCalendar } from '@/components/agenda/event-calendar';
import { EventCard } from '@/components/agenda/event-card';
import { EventForm } from '@/components/agenda/event-form';
import { EventMoodLog } from '@/components/agenda/event-mood-log';
import { EventTemplatePicker } from '@/components/agenda/event-template-picker';
import { EmptyState } from '@/components/empty-state';
import { groupByDay, mergeIntoAgenda } from '@/lib/agenda-merge';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { type EventTemplate } from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
} from '@/lib/notifications';
import {
  deletePetEvent,
  fetchAgendaRaw,
  fetchPet,
  qk,
} from '@/lib/queries';
import type { AgendaItem, PetEvent } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type FilterPeriod = 'today' | '7d' | '30d' | 'all';
type ViewMode = 'list' | 'calendar';

const FILTER_OPTIONS: { value: FilterPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: '90 dias' },
];

/**
 * Tela principal de agenda do pet — junta:
 *  - pet_events (com recorrência expandida)
 *  - logs de eventos concluídos
 *  - vacinas (next_dose_at)
 *  - antiparasitários (next_due_at)
 *  - consultas vet (next_visit_at)
 *
 * Tudo ordenado cronologicamente. Read-only oriundo de outras features
 * tem ícone de cadeado pra evitar confusão com edição direta.
 */
export default function PetAgendaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const [filter, setFilter] = useState<FilterPeriod>('7d');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [notifStatus, setNotifStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  useEffect(() => {
    getNotificationPermissionStatus().then(setNotifStatus);
  }, []);

  const askNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotifStatus(granted ? 'granted' : 'denied');
    if (granted) toast.success('Lembretes ativados! 🔔', 'Vamos te avisar antes de cada evento');
  };

  const rawQuery = useQuery({
    queryKey: qk.petAgenda(id, filter),
    queryFn: () => fetchAgendaRaw(id),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === session?.user.id;

  // --- Range de datas baseado no filtro ---
  const range = useMemo(() => {
    const start = startOfDay(new Date());
    const days = filter === 'today' ? 1 : filter === '7d' ? 7 : filter === '30d' ? 30 : 90;
    const end = addDays(start, days);
    // Backwards: incluir até 30d atrás pra mostrar atrasados / completed recentes
    const lookBack = addDays(start, -30);
    return {
      start: lookBack.toISOString(),
      end: end.toISOString(),
      visualStart: start.toISOString(),
    };
  }, [filter]);

  // --- Merge de todas as fontes em AgendaItem[] ---
  const items: AgendaItem[] = useMemo(() => {
    if (!rawQuery.data) return [];
    return mergeIntoAgenda(rawQuery.data, range.start, range.end);
  }, [rawQuery.data, range.start, range.end]);

  // --- Agrupa por dia ---
  // Quando selectedDate está setado, filtra só esse dia
  const grouped = useMemo(() => {
    const groups = groupByDay(items);
    if (!selectedDate) return groups;
    const key = selectedDate.toISOString().slice(0, 10);
    return groups.filter((g) => g.dayKey === key);
  }, [items, selectedDate]);

  // --- Modals state ---
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formTemplate, setFormTemplate] = useState<EventTemplate | null>(null);
  const [formEditing, setFormEditing] = useState<PetEvent | null>(null);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodTarget, setMoodTarget] = useState<AgendaItem | null>(null);

  const openTemplate = (t: EventTemplate) => {
    setFormTemplate(t);
    setFormEditing(null);
    setFormOpen(true);
  };

  const openCustom = () => {
    setFormTemplate(null);
    setFormEditing(null);
    setFormOpen(true);
  };

  const openEdit = (event: PetEvent) => {
    setFormTemplate(null);
    setFormEditing(event);
    setFormOpen(true);
  };

  const openMood = (item: AgendaItem) => {
    setMoodTarget(item);
    setMoodOpen(true);
  };

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deletePetEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.petAgenda(id, filter) });
      toast.success('Removido');
    },
    onError: (e) => toast.error('Erro', e instanceof Error ? e.message : ''),
  });

  const handleCardPress = (item: AgendaItem) => {
    if (!item.editable) {
      Alert.alert(
        'Evento vinculado',
        'Esse evento vem de outra parte do app (vacinas, vermífugo ou consultas). Edite lá.',
      );
      return;
    }
    if (!isOwner) return;
    // Long-press behavior simplificado: tap abre menu
    const event = rawQuery.data?.events.find((e) => e.id === item.ref_id);
    if (!event) return;
    Alert.alert(item.title, undefined, [
      { text: 'Editar', onPress: () => openEdit(event) },
      {
        text: 'Excluir rotina',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir?', 'A rotina será removida (histórico fica).', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: () => deleteMutation.mutate(event.id),
            },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // --- Custo do mês ---
  const monthCost = useMemo(() => {
    if (!rawQuery.data) return 0;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return rawQuery.data.logs.reduce((acc, log) => {
      if (!log.actual_cost) return acc;
      const d = parseISO(log.occurrence_date);
      return d >= start ? acc + log.actual_cost : acc;
    }, 0);
  }, [rawQuery.data]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Agenda · ${petQuery.data.name}` : 'Agenda',
        }}
      />

      <FlatList
        data={grouped}
        keyExtractor={(g) => g.dayKey}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32, flexGrow: 1 }}
        renderItem={({ item: group }) => (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 12 }}>
              {/* Header do dia */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                  paddingLeft: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 14,
                    color: theme.text,
                    letterSpacing: -0.3,
                  }}
                >
                  {group.dayLabel}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: theme.textDim,
                  }}
                >
                  · {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                </Text>
              </View>

              <View style={{ gap: 6 }}>
                {group.items.map((it) => (
                  <EventCard
                    key={it.key}
                    item={it}
                    onPress={() => handleCardPress(it)}
                    onComplete={() => openMood(it)}
                  />
                ))}
              </View>
            </View>
          </CenteredColumn>
        )}
        ListHeaderComponent={
          <View>
            {/* Banner pedir permissão de notificações (mostra só se undetermined) */}
            {isOwner && notifStatus === 'undetermined' ? (
              <CenteredColumn maxWidth={540}>
                <PressScale
                  onPress={askNotifPermission}
                  style={{
                    marginTop: 10,
                    backgroundColor: theme.brandSurface,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 1,
                    borderColor: theme.brandLight,
                  }}
                >
                  <Text style={{ fontSize: 26 }}>🔔</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: theme.brandDark,
                      }}
                    >
                      Ativar lembretes
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        color: theme.brandDark,
                        opacity: 0.85,
                        marginTop: 1,
                      }}
                    >
                      Pra você não esquecer banho, vermífugo, vacinas e mais
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.brandDark} />
                </PressScale>
              </CenteredColumn>
            ) : null}

            {/* Atalhos: Galeria / Custos / Cuidadores */}
            {isOwner ? (
              <CenteredColumn maxWidth={540}>
                <View style={{ marginTop: 10, flexDirection: 'row', gap: 6 }}>
                  <ShortcutChip
                    href={`/pet/${id}/agenda-photos`}
                    emoji="📸"
                    label="Galeria"
                    tint="#FCE7F3"
                    tintText="#9D174D"
                  />
                  <ShortcutChip
                    href={`/pet/${id}/agenda-costs`}
                    emoji="💰"
                    label="Custos"
                    tint="#FEF3C7"
                    tintText="#92400E"
                  />
                  <ShortcutChip
                    href={`/pet/${id}/caretakers`}
                    emoji="🤝"
                    label="Cuidadores"
                    tint="#DCFCE7"
                    tintText="#166534"
                  />
                </View>
              </CenteredColumn>
            ) : null}

            {/* Toggle Lista / Mês */}
            <CenteredColumn maxWidth={540}>
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: theme.borderLight,
                  borderRadius: 12,
                  padding: 3,
                  marginTop: 10,
                  gap: 2,
                }}
              >
                <PressScale
                  onPress={() => setView('list')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 8,
                    borderRadius: 9,
                    backgroundColor: view === 'list' ? theme.surface : 'transparent',
                    gap: 5,
                  }}
                >
                  <Ionicons
                    name="list"
                    size={14}
                    color={view === 'list' ? theme.brand : theme.textDim}
                  />
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: view === 'list' ? theme.brand : theme.textDim,
                    }}
                  >
                    Lista
                  </Text>
                </PressScale>
                <PressScale
                  onPress={() => setView('calendar')}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 8,
                    borderRadius: 9,
                    backgroundColor: view === 'calendar' ? theme.surface : 'transparent',
                    gap: 5,
                  }}
                >
                  <Ionicons
                    name="calendar"
                    size={14}
                    color={view === 'calendar' ? theme.brand : theme.textDim}
                  />
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: view === 'calendar' ? theme.brand : theme.textDim,
                    }}
                  >
                    Mês
                  </Text>
                </PressScale>
              </View>
            </CenteredColumn>

            {/* Calendar grid (mostrado só no view='calendar') */}
            {view === 'calendar' ? (
              <CenteredColumn maxWidth={540}>
                <View style={{ marginTop: 10 }}>
                  <EventCalendar
                    items={items}
                    selectedDate={selectedDate}
                    onSelectDate={setSelectedDate}
                  />
                </View>
                {selectedDate ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 10,
                      paddingLeft: 4,
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim }}>
                      Mostrando só{' '}
                      <Text style={{ fontFamily: FONTS.bodyBold, color: theme.brand }}>
                        {format(selectedDate, "d 'de' MMM", { locale: ptBR })}
                      </Text>
                    </Text>
                    <PressScale onPress={() => setSelectedDate(null)} hitSlop={6}>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 11,
                          color: theme.brand,
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        limpar
                      </Text>
                    </PressScale>
                  </View>
                ) : null}
              </CenteredColumn>
            ) : null}

            {/* Filtro de período (só no view='list') */}
            {view === 'list' ? (
            <CenteredColumn maxWidth={540}>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {FILTER_OPTIONS.map((f) => {
                  const active = filter === f.value;
                  return (
                    <PressScale
                      key={f.value}
                      onPress={() => setFilter(f.value)}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        borderRadius: 12,
                        backgroundColor: active ? theme.brand : theme.borderLight,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 12,
                          color: active ? '#fff' : theme.textMuted,
                        }}
                      >
                        {f.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </CenteredColumn>
            ) : null}

            {/* Custo do mês */}
            {monthCost > 0 ? (
              <CenteredColumn maxWidth={540}>
                <View
                  style={{
                    marginTop: 12,
                    backgroundColor: theme.brandSurface,
                    borderRadius: 14,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderWidth: 1,
                    borderColor: theme.brandLight,
                  }}
                >
                  <Text style={{ fontSize: 22 }}>💰</Text>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: theme.brandDark,
                      }}
                    >
                      Gasto este mês
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        color: theme.brandDark,
                        opacity: 0.75,
                      }}
                    >
                      Soma dos eventos concluídos com custo registrado
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 18,
                      color: theme.brandDark,
                      letterSpacing: -0.3,
                    }}
                  >
                    R$ {monthCost.toFixed(2).replace('.', ',')}
                  </Text>
                </View>
              </CenteredColumn>
            ) : null}

            {/* CTA novo evento */}
            {isOwner ? (
              <CenteredColumn maxWidth={540}>
                <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                  <PressScale
                    onPress={() => setTemplatePickerOpen(true)}
                    style={{
                      flex: 1,
                      backgroundColor: theme.brand,
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>✨</Text>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: '#fff',
                      }}
                    >
                      Rotina pronta
                    </Text>
                  </PressScale>
                  <PressScale
                    onPress={openCustom}
                    style={{
                      flex: 1,
                      backgroundColor: theme.borderLight,
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="add" size={16} color={theme.text} />
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: theme.text,
                      }}
                    >
                      Personalizar
                    </Text>
                  </PressScale>
                </View>
              </CenteredColumn>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          rawQuery.isLoading ? null : (
            <EmptyState
              emoji="📅"
              title="Agenda vazia"
              description={
                isOwner
                  ? 'Adicione rotinas prontas (banho, escolinha, passeio) ou crie eventos personalizados — tudo num lugar só.'
                  : 'O tutor ainda não cadastrou eventos.'
              }
            />
          )
        }
      />

      {/* Modals */}
      {petQuery.data ? (
        <EventTemplatePicker
          visible={templatePickerOpen}
          species={petQuery.data.species}
          onClose={() => setTemplatePickerOpen(false)}
          onSelectTemplate={openTemplate}
          onCustom={openCustom}
        />
      ) : null}

      <EventForm
        visible={formOpen}
        petId={id}
        template={formTemplate}
        existing={formEditing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          setFormTemplate(null);
          setFormEditing(null);
          qc.invalidateQueries({ queryKey: qk.petAgenda(id, filter) });
        }}
      />

      {moodTarget ? (
        <EventMoodLog
          visible={moodOpen}
          eventId={moodTarget.ref_id}
          petId={id}
          occurrenceDate={moodTarget.occurs_at.slice(0, 10)}
          eventKind={moodTarget.kind as never}
          eventTitle={moodTarget.title}
          estimatedCost={
            rawQuery.data?.events.find((e) => e.id === moodTarget.ref_id)
              ?.estimated_cost ?? null
          }
          onClose={() => {
            setMoodOpen(false);
            setMoodTarget(null);
          }}
          onSaved={() => {
            setMoodOpen(false);
            setMoodTarget(null);
            qc.invalidateQueries({ queryKey: qk.petAgenda(id, filter) });
          }}
        />
      ) : null}
    </View>
  );
}

// ============================================================================
// Chip de atalho usado no header (Galeria, Custos, Cuidadores)
// ============================================================================
function ShortcutChip({
  href,
  emoji,
  label,
  tint,
  tintText,
}: {
  href: string;
  emoji: string;
  label: string;
  tint: string;
  tintText: string;
}) {
  return (
    <Link href={href as never} asChild>
      <PressScale
        style={{
          flex: 1,
          backgroundColor: tint,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 8,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 5,
        }}
      >
        <Text style={{ fontSize: 14 }}>{emoji}</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 12,
            color: tintText,
          }}
        >
          {label}
        </Text>
      </PressScale>
    </Link>
  );
}
