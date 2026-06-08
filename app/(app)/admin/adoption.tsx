import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';

import {
  adminApproveAdoption,
  adminDeleteAdoption,
  adminListAdoptionForReview,
  listingChips,
  REVIEW_REASON_LABEL,
  SPECIES_META,
  type AdoptionListing,
} from '@/lib/adoption';
import { FONTS } from '@/lib/fonts';
import { useToast } from '@/providers/toast-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';
const QKEY = ['admin-adoption-review'];

export default function AdminAdoptionScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: QKEY,
    queryFn: adminListAdoptionForReview,
    refetchOnMount: 'always',
    enabled: isAdmin,
  });
  const listings = query.data ?? [];

  const [busyId, setBusyId] = useState<string | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const approve = async (l: AdoptionListing) => {
    setBusyId(l.id);
    try {
      await adminApproveAdoption(l.id);
      await qc.invalidateQueries({ queryKey: QKEY });
      toast.success('Aprovado');
    } catch (e) {
      toast.error('Erro ao aprovar', e instanceof Error ? e.message : 'Tente de novo');
    } finally {
      setBusyId(null);
    }
  };

  const remove = (l: AdoptionListing) => {
    Alert.alert('Remover anúncio?', `"${l.pet_name}" some do mural. Não pode desfazer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setBusyId(l.id);
          try {
            await adminDeleteAdoption(l.id, l.pet_name);
            await qc.invalidateQueries({ queryKey: QKEY });
            toast.success('Removido');
          } catch (e) {
            toast.error('Erro ao remover', e instanceof Error ? e.message : 'Tente de novo');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Adoção · Moderação', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="heart" size={22} color="#F472B6" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>
              Moderação de adoção
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {listings.length} {listings.length === 1 ? 'anúncio sinalizado' : 'anúncios sinalizados'}
            </Text>
          </View>
        </View>

        <View style={{ backgroundColor: '#FCE7F3', borderRadius: 12, padding: 12, gap: 4 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#9D174D' }}>
            Como funciona
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#9F1239', lineHeight: 16 }}>
            Anúncios com link externo, descrição muito curta ou indício de venda entram aqui
            automaticamente — mas continuam visíveis no mural. Aprove os legítimos (some o flag) ou
            remova os que violam as regras.
          </Text>
        </View>

        {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}

        {query.isError ? (
          <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
              Erro ao carregar
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error
                ? query.error.message
                : 'Verifique se rodou supabase/adoption-moderation.sql'}
            </Text>
          </View>
        ) : null}

        {listings.length === 0 && !query.isLoading && !query.isError ? (
          <View
            style={{
              backgroundColor: theme.surface,
              padding: 24,
              borderRadius: 14,
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.borderLight,
            }}
          >
            <Text style={{ fontSize: 38 }}>✅</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
              Fila limpa
            </Text>
            <Text
              style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center' }}
            >
              Nenhum anúncio aguardando revisão. Tudo certo no mural de adoção.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 10 }}>
          {listings.map((l) => (
            <ReviewRow
              key={l.id}
              listing={l}
              busy={busyId === l.id}
              onApprove={() => approve(l)}
              onRemove={() => remove(l)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ReviewRow({
  listing,
  busy,
  onApprove,
  onRemove,
}: {
  listing: AdoptionListing;
  busy: boolean;
  onApprove: () => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const photo = listing.image_urls[0];
  const reasonLabel = listing.review_reason
    ? REVIEW_REASON_LABEL[listing.review_reason] ?? listing.review_reason
    : 'Sinalizado';

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: theme.bg }}
          />
        ) : (
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              backgroundColor: '#FCE7F3',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 26 }}>{SPECIES_META[listing.species].emoji}</Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={1}>
            {listing.pet_name}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
            {listingChips(listing).join(' · ')}
            {listing.city ? ` · ${listing.city}${listing.uf ? `/${listing.uf}` : ''}` : ''}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
            {format(parseISO(listing.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
          </Text>
        </View>
      </View>

      {/* Motivo do flag */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#FEF3C7',
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}
      >
        <Ionicons name="flag" size={13} color="#92400E" />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#92400E', flex: 1 }}>
          {reasonLabel}
        </Text>
      </View>

      {/* Descrição */}
      <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.text, lineHeight: 17 }} numberOfLines={4}>
        {listing.description}
      </Text>

      {listing.contact_phone || listing.contact_name ? (
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
          Contato: {listing.contact_name ?? '—'}
          {listing.contact_phone ? ` · ${listing.contact_phone}` : ''}
        </Text>
      ) : null}

      {/* Ações */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onApprove}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: '#DCFCE7',
            borderRadius: 10,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Ionicons name="checkmark-circle" size={16} color="#166534" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#166534' }}>Aprovar</Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          disabled={busy}
          style={{
            flex: 1,
            backgroundColor: '#FEE2E2',
            borderRadius: 10,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Ionicons name="trash" size={16} color="#991B1B" />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>Remover</Text>
        </Pressable>
      </View>
    </View>
  );
}
