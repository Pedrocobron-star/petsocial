import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AffiliateProducts } from '@/components/news/affiliate-products';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { resetMetaTags, setMetaTags } from '@/lib/meta-tags';
import { fetchArticleBySlug, incrementArticleView, qkNews } from '@/lib/news';
import { sharePost } from '@/lib/share';
import { fetchActiveSponsoredPosts } from '@/lib/sponsored';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * DETALHE DA MATÉRIA.
 * Capa 16:9 → chip de categoria → título → dek → byline → corpo em parágrafos →
 * produtos afiliados → slot publicitário → compartilhar.
 */
export default function NewsArticleScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const articleQuery = useQuery({
    queryKey: qkNews.article(slugStr ?? ''),
    queryFn: () => fetchArticleBySlug(slugStr ?? ''),
    enabled: !!slugStr,
  });

  const sponsoredQuery = useQuery({
    queryKey: ['news-sponsored-slot'],
    queryFn: () => fetchActiveSponsoredPosts(1),
  });

  const article = articleQuery.data ?? null;
  const sponsored = sponsoredQuery.data?.[0] ?? null;

  // Incrementa view UMA vez por matéria carregada.
  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (article && viewedRef.current !== article.id) {
      viewedRef.current = article.id;
      void incrementArticleView(article.id);
    }
  }, [article]);

  // Meta tags ricas pra compartilhamento (preview com capa/título no WhatsApp,
  // Twitter, etc.). Reseta ao sair pra não vazar pra outras telas.
  useEffect(() => {
    if (!article) return;
    setMetaTags({
      title: `${article.title} · Pet Social`,
      description: article.dek ?? undefined,
      image: article.cover_url ?? undefined,
    });
    return () => resetMetaTags('Notícias');
  }, [article]);

  const paragraphs = useMemo(() => splitBody(article?.body ?? ''), [article?.body]);

  const dateLabel = article?.published_at
    ? format(new Date(article.published_at), "d 'de' MMM, yyyy", { locale: ptBR })
    : null;

  const onShare = async () => {
    if (!article) return;
    const url =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : `https://pet.social/news/${article.slug}`;
    const result = await sharePost({
      title: article.title,
      message: article.dek ?? article.title,
      url,
    });
    if (result === 'copied') toast.success('Link copiado!', 'Cole onde quiser compartilhar.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Notícia', headerShown: true }} />

      {articleQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : !article ? (
        <EmptyState
          emoji="🔎"
          title="Matéria não encontrada"
          description="Essa notícia pode ter sido removida ou o link está incorreto."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
          <CenteredColumn maxWidth={620}>
            {/* Capa */}
            {article.cover_url ? (
              <Image
                source={{ uri: article.cover_url }}
                style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: theme.brandSurface }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View
                style={{
                  width: '100%',
                  aspectRatio: 16 / 9,
                  backgroundColor: article.category?.color
                    ? `${article.category.color}22`
                    : theme.brandSurface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 64 }}>{article.category?.emoji ?? '📰'}</Text>
              </View>
            )}

            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
              {/* Categoria */}
              {article.category ? (
                <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      backgroundColor: `${article.category.color}1A`,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>{article.category.emoji}</Text>
                    <Text
                      style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: article.category.color }}
                    >
                      {article.category.name}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Título */}
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 27,
                  color: theme.text,
                  lineHeight: 33,
                  letterSpacing: -0.5,
                }}
              >
                {article.title}
              </Text>

              {/* Dek */}
              {article.dek ? (
                <Text
                  style={{
                    fontFamily: FONTS.bodyMedium,
                    fontSize: 16,
                    color: theme.textMuted,
                    lineHeight: 24,
                    marginTop: 10,
                  }}
                >
                  {article.dek}
                </Text>
              ) : null}

              {/* Byline */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 14,
                  paddingBottom: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderLight,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 13, color: theme.text }}>
                  Por {article.author_name}
                </Text>
                {dateLabel ? (
                  <>
                    <Text style={{ color: theme.textDim, fontSize: 13 }}>·</Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
                      {dateLabel}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* Corpo */}
              <View style={{ marginTop: 18, gap: 16 }}>
                {paragraphs.map((p, i) => (
                  <Text
                    key={i}
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 16.5,
                      color: theme.text,
                      lineHeight: 27,
                    }}
                  >
                    {p}
                  </Text>
                ))}
              </View>

              {/* Produtos afiliados */}
              <AffiliateProducts products={article.affiliate_products} />

              {/* Slot publicitário */}
              {sponsored ? (
                <View style={{ marginTop: 28 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 10.5,
                      color: theme.textDim,
                      letterSpacing: 0.8,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Publicidade
                  </Text>
                  <SponsoredPostCard post={sponsored} />
                </View>
              ) : null}

              {/* Compartilhar */}
              <Pressable
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel="Compartilhar matéria"
                style={({ pressed }) => ({
                  marginTop: 28,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: theme.brand,
                  paddingVertical: 14,
                  borderRadius: 14,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Ionicons name="share-social-outline" size={18} color={theme.accent.onAccent} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.accent.onAccent }}>
                  Compartilhar
                </Text>
              </Pressable>
            </View>
          </CenteredColumn>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Divide o corpo em parágrafos: split em linhas vazias (uma ou mais quebras
 * duplas). Mantém quebras de linha simples DENTRO do parágrafo.
 */
function splitBody(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
