import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ArticleListCard } from '@/components/news/article-list-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { fetchSavedArticles, qkNews } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * MATÉRIAS SALVAS (item 3) — "ler depois". Lista o que o usuário marcou,
 * mais recentes primeiro. RLS já restringe ao próprio usuário.
 */
export default function SavedArticlesScreen() {
  const { theme } = useTheme();
  const savedQ = useQuery({ queryKey: qkNews.saved(), queryFn: () => fetchSavedArticles() });
  const articles = savedQ.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: '🔖 Salvas', headerShown: true }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <CenteredColumn maxWidth={620}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            {savedQ.isLoading ? (
              <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
            ) : articles.length === 0 ? (
              <EmptyState
                emoji="🔖"
                title="Nada salvo ainda"
                description="Toque no marcador numa matéria pra guardar e ler quando quiser."
              />
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: theme.textDim,
                    marginBottom: 12,
                  }}
                >
                  {articles.length} {articles.length === 1 ? 'matéria salva' : 'matérias salvas'}
                </Text>
                <View style={{ gap: 12 }}>
                  {articles.map((a) => (
                    <ArticleListCard key={a.id} article={a} />
                  ))}
                </View>
              </>
            )}
          </View>
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}
