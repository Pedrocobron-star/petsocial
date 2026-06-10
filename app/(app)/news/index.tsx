import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ArticleListCard } from '@/components/news/article-list-card';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import {
  fetchArticles,
  fetchCategories,
  qkNews,
  type NewsArticle,
  type NewsCategory,
} from '@/lib/news';
import { fetchActiveSponsoredPosts } from '@/lib/sponsored';
import { useTheme } from '@/providers/theme-provider';

/**
 * PORTAL HOME — "Redação Maestro Pet".
 * Masthead + matéria de destaque + slot publicitário + pílulas de categoria +
 * lista de últimas. Tudo theme-aware e pt-BR.
 */
export default function NewsPortalScreen() {
  const { theme } = useTheme();

  const categoriesQuery = useQuery({
    queryKey: qkNews.categories(),
    queryFn: fetchCategories,
  });

  const articlesQuery = useQuery({
    queryKey: qkNews.articles(),
    queryFn: () => fetchArticles(),
  });

  const featuredQuery = useQuery({
    queryKey: qkNews.articles(undefined, true),
    queryFn: () => fetchArticles({ featured: true, limit: 1 }),
  });

  const sponsoredQuery = useQuery({
    queryKey: ['news-sponsored-slot'],
    queryFn: () => fetchActiveSponsoredPosts(1),
  });

  const articles = articlesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const sponsored = sponsoredQuery.data?.[0] ?? null;

  // Hero: a 1a featured OU a matéria mais recente.
  const hero: NewsArticle | null = featuredQuery.data?.[0] ?? articles[0] ?? null;
  // Lista "Últimas": exclui a do hero pra não duplicar.
  const latest = hero ? articles.filter((a) => a.id !== hero.id) : articles;

  const loading = articlesQuery.isLoading || featuredQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: '📰 Notícias Pet', headerShown: true }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <CenteredColumn maxWidth={620}>
          {/* Masthead */}
          <View
            style={{
              paddingTop: 18,
              paddingBottom: 16,
              paddingHorizontal: 16,
              alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: theme.brand,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 27,
                color: theme.text,
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              Redação Maestro Pet
            </Text>
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 13,
                color: theme.textDim,
                marginTop: 4,
                textAlign: 'center',
              }}
            >
              Notícias do mundo pet, todo dia
            </Text>
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            {loading ? (
              <ActivityIndicator color={theme.brand} style={{ marginTop: 40 }} />
            ) : articles.length === 0 ? (
              <EmptyState
                emoji="📰"
                title="Em breve, notícias!"
                description="A redação está preparando as primeiras matérias."
              />
            ) : (
              <>
                {/* HERO */}
                {hero ? <HeroCard article={hero} /> : null}

                {/* AD SLOT */}
                {sponsored ? (
                  <View style={{ marginTop: 20 }}>
                    <AdLabel />
                    <SponsoredPostCard post={sponsored} />
                  </View>
                ) : null}

                {/* CATEGORIAS */}
                {categories.length > 0 ? (
                  <View style={{ marginTop: 24 }}>
                    <SectionTitle>Categorias</SectionTitle>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                    >
                      {categories.map((c) => (
                        <CategoryPill key={c.id} category={c} />
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                {/* ÚLTIMAS */}
                {latest.length > 0 ? (
                  <View style={{ marginTop: 24 }}>
                    <SectionTitle>Últimas</SectionTitle>
                    <View style={{ gap: 12 }}>
                      {latest.map((a) => (
                        <ArticleListCard key={a.id} article={a} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            )}
          </View>
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: FONTS.display,
        fontSize: 18,
        color: theme.text,
        marginBottom: 12,
        letterSpacing: -0.3,
      }}
    >
      {children}
    </Text>
  );
}

function AdLabel() {
  const { theme } = useTheme();
  return (
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
  );
}

function HeroCard({ article }: { article: NewsArticle }) {
  const { theme } = useTheme();
  const cat = article.category;
  const dateLabel = article.published_at
    ? format(new Date(article.published_at), "d 'de' MMM, yyyy", { locale: ptBR })
    : null;

  return (
    <Link href={{ pathname: '/(app)/news/[slug]', params: { slug: article.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={article.title}
        style={({ pressed }) => ({
          marginTop: 20,
          backgroundColor: theme.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: theme.borderLight,
          overflow: 'hidden',
          opacity: pressed ? 0.95 : 1,
        })}
      >
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
              backgroundColor: cat?.color ? `${cat.color}22` : theme.brandSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 64 }}>{cat?.emoji ?? '📰'}</Text>
          </View>
        )}

        <View style={{ padding: 16, gap: 8 }}>
          {cat ? (
            <View style={{ flexDirection: 'row' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  backgroundColor: `${cat.color}1A`,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Text style={{ fontSize: 12 }}>{cat.emoji}</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: cat.color }}>
                  {cat.name}
                </Text>
              </View>
            </View>
          ) : null}

          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 23,
              color: theme.text,
              lineHeight: 29,
              letterSpacing: -0.4,
            }}
          >
            {article.title}
          </Text>

          {article.dek ? (
            <Text
              style={{ fontFamily: FONTS.body, fontSize: 14.5, color: theme.textMuted, lineHeight: 21 }}
              numberOfLines={3}
            >
              {article.dek}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim }}>
              {article.author_name}
            </Text>
            {dateLabel ? (
              <>
                <Text style={{ color: theme.textDim, fontSize: 12 }}>·</Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                  {dateLabel}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

function CategoryPill({ category }: { category: NewsCategory }) {
  return (
    <Link href={{ pathname: '/(app)/news/category/[slug]', params: { slug: category.slug } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Categoria ${category.name}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: `${category.color}1A`,
          borderWidth: 1,
          borderColor: `${category.color}40`,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ fontSize: 14 }}>{category.emoji}</Text>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: category.color }}>
          {category.name}
        </Text>
      </Pressable>
    </Link>
  );
}
