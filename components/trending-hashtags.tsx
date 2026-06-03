import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchTrendingHashtags, qk } from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

import { CenteredColumn } from './ui/centered-column';
import { PressScale } from './ui/press-scale';

/**
 * Trending hashtags da semana. Top 1 em card destaque, demais em pills horizontais.
 */
export function TrendingHashtags() {
  const { theme } = useTheme();
  const query = useQuery({ queryKey: qk.trendingHashtags(), queryFn: fetchTrendingHashtags });

  const tags = query.data ?? [];
  if (tags.length === 0) return null;

  const [top, ...rest] = tags;

  return (
    <View style={{ marginTop: 18 }}>
      <CenteredColumn maxWidth={540}>
        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.brand,
              textTransform: 'uppercase',
            }}
          >
            Em alta nesta semana
          </Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 20,
              color: theme.text,
              marginTop: 1,
              letterSpacing: -0.3,
            }}
          >
            Hashtags do momento 🔥
          </Text>
        </View>

        {/* Top hashtag em destaque */}
        <Link
          href={{ pathname: '/tag/[name]' as never, params: { name: top.name } as never }}
          asChild
        >
          <PressScale
            style={{
              backgroundColor: theme.brandSurface,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: theme.brandLight,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: theme.brandLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.brandDark }}>
                #
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 16,
                  color: theme.brandDark,
                }}
                numberOfLines={1}
              >
                {top.name}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.brandDark,
                  opacity: 0.75,
                  marginTop: 1,
                }}
              >
                {top.post_count} {top.post_count === 1 ? 'post' : 'posts'} nesta semana
              </Text>
            </View>
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </PressScale>
        </Link>
      </CenteredColumn>

      {/* Demais hashtags em pills horizontais */}
      {rest.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingTop: 10 }}
        >
          {rest.map((t) => (
            <Link
              key={t.name}
              href={{ pathname: '/tag/[name]' as never, params: { name: t.name } as never }}
              asChild
            >
              <PressScale
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
                  #{t.name}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: theme.textDim,
                  }}
                >
                  {t.post_count}
                </Text>
              </PressScale>
            </Link>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
