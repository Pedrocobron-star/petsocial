import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { MediaCarousel } from '@/components/media-carousel';
import { ReportModal } from '@/components/report-modal';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import {
  deleteAdoptionListing,
  fetchAdoptionListing,
  listingChips,
  setAdoptionStatus,
  SPECIES_META,
} from '@/lib/adoption';
import { FONTS } from '@/lib/fonts';
import { sharePost } from '@/lib/share';
import type { PostMedia } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const { width: SCREEN_W } = Dimensions.get('window');

export default function AdoptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { session } = useSession();
  const [reportOpen, setReportOpen] = useState(false);

  const query = useQuery({
    queryKey: ['adoption-listing', id],
    queryFn: () => fetchAdoptionListing(id),
    enabled: !!id,
  });
  const listing = query.data;
  const isOwner = !!session && !!listing && session.user.id === listing.owner_id;

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['adoption-listings'] }),
      qc.invalidateQueries({ queryKey: ['adoption-listing', id] }),
    ]);

  const onWhatsApp = async () => {
    if (!listing?.contact_phone) {
      toast.info('Sem contato', 'Quem anunciou não deixou telefone.');
      return;
    }
    const digits = listing.contact_phone.replace(/\D/g, '');
    const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
    const text = `Olá! Vi o anúncio do ${listing.pet_name} pra adoção no Maestro Pet e tenho interesse 🐾`;
    const url = `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
    try {
      await Linking.openURL(url);
    } catch {
      toast.error('Não foi possível abrir o WhatsApp');
    }
  };

  const onShare = async () => {
    if (!listing) return;
    const base =
      typeof globalThis !== 'undefined' && globalThis.location?.origin
        ? globalThis.location.origin
        : 'https://maestropet.com';
    await sharePost({
      title: `${listing.pet_name} pra adoção`,
      message: `🏠 ${listing.pet_name} está pra adoção no Maestro Pet! ${listing.city ? `📍 ${listing.city}` : ''}`,
      url: `${base}/adoption/${listing.id}`,
    });
  };

  const onToggleAdopted = async () => {
    if (!listing) return;
    const next = listing.status === 'adopted' ? 'available' : 'adopted';
    try {
      await setAdoptionStatus(listing.id, next);
      await invalidate();
      toast.success(next === 'adopted' ? 'Marcado como adotado! 🎉' : 'Voltou pra disponível');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : '');
    }
  };

  const onDelete = () => {
    if (!listing) return;
    Alert.alert('Apagar anúncio?', 'Não pode desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAdoptionListing(listing.id);
            await invalidate();
            toast.success('Anúncio removido');
            router.replace('/(app)/adoption' as never);
          } catch (e) {
            toast.error('Erro ao apagar', e instanceof Error ? e.message : '');
          }
        },
      },
    ]);
  };

  if (query.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ title: 'Adoção' }} />
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }
  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <Stack.Screen options={{ title: 'Adoção' }} />
        <Text style={{ fontSize: 40 }}>🐾</Text>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>Anúncio não encontrado</Text>
      </View>
    );
  }

  const chips = listingChips(listing);
  const imgW = Math.min(SCREEN_W, 560);
  // Monta as mídias do carrossel: fotos primeiro, vídeo (se houver) no fim.
  const carouselMedia: PostMedia[] = [
    ...listing.image_urls.map((url, i) => ({
      id: `img-${i}`,
      post_id: listing.id,
      url,
      media_type: 'image' as const,
      position: i,
      created_at: listing.created_at,
    })),
    ...(listing.video_url
      ? [
          {
            id: 'video',
            post_id: listing.id,
            url: listing.video_url,
            media_type: 'video' as const,
            position: listing.image_urls.length,
            created_at: listing.created_at,
          },
        ]
      : []),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: listing.pet_name,
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={onShare} hitSlop={8} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="share-social-outline" size={20} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {/* Fotos + vídeo */}
        {carouselMedia.length > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <MediaCarousel media={carouselMedia} width={imgW} />
          </View>
        ) : (
          <View style={{ width: '100%', height: 220, backgroundColor: theme.borderLight, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 72 }}>{SPECIES_META[listing.species].emoji}</Text>
          </View>
        )}

        <CenteredColumn maxWidth={560}>
          <View style={{ padding: 16, gap: 12 }}>
            {/* Nome + status */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 28, color: theme.text }}>{listing.pet_name}</Text>
              {listing.status === 'adopted' ? (
                <View style={{ backgroundColor: '#16A34A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff' }}>✓ Adotado</Text>
                </View>
              ) : null}
            </View>

            {/* Aviso de moderação (só o dono vê, enquanto pendente) */}
            {isOwner && !listing.approved ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  backgroundColor: '#FEF3C7',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#FDE68A',
                }}
              >
                <Ionicons name="time-outline" size={18} color="#92400E" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: '#92400E', lineHeight: 17 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold }}>Em análise. </Text>
                  Seu anúncio passa por uma revisão e entra no mural em até 24h após a aprovação. Por
                  enquanto só você está vendo ele.
                </Text>
              </View>
            ) : null}

            {/* Chips */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {chips.map((c, i) => (
                <View key={i} style={{ backgroundColor: theme.borderLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim }}>{c}</Text>
                </View>
              ))}
            </View>

            {/* Saúde + local */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {listing.vaccinated ? <Badge emoji="💉" label="Vacinado" /> : null}
              {listing.neutered ? <Badge emoji="✂️" label="Castrado" /> : null}
              {listing.city ? <Badge emoji="📍" label={`${listing.city}${listing.uf ? `/${listing.uf}` : ''}`} /> : null}
              {listing.breed ? <Badge emoji="🏷️" label={listing.breed} /> : null}
            </View>

            {/* Descrição */}
            <Text style={{ fontFamily: FONTS.body, fontSize: 15, color: theme.text, lineHeight: 22 }}>
              {listing.description}
            </Text>

            {listing.special_needs ? (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, gap: 4 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#92400E' }}>
                  Cuidados especiais
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#78350F' }}>
                  {listing.special_needs}
                </Text>
              </View>
            ) : null}

            {listing.contact_name ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
                Anunciado por {listing.contact_name}
              </Text>
            ) : null}

            {/* Controles do dono */}
            {isOwner ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <Pressable
                  onPress={onToggleAdopted}
                  style={{ flex: 1, backgroundColor: theme.borderLight, paddingVertical: 11, borderRadius: 10, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                    {listing.status === 'adopted' ? 'Marcar disponível' : 'Marcar adotado'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onDelete}
                  style={{ backgroundColor: '#FEE2E2', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center' }}
                >
                  <Ionicons name="trash-outline" size={16} color="#991B1B" />
                </Pressable>
              </View>
            ) : null}

            {/* Denunciar (não-dono, logado) — moderação reativa */}
            {!isOwner && session ? (
              <Pressable
                onPress={() => setReportOpen(true)}
                accessibilityRole="button"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 4 }}
              >
                <Ionicons name="flag-outline" size={15} color={theme.textDim} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: theme.textDim }}>
                  Denunciar este anúncio
                </Text>
              </Pressable>
            ) : null}
          </View>
        </CenteredColumn>
      </ScrollView>

      {/* CTA fixo WhatsApp (não-dono, disponível) */}
      {!isOwner && listing.status !== 'adopted' ? (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: theme.surface,
            borderTopWidth: 1,
            borderTopColor: theme.borderLight,
            padding: 14,
            paddingBottom: 24,
          }}
        >
          <CenteredColumn maxWidth={560}>
            <PressScale
              onPress={onWhatsApp}
              style={{
                backgroundColor: '#16A34A',
                paddingVertical: 15,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff' }}>
                Tenho interesse
              </Text>
            </PressScale>
          </CenteredColumn>
        </View>
      ) : null}

      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetKind="adoption_listing"
        targetId={listing.id}
      />
    </View>
  );
}

function Badge({ emoji, label }: { emoji: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
      }}
    >
      <Text style={{ fontSize: 13 }}>{emoji}</Text>
      <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.text }}>{label}</Text>
    </View>
  );
}
