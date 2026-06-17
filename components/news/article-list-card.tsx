import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { NewBadge } from '@/components/news/news-actions';
import { FONTS } from '@/lib/fonts';
import { isRecentArticle, type NewsArticle } from '@/lib/news';
import { useTheme } from '@/providers/theme-provider';

/**
 * Card horizontal de matéria — usado nas listas ("Últimas", categoria).
 * Thumbnail à esquerda, conteúdo à direita. Linka pra /(app)/news/[slug].
 */
export function ArticleListCard({ article }: { article: NewsArticle }) {
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
          flexDirection: 'row',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.borderLight,
          padding: 10,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        {/* Thumbnail */}
        {article.cover_url ? (
          <Image
            source={{ uri: article.cover_url }}
            style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: theme.brandSurface }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              backgroundColor: cat?.color ? `${cat.color}22` : theme.brandSurface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 34 }}>{cat?.emoji ?? '📰'}</Text>
          </View>
        )}

        {/* Conteúdo */}
        <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
          {cat || isRecentArticle(article.published_at) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {cat ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: `${cat.color}1A`,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontSize: 11 }}>{cat.emoji}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: cat.color }}>
                    {cat.name}
                  </Text>
                </View>
              ) : null}
              <NewBadge publishedAt={article.published_at} />
            </View>
          ) : null}

          <Text
            style={{
              fontFamily: FONTS.serifSemibold,
              fontSize: 16,
              color: theme.text,
              lineHeight: 21,
            }}
            numberOfLines={2}
          >
            {article.title}
          </Text>

          {article.dek ? (
            <Text
              style={{ fontFamily: FONTS.body, fontSize: 12.5, color: theme.textDim, lineHeight: 17 }}
              numberOfLines={1}
            >
              {article.dek}
            </Text>
          ) : null}

          {dateLabel ? (
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textDim }}>
              {dateLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}
