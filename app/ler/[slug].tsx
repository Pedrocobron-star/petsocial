import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetaTags } from '@/components/meta-tags';
import { AffiliateProducts } from '@/components/news/affiliate-products';
import { ArticleBody, ImageCaption } from '@/components/news/article-body';
import { ArticleTags } from '@/components/news/article-tags';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { FONTS } from '@/lib/fonts';
import {
  fetchArticleBySlug,
  fetchRelatedArticles,
  fetchRelatedByTag,
  incrementArticleView,
  qkNews,
  type NewsArticle,
} from '@/lib/news';
import { newsUrl, sharePost } from '@/lib/share';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * LEITOR PÚBLICO de matéria — rota /ler/[slug] FORA do gate de auth.
 * É pra onde a share-meta manda quem clica num link de notícia compartilhado:
 * a pessoa lê a matéria SEM precisar de login (canal de aquisição), com um CTA
 * pra criar conta. Quem já está logado vê "abrir no app".
 *
 * Espelha o detalhe in-app (app/(app)/news/[slug].tsx) mas standalone e enxuto.
 */
export default function PublicArticleReader() {
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const { session } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const articleQuery = useQuery({
    queryKey: qkNews.article(slugStr ?? ''),
    queryFn: () => fetchArticleBySlug(slugStr ?? ''),
    enabled: !!slugStr,
  });

  // Só mostra publicada (defesa em profundidade — a RLS já bloqueia rascunho pra anon).
  const article =
    articleQuery.data && articleQuery.data.status === 'published' ? articleQuery.data : null;

  const relatedQuery = useQuery({
    queryKey: article ? qkNews.related(article.id) : ['news-related', 'none'],
    queryFn: () =>
      fetchRelatedArticles({ excludeId: article!.id, categoryId: article!.category_id, limit: 4 }),
    enabled: !!article,
    staleTime: 5 * 60_000,
  });
  // "Veja também" por TAG (mais relevante); cai pra categoria se vazio.
  const relatedByTagQuery = useQuery({
    queryKey: article ? qkNews.relatedByTag(article.id) : ['news-related-tag', 'none'],
    queryFn: () =>
      fetchRelatedByTag({
        excludeId: article!.id,
        tagIds: (article!.tags ?? []).map((t) => t.id),
        limit: 4,
      }),
    enabled: !!article && !!article.tags?.length,
    staleTime: 5 * 60_000,
  });
  const tagRelated = relatedByTagQuery.data ?? [];
  const related = tagRelated.length > 0 ? tagRelated : relatedQuery.data ?? [];

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [article?.id]);

  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (article && viewedRef.current !== article.id) {
      viewedRef.current = article.id;
      void incrementArticleView(article.id);
    }
  }, [article]);

  const dateLabel = article?.published_at
    ? format(new Date(article.published_at), "d 'de' MMM, yyyy", { locale: ptBR })
    : null;

  const onShare = async () => {
    if (!article) return;
    const result = await sharePost({
      title: article.title,
      message: article.dek ?? article.title,
      url: newsUrl(article.slug),
    });
    if (result === 'copied') toast.success('Link copiado!', 'Cole onde quiser compartilhar.');
  };

  const goToApp = () => {
    // Logado → entra no app; deslogado → tela de cadastro.
    router.push((session ? '/(app)/news' : '/welcome') as never);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {article ? (
        <MetaTags
          title={`${article.title} · Maestro Pet`}
          description={article.dek ?? undefined}
          image={article.cover_url ?? undefined}
          type="article"
          canonicalUrl={`https://maestropet.com/ler/${article.slug}`}
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'NewsArticle',
            headline: article.title,
            description: article.dek ?? undefined,
            image: article.cover_url ?? undefined,
            datePublished: article.published_at ?? undefined,
            dateModified: article.updated_at ?? article.published_at ?? undefined,
            author: { '@type': 'Organization', name: article.author_name },
            publisher: {
              '@type': 'Organization',
              name: 'Maestro Pet',
              logo: { '@type': 'ImageObject', url: 'https://maestropet.com/icon-512.png' },
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://maestropet.com/ler/${article.slug}`,
            },
            url: `https://maestropet.com/ler/${article.slug}`,
          }}
        />
      ) : null}

      {/* Barra de marca + CTA (sempre visível) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
          backgroundColor: theme.surface,
        }}
      >
        <Pressable
          onPress={goToApp}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ fontSize: 18 }}>🐾</Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: theme.text }}>
            Maestro Pet
          </Text>
        </Pressable>
        <PressScale
          onPress={goToApp}
          style={{
            backgroundColor: theme.brand,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: theme.accent.onAccent }}>
            {session ? 'Abrir no app' : 'Criar conta grátis'}
          </Text>
        </PressScale>
      </View>

      {articleQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : !article ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 56 }}>🔎</Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
            Matéria não encontrada
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
            Essa notícia pode ter sido removida ou o link está incorreto.
          </Text>
          <PressScale onPress={goToApp} style={{ marginTop: 6, paddingVertical: 10, paddingHorizontal: 18 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
              Ir pro Maestro Pet
            </Text>
          </PressScale>
        </View>
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

            {/* Legenda da capa */}
            {article.cover_caption ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 6 }}>
                <ImageCaption caption={article.cover_caption} />
              </View>
            ) : null}

            <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
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
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: article.category.color }}>
                      {article.category.name}
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text
                style={{
                  fontFamily: FONTS.serifExtrabold,
                  fontSize: 28,
                  color: theme.text,
                  lineHeight: 35,
                  letterSpacing: -0.3,
                }}
              >
                {article.title}
              </Text>

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

              {/* Corpo (parágrafos + imagens com legenda via ![legenda](url)) */}
              <ArticleBody body={article.body} />

              {/* Tags (sem link na versão pública) */}
              <ArticleTags tags={article.tags} />

              <AffiliateProducts products={article.affiliate_products} articleSlug={article.slug} />

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

              {/* CTA de conversão */}
              <View
                style={{
                  marginTop: 20,
                  backgroundColor: theme.brandSurface,
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: theme.brandLight,
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 30 }}>🐾</Text>
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 17,
                    color: theme.brandDark,
                    textAlign: 'center',
                  }}
                >
                  Saúde, comunidade e cuidado pro seu pet
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.brandDark,
                    opacity: 0.85,
                    textAlign: 'center',
                    lineHeight: 19,
                  }}
                >
                  Carteirinha digital, carteira de vacinas, lembretes e o Jornal Pet — tudo de graça no Maestro Pet.
                </Text>
                <PressScale
                  onPress={goToApp}
                  style={{
                    marginTop: 4,
                    backgroundColor: theme.brand,
                    paddingHorizontal: 22,
                    paddingVertical: 11,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.accent.onAccent }}>
                    {session ? 'Abrir no app' : 'Criar conta grátis'}
                  </Text>
                </PressScale>
              </View>

              {/* Veja também — relacionadas por tag (cai pra categoria) */}
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
                    Veja também
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
    </SafeAreaView>
  );
}

function RelatedRow({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  return (
    <Link href={`/ler/${article.slug}` as never} asChild>
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
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: article.category.color, marginBottom: 3 }}>
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
