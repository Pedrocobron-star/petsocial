import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PetAvatar } from '@/components/pet-avatar';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { fetchPetDocuments } from '@/lib/documents';
import { FONTS } from '@/lib/fonts';
import {
  buildMonthlyRecap,
  isAfter,
  monthLabel,
  recapShareText,
  recapVibe,
  shiftMonth,
} from '@/lib/monthly-recap';
import { fetchHealthTimeline, fetchPet, qk } from '@/lib/queries';
import { petUrl, sharePost } from '@/lib/share';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function PetRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const toast = useToast();

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const today = { year: now.getFullYear(), month: now.getMonth() };

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const timelineQuery = useQuery({
    queryKey: ['health-timeline-full', id],
    queryFn: () => fetchHealthTimeline(id, 400),
    enabled: !!id,
  });
  const docsQuery = useQuery({
    queryKey: ['pet-documents', id],
    queryFn: () => fetchPetDocuments(id),
    enabled: !!id,
  });

  const pet = petQuery.data;
  const recap = useMemo(
    () =>
      buildMonthlyRecap(
        timelineQuery.data ?? [],
        docsQuery.data ?? [],
        cursor.year,
        cursor.month,
      ),
    [timelineQuery.data, docsQuery.data, cursor],
  );

  const canGoNext = isAfter(today, cursor); // só avança se cursor < hoje
  const loading = timelineQuery.isLoading || docsQuery.isLoading || !pet;

  const onShare = async () => {
    if (!pet) return;
    await sharePost({
      title: `${recap.monthShort} do ${pet.name}`,
      message: recapShareText(recap, pet.name),
      url: petUrl(pet.id),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1410' }}>
      <Stack.Screen
        options={{ title: '', headerTransparent: true, headerTintColor: '#fff' }}
      />
      <ScrollView contentContainerStyle={{ paddingTop: 64, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={540}>
          {/* Navegador de mês */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              paddingHorizontal: 20,
            }}
          >
            <Pressable
              hitSlop={10}
              onPress={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
              style={{ padding: 6 }}
            >
              <Ionicons name="chevron-back" size={22} color="#F59E0B" />
            </Pressable>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff', minWidth: 150, textAlign: 'center' }}>
              {monthLabel(cursor.year, cursor.month)}
            </Text>
            <Pressable
              hitSlop={10}
              disabled={!canGoNext}
              onPress={() => canGoNext && setCursor((c) => shiftMonth(c.year, c.month, 1))}
              style={{ padding: 6, opacity: canGoNext ? 1 : 0.25 }}
            >
              <Ionicons name="chevron-forward" size={22} color="#F59E0B" />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#F59E0B" style={{ marginTop: 60 }} />
          ) : (
            <Animated.View entering={FadeIn.duration(300)} key={`${cursor.year}-${cursor.month}`}>
              {/* Hero */}
              <View style={{ alignItems: 'center', paddingHorizontal: 20, gap: 12, marginTop: 18 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    letterSpacing: 2,
                    color: '#F59E0B',
                    textTransform: 'uppercase',
                  }}
                >
                  📅 Resumo do mês
                </Text>
                <Text style={{ fontFamily: FONTS.display, fontSize: 30, color: '#fff', textAlign: 'center' }}>
                  {recap.monthShort} do{'\n'}
                  <Text style={{ color: '#F59E0B' }}>{pet.name}</Text>
                </Text>
                <PetAvatar pet={pet} size={104} ring animation="float" />
                <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#D4D4D4', textAlign: 'center' }}>
                  {recapVibe(recap, pet.name)}
                </Text>
              </View>

              {recap.isEmpty ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 32, marginTop: 36, gap: 8 }}>
                  <Text style={{ fontSize: 40 }}>🌿</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff', textAlign: 'center' }}>
                    Nada registrado em {recap.monthShort}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#A3A3A3', textAlign: 'center', lineHeight: 19 }}>
                    Quando você anotar vacinas, consultas, peso ou subir um exame, o resumo do mês aparece aqui.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Stat cards */}
                  <View
                    style={{
                      marginTop: 28,
                      paddingHorizontal: 20,
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 10,
                      justifyContent: 'center',
                    }}
                  >
                    {recap.stats.map((s) => (
                      <View
                        key={s.key}
                        style={{
                          width: '47%',
                          backgroundColor: s.bg,
                          borderRadius: 16,
                          padding: 16,
                          gap: 4,
                        }}
                      >
                        <Text style={{ fontSize: 26 }}>{s.emoji}</Text>
                        <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: s.color }}>
                          {s.count}
                        </Text>
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: s.color, opacity: 0.85 }}>
                          {s.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Timeline do mês */}
                  <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 11,
                        letterSpacing: 1.4,
                        color: '#A3A3A3',
                        textTransform: 'uppercase',
                        marginBottom: 12,
                      }}
                    >
                      O que rolou
                    </Text>
                    <View style={{ gap: 10 }}>
                      {recap.events.map((e, i) => (
                        <View key={`${e.kind}-${e.source_id}-${i}`} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                          <View
                            style={{
                              width: 44,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#F59E0B' }}>
                              {format(parseISO(e.date), 'd', { locale: ptBR })}
                            </Text>
                            <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: '#737373', textTransform: 'uppercase' }}>
                              {format(parseISO(e.date), 'MMM', { locale: ptBR })}
                            </Text>
                          </View>
                          <View
                            style={{
                              flex: 1,
                              backgroundColor: '#2A2018',
                              borderRadius: 12,
                              padding: 12,
                            }}
                          >
                            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }} numberOfLines={1}>
                              {e.title}
                            </Text>
                            {e.detail ? (
                              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3', marginTop: 1 }} numberOfLines={1}>
                                {e.detail}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Share */}
                  <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
                    <PressScale
                      onPress={onShare}
                      style={{
                        backgroundColor: '#F59E0B',
                        paddingVertical: 15,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Ionicons name="share-social" size={18} color="#1A1410" />
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#1A1410' }}>
                        Compartilhar o mês
                      </Text>
                    </PressScale>
                  </View>
                </>
              )}
            </Animated.View>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}
