import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, differenceInHours, format, formatDistanceToNow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { LostReportShareButton } from '@/components/lost-found/lost-report-share-button';
import { MediaCarousel } from '@/components/media-carousel';
import { PetAvatar } from '@/components/pet-avatar';
import { ReportModal } from '@/components/report-modal';
import { Button } from '@/components/ui/button';
import { speciesEmoji, speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import {
  deleteLostReport,
  fetchLostReport,
  qk,
  resolveLostReport,
} from '@/lib/queries';
import type { PostMedia } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LostReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useSession();
  const { theme } = useTheme();
  const [reportOpen, setReportOpen] = useState(false);

  const query = useQuery({
    queryKey: qk.lostReport(id),
    queryFn: () => fetchLostReport(id),
    enabled: !!id,
  });

  const resolveMutation = useMutation({
    mutationFn: () => resolveLostReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.lostReport(id) });
      qc.invalidateQueries({ queryKey: ['lost-reports'] });
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLostReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lost-reports'] });
      router.back();
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const r = query.data;

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Carregando…' }} />
        <ActivityIndicator size="large" color={theme.brand} />
      </View>
    );
  }
  if (query.isError || !r) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 10,
          backgroundColor: theme.bg,
        }}
      >
        <Stack.Screen options={{ title: 'Não encontrado' }} />
        <Text style={{ fontSize: 52 }}>🐾</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
          Reporte não encontrado
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 13,
            color: theme.textDim,
            textAlign: 'center',
            lineHeight: 19,
          }}
        >
          Esse anúncio pode ter sido resolvido, removido, ou o link está quebrado.
        </Text>
        <Button title="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const isOwner = session?.user.id === r.reporter_user_id;
  // Mídias do reporte: fotos primeiro (image_urls, com fallback pro photo_url antigo),
  // depois o vídeo no fim. Avatar/emoji só entram quando não há NENHUMA mídia.
  const photoUrls =
    r.image_urls && r.image_urls.length > 0
      ? r.image_urls
      : r.photo_url
        ? [r.photo_url]
        : [];
  const carouselMedia: PostMedia[] = [
    ...photoUrls.map((url, i) => ({
      id: `img-${i}`,
      post_id: r.id,
      url,
      media_type: 'image' as const,
      position: i,
      created_at: r.created_at,
    })),
    ...(r.video_url
      ? [
          {
            id: 'video',
            post_id: r.id,
            url: r.video_url,
            media_type: 'video' as const,
            position: photoUrls.length,
            created_at: r.created_at,
          },
        ]
      : []),
  ];
  const hasMedia = carouselMedia.length > 0;
  const carouselWidth = Math.min(SCREEN_W, 560);
  const linkedPet = r.pet;
  const displayName = r.pet?.name ?? r.pet_name ?? 'Sem nome';
  const displaySpecies = r.pet?.species ?? r.species;
  const displayBreed = r.pet?.breed ?? r.breed;

  const kindLabel = r.kind === 'lost' ? 'Pet perdido' : 'Pet encontrado';
  const kindColor = r.kind === 'lost' ? '#991B1B' : '#15803d';
  const kindBg = r.kind === 'lost' ? '#FEE2E2' : '#DCFCE7';

  const openMaps = () => {
    const q = encodeURIComponent(r.last_seen_location);
    const url = Platform.select({
      ios: `https://maps.apple.com/?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
    });
  };

  const callContact = () => {
    const contact = r.contact_info.trim();
    if (contact.includes('@')) {
      Linking.openURL(`mailto:${contact}`);
    } else {
      const clean = contact.replace(/[^0-9+]/g, '');
      Linking.openURL(`tel:${clean}`);
    }
  };

  const showOwnerMenu = () => {
    Alert.alert('Opções do reporte', undefined, [
      r.status === 'open'
        ? {
            text: 'Marcar como resolvido',
            onPress: () => resolveMutation.mutate(),
          }
        : null,
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir reporte?', 'Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate() },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ].filter(Boolean) as { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[]);
  };

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.bg }} contentContainerClassName="pb-12">
      <Stack.Screen
        options={{
          title: kindLabel,
          headerRight: isOwner
            ? () => (
                <Pressable hitSlop={10} onPress={showOwnerMenu} className="pr-2">
                  <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={{ alignItems: 'center', backgroundColor: theme.surface }}>
        {hasMedia ? (
          <MediaCarousel media={carouselMedia} width={carouselWidth} />
        ) : linkedPet ? (
          <View
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              backgroundColor: '#FED7AA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PetAvatar pet={linkedPet} size={220} />
          </View>
        ) : (
          <View
            style={{
              width: '100%',
              aspectRatio: 4 / 3,
              backgroundColor: '#FED7AA',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 100 }}>
              {displaySpecies ? speciesEmoji(displaySpecies) : '🐾'}
            </Text>
          </View>
        )}
      </View>

      {/* Banner urgente — só lost + open */}
      {r.kind === 'lost' && r.status === 'open' ? (
        <UrgencyBanner createdAt={r.created_at} petName={displayName} />
      ) : null}

      <View className="px-4 py-4" style={{ backgroundColor: theme.surface }}>
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <View style={{ backgroundColor: kindBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: kindColor }}>
              {kindLabel.toUpperCase()}
            </Text>
          </View>
          {r.status === 'resolved' ? (
            <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#075985' }}>
                RESOLVIDO 🎉
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: theme.text }}>{displayName}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.textMuted, marginTop: 4 }}>
          {displaySpecies ? speciesLabel(displaySpecies) : 'Espécie não informada'}
          {displayBreed ? ` • ${displayBreed}` : ''}
          {r.color ? ` • ${r.color}` : ''}
        </Text>

        <Pressable onPress={openMaps} className="mt-3 flex-row items-center gap-1.5 self-start active:opacity-70">
          <Ionicons name="location-outline" size={18} color={theme.brand} />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.brandDark }}>
            {r.last_seen_location}
          </Text>
          <Ionicons name="open-outline" size={14} color={theme.brandDark} />
        </Pressable>

        {/* Botão de compartilhar — CTA principal pra viralizar (só se open) */}
        {r.status === 'open' ? (
          <View style={{ marginTop: 16 }}>
            <LostReportShareButton report={r} />
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              Gera um cartaz pronto pra postar no WhatsApp, Instagram e redes.
            </Text>
          </View>
        ) : null}

        {r.last_seen_at ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            <Ionicons name="time-outline" size={16} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textMuted }}>
              Visto em{' '}
              {format(parseISO(r.last_seen_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}
            </Text>
          </View>
        ) : null}

        {r.description ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: theme.text, marginTop: 12 }}>
            {r.description}
          </Text>
        ) : null}

        <View
          style={{
            marginTop: 16,
            padding: 14,
            backgroundColor: theme.brandSurface,
            borderRadius: 14,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brandDark, marginBottom: 6 }}>
            Achou ou viu? Entre em contato:
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: theme.text, marginBottom: 10 }}>
            {r.contact_info}
          </Text>
          <Button
            title={r.contact_info.includes('@') ? 'Mandar email' : 'Ligar / WhatsApp'}
            onPress={callContact}
            fullWidth
          />
        </View>

        {/* CTA secundário: viu o pet mas quer reportar publicamente (avistamento) */}
        {r.kind === 'lost' && r.status === 'open' ? (
          <Pressable
            onPress={() => {
              const params = new URLSearchParams({
                kind: 'found',
                ...(displaySpecies ? { species: displaySpecies } : {}),
                ...(displayBreed ? { breed: displayBreed } : {}),
                ...(r.color ? { color: r.color } : {}),
              });
              router.push(`/(app)/lost-found/report?${params.toString()}` as never);
            }}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#FBBF24',
              backgroundColor: '#FFFBEB',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="eye-outline" size={20} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#7C2D12' }}>
                Viu esse pet em outro lugar?
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#9A3412', marginTop: 2 }}>
                Reporte como avistamento — pode ajudar a achar.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#92400E" />
          </Pressable>
        ) : null}

        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 12 }}>
          Reportado {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true, locale: ptBR })}
        </Text>

        {/* Denunciar (não-dono, logado) — moderação reativa do Achados */}
        {session && !isOwner ? (
          <Pressable
            onPress={() => setReportOpen(true)}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 14 }}
          >
            <Ionicons name="flag-outline" size={15} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: theme.textDim }}>
              Denunciar este reporte
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetKind="lost_report"
        targetId={r.id}
      />
    </ScrollView>
  );
}

// ============================================================================
// UrgencyBanner — banner pulsante vermelho com tempo procurando
// ============================================================================

function formatTimeSearching(createdAt: string): { value: number; unit: string; emphasis: 'high' | 'medium' | 'low' } {
  const created = parseISO(createdAt);
  const days = differenceInDays(new Date(), created);
  if (days >= 1) {
    return {
      value: days,
      unit: days === 1 ? 'dia' : 'dias',
      // Quanto mais tempo, mais urgente visualmente
      emphasis: days >= 7 ? 'high' : days >= 3 ? 'medium' : 'low',
    };
  }
  const hours = Math.max(1, differenceInHours(new Date(), created));
  return {
    value: hours,
    unit: hours === 1 ? 'hora' : 'horas',
    emphasis: hours >= 12 ? 'medium' : 'low',
  };
}

function UrgencyBanner({ createdAt, petName }: { createdAt: string; petName: string }) {
  const { value, unit, emphasis } = formatTimeSearching(createdAt);
  // Pulse animation na bolinha lateral
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.3, {
        duration: 900,
        easing: Easing.inOut(Easing.sin),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
      undefined,
      ReduceMotion.Never,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 1 / pulse.value,
  }));

  const bg = emphasis === 'high' ? '#DC2626' : emphasis === 'medium' ? '#EA580C' : '#F97316';
  const darkBg = emphasis === 'high' ? '#7F1D1D' : emphasis === 'medium' ? '#9A3412' : '#9A3412';

  return (
    <View
      style={{
        backgroundColor: bg,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            pulseStyle,
            {
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#FFFFFF',
              opacity: 0.4,
            },
          ]}
        />
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: '#FFFFFF',
          }}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            color: darkBg,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
          }}
        >
          Ainda procurando
        </Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
          {petName} sumiu há{' '}
          <Text style={{ fontFamily: FONTS.display }}>
            {value} {unit}
          </Text>
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 12,
            color: '#FFFFFF',
            opacity: 0.9,
            marginTop: 2,
          }}
        >
          Compartilhe — quanto mais gente vê, mais chance de achar.
        </Text>
      </View>
    </View>
  );
}
