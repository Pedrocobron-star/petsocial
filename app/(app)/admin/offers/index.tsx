import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Redirect, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { adminListOffers, offerCategoryMeta, type Offer } from '@/lib/offers';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminOffersListScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const isAdmin = !!session && session.user.email === ADMIN_EMAIL;

  const query = useQuery({
    queryKey: ['admin-offers-list'],
    queryFn: adminListOffers,
    refetchOnMount: 'always',
    enabled: isAdmin,
  });
  const offers = query.data ?? [];

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Ofertas · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}>
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
          <Ionicons name="pricetags" size={22} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#FFFFFF' }}>
              Clube de vantagens
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              {offers.length} {offers.length === 1 ? 'oferta' : 'ofertas'}
            </Text>
          </View>
          <Link href="/(app)/admin/offers/new" asChild>
            <Pressable
              style={{
                backgroundColor: '#F59E0B',
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="add" size={16} color="#1A1410" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#1A1410' }}>Nova</Text>
            </Pressable>
          </Link>
        </View>

        {query.isLoading ? <ActivityIndicator color={theme.brand} style={{ padding: 30 }} /> : null}

        {query.isError ? (
          <View style={{ backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, gap: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#991B1B' }}>
              Erro ao carregar
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
              {query.error instanceof Error ? query.error.message : 'Verifique se rodou supabase/offers.sql'}
            </Text>
          </View>
        ) : null}

        {offers.length === 0 && !query.isLoading ? (
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
            <Text style={{ fontSize: 38 }}>🎁</Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: theme.text }}>
              Nenhuma oferta ainda
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center' }}>
              Cadastre cupons e descontos dos patrocinadores. Aparecem na aba de vantagens dos usuários.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          {offers.map((o) => (
            <OfferRow key={o.id} offer={o} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const { theme } = useTheme();
  const meta = offerCategoryMeta(offer.category);
  // Ativa porém vencida = sumiu pros usuários (fetchActiveOffers filtra valid_until),
  // mas o admin acha que está no ar. Sinaliza pra não enganar.
  const today = new Date().toISOString().slice(0, 10);
  const expired = !!offer.valid_until && offer.valid_until < today;

  return (
    <Link href={{ pathname: '/(app)/admin/offers/[id]', params: { id: offer.id } }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 12,
          gap: 6,
          borderWidth: 1,
          borderColor: theme.borderLight,
          opacity: offer.active && !expired ? 1 : 0.55,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textDim }}>
            {meta.emoji} {meta.label}
          </Text>
          {offer.discount_label ? (
            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#92400E' }}>
                {offer.discount_label}
              </Text>
            </View>
          ) : null}
          {!offer.active ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.textDim }}>· inativo</Text>
          ) : offer.active && expired ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#DC2626' }}>· vencida (não aparece)</Text>
          ) : null}
          <Text style={{ marginLeft: 'auto', fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
            {offer.clicks_count} cliques
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }} numberOfLines={1}>
          {offer.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }} numberOfLines={1}>
          {offer.brand}
          {offer.coupon_code ? ` · cupom ${offer.coupon_code}` : ''}
        </Text>
      </Pressable>
    </Link>
  );
}
