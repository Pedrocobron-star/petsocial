import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';
import type { Profile } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PremiumBadge } from './premium-badge';
import { CenteredColumn } from './ui/centered-column';
import { UserInitialAvatar } from './user-initial-avatar';

interface Props {
  profile: Profile | null | undefined;
  email: string | undefined;
  isPro: boolean;
  stats: {
    pets_count: number;
    posts_count: number;
    streak_current: number;
  };
}

/**
 * Hero do perfil do tutor: banner cream com patinhas + avatar overlap,
 * nome + email, bio, stats pills (pets / posts / sequência) e botão editar.
 */
export function TutorProfileHero({ profile, email, isPro, stats }: Props) {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.surface, paddingBottom: 16 }}>
      {/* Banner warm com patinhas decorativas */}
      <View
        style={{
          height: 84,
          backgroundColor: theme.brandLight,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Text style={{ position: 'absolute', top: 6, left: 14, fontSize: 70, opacity: 0.12 }}>
          🐾
        </Text>
        <Text
          style={{
            position: 'absolute',
            top: 18,
            right: 26,
            fontSize: 52,
            opacity: 0.1,
            transform: [{ rotate: '18deg' }],
          }}
        >
          🐾
        </Text>
        <Text
          style={{
            position: 'absolute',
            top: 44,
            left: '42%',
            fontSize: 36,
            opacity: 0.08,
            transform: [{ rotate: '-14deg' }],
          }}
        >
          🐾
        </Text>
      </View>

      <CenteredColumn maxWidth={540} withMargin={false} style={{ paddingHorizontal: 16 }}>
        {/* Avatar 96px com overlap */}
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ marginTop: -42, alignItems: 'center' }}
        >
          <View
            style={{
              padding: 4,
              borderRadius: 999,
              backgroundColor: theme.surface,
              shadowColor: '#7C2D12',
              shadowOpacity: 0.15,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 5 },
            }}
          >
            <UserInitialAvatar
              avatarUrl={profile?.avatar_url}
              displayName={profile?.display_name}
              userId={profile?.id}
              size={96}
            />
          </View>
        </Animated.View>

        {/* Nome + email + badge Pro */}
        <View style={{ alignItems: 'center', marginTop: 10, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: FONTS.display,
                fontSize: 26,
                color: theme.text,
                letterSpacing: -0.5,
                flexShrink: 1,
              }}
            >
              {profile?.display_name ?? 'Tutor(a)'}
            </Text>
            {isPro ? <PremiumBadge size={18} /> : null}
          </View>
          {email ? (
            <Text
              numberOfLines={1}
              style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}
            >
              {email}
            </Text>
          ) : null}
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 21,
              color: theme.textMuted,
              textAlign: 'center',
              marginTop: 10,
              paddingHorizontal: 12,
            }}
          >
            {profile.bio}
          </Text>
        ) : null}

        {/* Stats pills */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginTop: 14,
          }}
        >
          <StatPill label="pets" value={stats.pets_count} emoji="🐾" />
          <StatPill label="posts" value={stats.posts_count} emoji="📷" />
          <StatPill
            label={stats.streak_current === 1 ? 'dia' : 'dias'}
            value={stats.streak_current}
            emoji="🔥"
            highlight={stats.streak_current >= 3}
          />
        </View>

        {/* Botão editar */}
        <View style={{ marginTop: 12 }}>
          <Link href="/(app)/edit-profile" asChild>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: theme.borderLight,
                borderRadius: 12,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="pencil-outline" size={14} color={theme.text} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                Editar perfil
              </Text>
            </Pressable>
          </Link>
        </View>
      </CenteredColumn>
    </View>
  );
}

function StatPill({
  label,
  value,
  emoji,
  highlight = false,
}: {
  label: string;
  value: number;
  emoji: string;
  highlight?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: highlight ? theme.brandLight : theme.borderLight,
        paddingVertical: 10,
        borderRadius: 14,
      }}
    >
      <Text style={{ fontSize: 14, marginBottom: 1 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: FONTS.display,
          fontSize: 18,
          color: highlight ? theme.brandDark : theme.text,
          letterSpacing: -0.5,
        }}
      >
        {formatCount(value)}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.bodyMedium,
          fontSize: 10,
          color: highlight ? theme.brandDark : theme.textDim,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginTop: -2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
