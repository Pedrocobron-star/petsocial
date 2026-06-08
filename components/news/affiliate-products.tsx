import { Image } from 'expo-image';
import { Linking, Platform, Pressable, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import type { AffiliateProduct, AffiliateStore } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * Seção "🛍️ Onde comprar" — produtos afiliados de uma matéria.
 *
 * Transparência: SEMPRE exibe a linha de divulgação no rodapé (exigência legal
 * + boa prática). Cada produto abre o link externo do afiliado.
 */

const STORE_META: Record<AffiliateStore, { label: string; bg: string; fg: string }> = {
  shopee: { label: 'Shopee', bg: '#EE4D2D', fg: '#FFFFFF' },
  mercadolivre: { label: 'Mercado Livre', bg: '#FFE600', fg: '#2D3277' },
  amazon: { label: 'Amazon', bg: '#FF9900', fg: '#1A1410' },
  outro: { label: 'Loja', bg: '', fg: '#FFFFFF' }, // bg vem do theme.brand
};

function openUrl(url: string) {
  haptic.light();
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(url);
    }
  } catch {
    // ignora — URL inválida
  }
}

export function AffiliateProducts({
  products,
  articleSlug,
}: {
  products: AffiliateProduct[];
  /** slug da matéria — vai junto no evento de clique pra atribuir receita por matéria. */
  articleSlug?: string;
}) {
  const { theme } = useTheme();

  if (!products || products.length === 0) return null;

  return (
    <View
      style={{
        marginTop: 28,
        backgroundColor: theme.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.borderLight,
        padding: 16,
      }}
    >
      <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: theme.text, marginBottom: 4 }}>
        🛍️ Onde comprar
      </Text>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 12.5,
          color: theme.textDim,
          lineHeight: 18,
          marginBottom: 14,
        }}
      >
        Selecionamos opções pra facilitar sua compra.
      </Text>

      <View style={{ gap: 12 }}>
        {products.map((p, i) => (
          <ProductCard key={`${p.url}-${i}`} product={p} articleSlug={articleSlug} />
        ))}
      </View>

      {/* Disclosure de afiliado — obrigatório */}
      <View
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.borderLight,
        }}
      >
        <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: theme.textDim, lineHeight: 17 }}>
          Os links acima são afiliados — o Pet Social pode receber uma comissão, sem custo extra pra você.
        </Text>
      </View>
    </View>
  );
}

function ProductCard({ product, articleSlug }: { product: AffiliateProduct; articleSlug?: string }) {
  const { theme } = useTheme();
  const meta = STORE_META[product.store] ?? STORE_META.outro;
  const badgeBg = product.store === 'outro' ? theme.brand : meta.bg;
  const badgeFg = product.store === 'outro' ? theme.accent.onAccent : meta.fg;

  const onBuy = () => {
    // Atribuição de receita: loga loja + produto + matéria. Cai no painel admin
    // (top events) automaticamente. Sem PII.
    track('affiliate_click', {
      store: product.store,
      label: product.label,
      article: articleSlug ?? null,
    });
    openUrl(product.url);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.borderLight,
        overflow: 'hidden',
        alignItems: 'center',
        padding: 10,
        gap: 12,
      }}
    >
      {/* Imagem opcional */}
      {product.image_url ? (
        <Image
          source={{ uri: product.image_url }}
          style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: theme.brandSurface }}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            backgroundColor: theme.brandSurface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 26 }}>🛒</Text>
        </View>
      )}

      {/* Info */}
      <View style={{ flex: 1, gap: 5 }}>
        <Text
          style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: theme.text, lineHeight: 18 }}
          numberOfLines={2}
        >
          {product.label}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <View
            style={{
              backgroundColor: badgeBg,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: badgeFg }}>
              {meta.label}
            </Text>
          </View>
          {product.price ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.brand }}>
              {product.price}
            </Text>
          ) : null}
        </View>
      </View>

      {/* CTA Comprar */}
      <Pressable
        onPress={onBuy}
        accessibilityRole="link"
        accessibilityLabel={`Comprar ${product.label} na ${meta.label}`}
        hitSlop={6}
        style={({ pressed }) => ({
          backgroundColor: theme.brand,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.accent.onAccent }}>
          Comprar
        </Text>
      </Pressable>
    </View>
  );
}
