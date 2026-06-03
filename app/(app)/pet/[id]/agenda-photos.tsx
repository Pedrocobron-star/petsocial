import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { EVENT_KIND_META } from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import { fetchPet, fetchPetEventLogs, fetchPetEvents, qk } from '@/lib/queries';
import type { PetEventKind } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

const KIND_FILTERS: { value: PetEventKind | 'all'; emoji: string; label: string }[] = [
  { value: 'all', emoji: '✨', label: 'Tudo' },
  { value: 'bath', emoji: '🛁', label: 'Banhos' },
  { value: 'grooming', emoji: '✂️', label: 'Tosas' },
  { value: 'school', emoji: '🎓', label: 'Escolinha' },
  { value: 'walk', emoji: '🚶', label: 'Passeios' },
  { value: 'vet_visit', emoji: '🩺', label: 'Vet' },
  { value: 'training', emoji: '🏆', label: 'Treino' },
  { value: 'playdate', emoji: '🎾', label: 'Encontros' },
  { value: 'nail_trim', emoji: '💅', label: 'Unhas' },
];

interface Photo {
  url: string;
  date: string;
  mood: number | null;
  kind: PetEventKind;
  title: string;
}

const MOOD_EMOJI: Record<number, string> = {
  1: '😢',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '🤩',
};

/**
 * Galeria de fotos dos eventos concluídos, filtrada por categoria.
 * Differential: "Todos os banhos do Rex em 2026" → linha do tempo visual.
 */
export default function AgendaPhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const eventsQuery = useQuery({
    queryKey: qk.petEvents(id),
    queryFn: () => fetchPetEvents(id),
    enabled: !!id,
  });
  const logsQuery = useQuery({
    queryKey: qk.petEventLogs(id),
    queryFn: () => fetchPetEventLogs(id, 500),
    enabled: !!id,
  });

  const [filter, setFilter] = useState<PetEventKind | 'all'>('all');
  const [viewerOpen, setViewerOpen] = useState<Photo | null>(null);

  // Mapeia event_id → kind+title pra associar logs com kind
  const eventInfo = useMemo(() => {
    const map = new Map<string, { kind: PetEventKind; title: string }>();
    for (const e of eventsQuery.data ?? []) {
      map.set(e.id, { kind: e.kind, title: e.title });
    }
    return map;
  }, [eventsQuery.data]);

  const photos: Photo[] = useMemo(() => {
    const list: Photo[] = [];
    for (const log of logsQuery.data ?? []) {
      if (!log.photo_url) continue;
      const info = eventInfo.get(log.event_id);
      if (!info) continue;
      list.push({
        url: log.photo_url,
        date: log.occurrence_date,
        mood: log.mood,
        kind: info.kind,
        title: info.title,
      });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [logsQuery.data, eventInfo]);

  const filteredPhotos = useMemo(() => {
    if (filter === 'all') return photos;
    return photos.filter((p) => p.kind === filter);
  }, [photos, filter]);

  // Count por categoria pra mostrar nas chips
  const counts = useMemo(() => {
    const m = new Map<PetEventKind | 'all', number>();
    m.set('all', photos.length);
    for (const p of photos) m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
    return m;
  }, [photos]);

  // Layout do grid: 3 colunas dentro do MAX_FEED_WIDTH
  const SCREEN_W = Dimensions.get('window').width;
  const gridWidth = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);
  const tileSize = (gridWidth - 8) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Galeria · ${petQuery.data.name}` : 'Galeria',
        }}
      />

      <FlatList
        data={filteredPhotos}
        keyExtractor={(p) => `${p.url}:${p.date}`}
        numColumns={3}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        columnWrapperStyle={{
          width: gridWidth,
          alignSelf: 'center',
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setViewerOpen(item)}
            style={{
              width: tileSize,
              height: tileSize,
              margin: 1,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: theme.borderLight,
            }}
          >
            <Image
              source={{ uri: item.url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
            {item.mood ? (
              <View
                style={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 999,
                  width: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 11 }}>{MOOD_EMOJI[item.mood]}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ListHeaderComponent={
          <View>
            <CenteredColumn maxWidth={540}>
              <View style={{ paddingVertical: 12 }}>
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 24,
                    color: theme.text,
                    letterSpacing: -0.5,
                  }}
                >
                  Diário visual 📸
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    marginTop: 2,
                  }}
                >
                  Cada banho, escolinha e passeio guardado pra sempre
                </Text>
              </View>
            </CenteredColumn>

            {/* Chips de filtro */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 14,
                gap: 6,
                paddingBottom: 12,
              }}
            >
              {KIND_FILTERS.map((f) => {
                const count = counts.get(f.value) ?? 0;
                if (f.value !== 'all' && count === 0) return null;
                const active = filter === f.value;
                return (
                  <PressScale
                    key={f.value}
                    onPress={() => setFilter(f.value)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: active ? theme.brand : theme.borderLight,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{f.emoji}</Text>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 12,
                        color: active ? '#fff' : theme.textMuted,
                      }}
                    >
                      {f.label}
                    </Text>
                    {count > 0 ? (
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 999,
                          backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.surface,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 10,
                            color: active ? '#fff' : theme.textMuted,
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                    ) : null}
                  </PressScale>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          logsQuery.isLoading ? null : (
            <EmptyState
              emoji="📸"
              title={filter === 'all' ? 'Ainda sem fotos' : 'Nenhuma foto dessa categoria'}
              description="Toda vez que você marcar um evento como feito, pode anexar uma foto pra eternizar 🐾"
            />
          )
        }
      />

      {/* Viewer fullscreen */}
      <Modal
        visible={!!viewerOpen}
        transparent
        animationType="none"
        onRequestClose={() => setViewerOpen(null)}
      >
        {viewerOpen ? (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.95)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Pressable
              onPress={() => setViewerOpen(null)}
              style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
              hitSlop={20}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </View>
            </Pressable>
            <Pressable
              onPress={() => setViewerOpen(null)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}
            >
              <Animated.View entering={ZoomIn.duration(250)} style={{ width: '92%' }}>
                <Image
                  source={{ uri: viewerOpen.url }}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }}
                  contentFit="contain"
                />
              </Animated.View>
            </Pressable>
            {/* Metadata footer */}
            <View
              style={{
                position: 'absolute',
                bottom: 40,
                left: 20,
                right: 20,
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: 14,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: EVENT_KIND_META[viewerOpen.kind].tint.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>
                  {EVENT_KIND_META[viewerOpen.kind].emoji}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}
                  numberOfLines={1}
                >
                  {viewerOpen.title}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: '#D4D4D4',
                    marginTop: 1,
                  }}
                >
                  {format(parseISO(viewerOpen.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </Text>
              </View>
              {viewerOpen.mood ? (
                <Text style={{ fontSize: 26 }}>{MOOD_EMOJI[viewerOpen.mood]}</Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </Modal>
    </View>
  );
}
