import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AffiliateProducts } from '@/components/news/affiliate-products';
import { ArticleTags } from '@/components/news/article-tags';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { resetMetaTags, setMetaTags } from '@/lib/meta-tags';
import {
  fetchArticleBySlug,
  fetchRelatedArticles,
  incrementArticleView,
  qkNews,
  type NewsArticle,
} from '@/lib/news';
import { newsUrl, sharePost } from '@/lib/share';
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

  const relatedQuery = useQuery({
    queryKey: article ? qkNews.related(article.id) : ['news-related', 'none'],
    queryFn: () =>
      fetchRelatedArticles({ excludeId: article!.id, categoryId: article!.category_id, limit: 4 }),
    enabled: !!article,
    staleTime: 5 * 60_000,
  });
  const related = relatedQuery.data ?? [];

  // Ao trocar de matéria (ex.: clicou numa relacionada), volta ao topo.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [article?.id]);

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
      title: `${article.title} · Maestro Pet`,
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
    // URL canônica /share/news/<slug> → share-meta injeta OG e manda pro leitor
    // público /ler/<slug> (lê sem login). Conserta o preview e o link morto.
    const result = await sharePost({
      title: article.title,
      message: article.dek ?? article.title,
      url: newsUrl(article.slug),
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
        <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 48 }}>
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

              {/* Tags (clicáveis → filtro por tag) */}
              <ArticleTags tags={article.tags} linkable />

              {/* Produtos afiliados */}
              <AffiliateProducts products={article.affiliate_products} articleSlug={article.slug} />

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

              {/* Leia também — mantém o leitor no portal */}
              {related.length > 0 ? (
                <View style={{ marginTop: 36 }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      letterSpacing: 0.8,
                      color: theme.textDim,
                      textTransform: 'uppercase',
                      marginBottom: 12,
                    }}
                  >
                    Leia também
                  </Text>
                  <View style={{ gap: 10 }}>
                    {related.map((r) => (
                      <RelatedRow key={r.id} article={r} />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </CenteredColumn>
        </ScrollView>
      )}
    </View>
  );
}

function RelatedRow({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  return (
    <Link href={`/news/${article.slug}` as never} asChild>
      <Pressable
        accessibilityRole="link"
        style={({ pressed }) => ({
          flexDirection: 'row',
          gap: 12,
          backgroundColor: theme.card,
          borderRadius: 14,
          padding: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {article.cover_url ? (
          <Image
            source={{ uri: article.cover_url }}
            style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: theme.brandSurface }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 10,
              backgroundColor: article.category?.color ? `${article.category.color}22` : theme.brandSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 30 }}>{article.category?.emoji ?? '📰'}</Text>
          </View>
        )}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {article.category ? (
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 10.5,
                color: article.category.color,
                marginBottom: 3,
              }}
            >
              {article.category.emoji} {article.category.name}
            </Text>
          ) : null}
          <Text
            style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: theme.text, lineHeight: 19 }}
            numberOfLines={3}
          >
            {article.title}
          </Text>
        </View>
      </Pressable>
    </Link>
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
