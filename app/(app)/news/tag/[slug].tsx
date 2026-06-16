import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ArticleListCard } from '@/components/news/article-list-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { fetchArticlesByTag, fetchTagBySlug, qkNews } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * LISTAGEM POR TAG (tema/animal). Acha a tag pelo slug e lista as matérias
 * publicadas vinculadas a ela (via news_article_tags).
 */
export default function NewsTagScreen() {
  const { theme } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const tagQuery = useQuery({
    queryKey: qkNews.tag(slugStr ?? ''),
    queryFn: () => fetchTagBySlug(slugStr ?? ''),
    enabled: !!slugStr,
  });
  const tag = tagQuery.data ?? null;

  const articlesQuery = useQuery({
    queryKey: tag ? qkNews.articlesByTag(tag.id) : ['news-articles-by-tag', 'none'],
    queryFn: () => fetchArticlesByTag(tag!.id, 200),
    enabled: !!tag?.id,
  });
  const articles = articlesQuery.data ?? [];
  const headerTitle = tag ? `#${tag.name}` : 'Tag';
  const loading = tagQuery.isLoading || (!!tag && articlesQuery.isLoading);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: headerTitle, headerShown: true }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <CenteredColumn maxWidth={620}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {tag ? (
              <View
                style={{
                  backgroundColor: theme.brandSurface,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: theme.brandLight,
                  padding: 18,
                  marginBottom: 18,
                }}
              >
                <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: theme.brandDark }}>
                  #{tag.name}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyMedium,
                    fontSize: 13,
                    color: theme.textMuted,
                    marginTop: 4,
                  }}
                >
                  {articles.length > 0
                    ? `${articles.length} ${articles.length === 1 ? 'matéria' : 'matérias'} com esta tag`
                    : 'Matérias com esta tag'}
                </Text>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
            ) : !tag ? (
              <EmptyState
                emoji="🔎"
                title="Tag não encontrada"
                description="Essa tag pode ter sido removida ou o link está incorreto."
              />
            ) : articles.length === 0 ? (
              <EmptyState
                emoji="🏷️"
                title="Nada por aqui ainda"
                description="Nenhuma matéria com esta tag ainda. Volte em breve!"
              />
            ) : (
              <View style={{ gap: 12 }}>
                {articles.map((a) => (
                  <ArticleListCard key={a.id} article={a} />
                ))}
              </View>
            )}
          </View>
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}
