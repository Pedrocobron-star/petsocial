import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import {
  fetchActiveOffers,
  offerCategoryMeta,
  trackOfferClick,
  type Offer,
  type OfferCategory,
} from '@/lib/offers';
import { copyToClipboard } from '@/lib/share';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function OffersScreen() {
  return (
    <AppThemeProvider app="offers">
      <OffersInner />
    </AppThemeProvider>
  );
}

function OffersInner() {
  const { theme } = useTheme();
  const [cat, setCat] = useState<OfferCategory | 'all'>('all');

  const query = useQuery({ queryKey: ['active-offers'], queryFn: fetchActiveOffers });
  const all = query.data ?? [];
  const offers = cat === 'all' ? all : all.filter((o) => o.category === cat);

  // categorias que de fato têm oferta (pra não mostrar filtro vazio)
  const availableCats = Array.from(new Set(all.map((o) => o.category)));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Vantagens', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={560}>
          <AreaHero area="offers" />

          {/* Filtros por categoria */}
          {availableCats.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 14 }}
            >
              <CatChip label="Tudo" active={cat === 'all'} onPress={() => setCat('all')} />
              {availableCats.map((c) => {
                const m = offerCategoryMeta(c);
                return (
                  <CatChip
                    key={c}
                    label={`${m.emoji} ${m.label}`}
                    active={cat === c}
                    onPress={() => setCat(c)}
                  />
                );
              })}
            </ScrollView>
          ) : null}

          {query.isLoading ? (
            <ActivityIndicator color={theme.accent.color} style={{ marginTop: 30 }} />
          ) : offers.length === 0 ? (
            <EmptyState
              emoji="🎁"
              title="Nenhuma oferta no momento"
              description="Estamos fechando parcerias com marcas e petshops. Volte em breve pra economizar com seu pet!"
            />
          ) : (
            <View style={{ gap: 12 }}>
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </View>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function CatChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? theme.accent.color : theme.borderLight,
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: active ? theme.accent.onAccent : theme.textDim }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 'YYYY-MM-DD...' -> 'DD/MM' (ou null). Pra dar urgência ao cupom. */
function validUntilLabel(s: string | null): string | null {
  if (!s) return null;
  const parts = s.slice(0, 10).split('-');
  if (parts.length !== 3) return null;
  return `${parts[2]}/${parts[1]}`;
}

function OfferCard({ offer }: { offer: Offer }) {
  const { theme } = useTheme();
  const toast = useToast();
  const meta = offerCategoryMeta(offer.category);
  const validLabel = validUntilLabel(offer.valid_until);

  const onCopy = async () => {
    if (!offer.coupon_code) return;
    const ok = await copyToClipboard(offer.coupon_code);
    if (ok) {
      toast.success('Cupom copiado!', offer.coupon_code);
      // Sinal de conversão: cai no painel admin (top events). Sem PII.
      track('offer_coupon_copied', { offer_id: offer.id, brand: offer.brand });
    }
  };

  const onGo = async () => {
    trackOfferClick(offer.id);
    try {
      await Linking.openURL(offer.cta_url);
    } catch {
      toast.error('Não foi possível abrir o link');
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.borderLight,
        overflow: 'hidden',
      }}
    >
      {offer.image_url ? (
        <Image source={{ uri: offer.image_url }} style={{ width: '100%', height: 130 }} contentFit="cover" />
      ) : null}

      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>{offer.brand}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
            {meta.emoji} {meta.label}
          </Text>
          {offer.discount_label ? (
            <View
              style={{
                marginLeft: 'auto',
                backgroundColor: '#16A34A',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' }}>
                {offer.discount_label}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text }}>{offer.title}</Text>

        {offer.description ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, lineHeight: 19 }}>
            {offer.description}
          </Text>
        ) : null}

        {/* Cupom */}
        {offer.coupon_code ? (
          <Pressable
            onPress={onCopy}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.borderLight,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: theme.border,
              borderStyle: 'dashed',
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Ionicons name="pricetag" size={15} color={theme.accent.color} />
            <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text, letterSpacing: 1 }}>
              {offer.coupon_code}
            </Text>
            <Ionicons name="copy-outline" size={16} color={theme.textDim} />
          </Pressable>
        ) : null}

        <PressScale
          onPress={onGo}
          style={{
            backgroundColor: theme.accent.color,
            paddingVertical: 12,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 2,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.accent.onAccent }}>{offer.cta_label}</Text>
          <Ionicons name="arrow-forward" size={16} color={theme.accent.onAccent} />
        </PressScale>

        {validLabel ? (
          <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 11, color: theme.textDim, textAlign: 'center' }}>
            ⏳ Válido até {validLabel}
          </Text>
        ) : null}

        <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim, textAlign: 'center' }}>
          Oferta do parceiro {offer.brand} · Maestro Pet não se responsabiliza pela compra
        </Text>
      </View>
    </View>
  );
}
