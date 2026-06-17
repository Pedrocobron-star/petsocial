import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ArticleListCard } from '@/components/news/article-list-card';
import { FollowCategoryButton } from '@/components/news/news-actions';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { fetchArticles, fetchCategories, qkNews } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * LISTAGEM POR CATEGORIA.
 * Acha a categoria pelo slug, mostra header colorido e lista as matérias dela.
 */
export default function NewsCategoryScreen() {
  const { theme } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const slugStr = Array.isArray(slug) ? slug[0] : slug;

  const categoriesQuery = useQuery({
    queryKey: qkNews.categories(),
    queryFn: fetchCategories,
  });

  const category = (categoriesQuery.data ?? []).find((c) => c.slug === slugStr) ?? null;

  const articlesQuery = useQuery({
    queryKey: qkNews.articles(category?.id),
    // limit explícito alto pra não cortar silenciosamente no default de 20.
    queryFn: () => fetchArticles({ categoryId: category?.id, limit: 200 }),
    enabled: !!category?.id,
  });

  const articles = articlesQuery.data ?? [];
  const headerTitle = category ? `${category.emoji} ${category.name}` : 'Categoria';
  const loading = categoriesQuery.isLoading || (!!category && articlesQuery.isLoading);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: headerTitle, headerShown: true }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <CenteredColumn maxWidth={620}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {/* Header da categoria */}
            {category ? (
              <View
                style={{
                  backgroundColor: `${category.color}14`,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: `${category.color}33`,
                  padding: 18,
                  marginBottom: 18,
                  overflow: 'hidden',
                }}
              >
                <Text style={{ position: 'absolute', right: -2, bottom: -10, fontSize: 64, opacity: 0.14 }}>
                  {category.emoji}
                </Text>
                <Text style={{ fontFamily: FONTS.display, fontSize: 24, color: category.color }}>
                  {category.emoji} {category.name}
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
                    ? `${articles.length} ${articles.length === 1 ? 'matéria' : 'matérias'} nesta editoria`
                    : 'Matérias desta editoria'}
                </Text>
                <View style={{ marginTop: 12 }}>
                  <FollowCategoryButton categoryId={category.id} color={category.color} />
                </View>
              </View>
            ) : null}

            {loading ? (
              <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
            ) : !category ? (
              <EmptyState
                emoji="🔎"
                title="Categoria não encontrada"
                description="Essa editoria pode ter sido removida ou o link está incorreto."
              />
            ) : articles.length === 0 ? (
              <EmptyState
                emoji="📰"
                title="Nada por aqui ainda"
                description="A redação ainda não publicou matérias nesta editoria. Volte em breve!"
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
