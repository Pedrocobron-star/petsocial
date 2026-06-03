import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';
import type { PostWithDetails } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { PressScale } from './ui/press-scale';

interface Props {
  post: PostWithDetails;
  rank: number;
}

/**
 * Card horizontal compacto para os ranks 4+ do Wall of Fame.
 * Thumbnail 72px, info no centro, contagem à direita.
 */
export function WallOfFameCard({ post, rank }: Props) {
  const { theme } = useTheme();
  const cover = post.media[0];

  return (
    <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
      <PressScale
        style={{
          flexDirection: 'row',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 10,
          borderWidth: 1,
          borderColor: theme.borderLight,
          alignItems: 'center',
        }}
      >
        {/* Rank badge */}
        <View
          style={{
            width: 28,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 16,
              color: theme.textDim,
              letterSpacing: -0.3,
            }}
          >
            {rank}
          </Text>
        </View>

        {/* Cover */}
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            backgroundColor: theme.borderLight,
            overflow: 'hidden',
          }}
        >
          {cover ? (
            <Image
              source={{ uri: cover.url }}
              style={{ width: 72, height: 72 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 22 }}>📷</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, justifyContent: 'center', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <PetAvatar pet={post.pet} size={22} />
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 14,
                color: theme.text,
              }}
              numberOfLines={1}
            >
              {post.pet.name}
            </Text>
          </View>
          {post.caption ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textMuted,
                lineHeight: 16,
              }}
              numberOfLines={2}
            >
              {post.caption}
            </Text>
          ) : null}
        </View>

        {/* Likes + comments column */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="heart" size={13} color="#ef4444" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
              {formatCount(post.likes_count)}
            </Text>
          </View>
          {post.comments_count > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chatbubble" size={11} color={theme.textDim} />
              <Text
                style={{
                  fontFamily: FONTS.bodyMedium,
                  fontSize: 11,
                  color: theme.textDim,
                }}
              >
                {formatCount(post.comments_count)}
              </Text>
            </View>
          ) : null}
        </View>
      </PressScale>
    </Link>
  );
}
