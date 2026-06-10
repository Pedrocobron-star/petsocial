import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';
import type { PostWithDetails } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { CenteredColumn } from './ui/centered-column';
import { PressScale } from './ui/press-scale';

interface Props {
  posts: PostWithDetails[]; // já assume ordenado por likes desc
}

const PODIUM_COLORS = {
  1: { bg: '#FFFBEB', border: '#FBBF24', medal: '🥇', dark: '#92400E', height: 140 },
  2: { bg: '#F5F5F4', border: '#A8A29E', medal: '🥈', dark: '#44403C', height: 116 },
  3: { bg: '#FEF3C7', border: '#D97706', medal: '🥉', dark: '#92400E', height: 104 },
} as const;

/**
 * Pódio dos 3 primeiros posts do Wall of Fame.
 * Layout: 2º (esquerda baixa) | 1º (centro alta) | 3º (direita baixa)
 */
export function WallOfFamePodium({ posts }: Props) {
  if (posts.length === 0) return null;
  const top1 = posts[0];
  const top2 = posts[1];
  const top3 = posts[2];

  return (
    <CenteredColumn maxWidth={540}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginTop: 12,
          marginBottom: 4,
        }}
      >
        {/* 2º (esquerda) */}
        {top2 ? (
          <View style={{ flex: 1 }}>
            <PodiumCard post={top2} rank={2} delay={150} />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {/* 1º (centro, mais alto) */}
        <View style={{ flex: 1.05 }}>
          <PodiumCard post={top1} rank={1} delay={0} />
        </View>

        {/* 3º (direita) */}
        {top3 ? (
          <View style={{ flex: 1 }}>
            <PodiumCard post={top3} rank={3} delay={250} />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>
    </CenteredColumn>
  );
}

function PodiumCard({
  post,
  rank,
  delay,
}: {
  post: PostWithDetails;
  rank: 1 | 2 | 3;
  delay: number;
}) {
  const { theme } = useTheme();
  const cfg = PODIUM_COLORS[rank];
  const cover = post.media[0];

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)}>
      <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
        <PressScale
          style={{
            backgroundColor: cfg.bg,
            borderRadius: 16,
            padding: 8,
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: cfg.border,
            minHeight: cfg.height,
            justifyContent: 'space-between',
          }}
        >
          {/* Medal sticker top */}
          <View
            style={{
              position: 'absolute',
              top: -10,
              left: '50%',
              marginLeft: -16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: theme.surface,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 2 },
              zIndex: 2,
            }}
          >
            <Text style={{ fontSize: 18 }}>{cfg.medal}</Text>
          </View>

          {/* Cover image */}
          {cover ? (
            <View
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: 10,
                overflow: 'hidden',
                backgroundColor: theme.borderLight,
                marginTop: 14,
              }}
            >
              <Image
                source={{ uri: cover.url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            </View>
          ) : (
            <View
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: 10,
                backgroundColor: theme.borderLight,
                marginTop: 14,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 24 }}>📷</Text>
            </View>
          )}

          {/* Pet name + likes */}
          <View style={{ alignItems: 'center', marginTop: 8, gap: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                maxWidth: '100%',
              }}
            >
              <PetAvatar
                pet={post.pet}
                size={16}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: cfg.dark,
                  letterSpacing: -0.2,
                }}
                numberOfLines={1}
              >
                {post.pet.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 11 }}>❤️</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: cfg.dark,
                }}
              >
                {formatCount(post.likes_count)}
              </Text>
            </View>
          </View>
        </PressScale>
      </Link>
    </Animated.View>
  );
}
