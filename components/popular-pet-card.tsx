import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { speciesLabel, temperamentEmoji } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';
import { petAgeText } from '@/lib/pet-age';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { PressScale } from './ui/press-scale';

interface Props {
  pet: Pet & { followers_count?: number };
  rank?: number;
}

const PERSONALITY_EMOJI: Record<string, string> = {
  adventurer: '🌄',
  cuddler: '🤗',
  playful: '🎾',
  shy: '🌸',
  independent: '🦅',
  royal: '👑',
};

/**
 * Card horizontal de pet popular. Avatar 56px, info à esquerda,
 * badge de seguidores à direita. Pet memorializado mostra 🌈.
 */
export function PopularPetCard({ pet, rank }: Props) {
  const { theme } = useTheme();
  const age = petAgeText(pet.birthdate);
  const personalityEmoji = pet.personality_type
    ? PERSONALITY_EMOJI[pet.personality_type]
    : null;

  return (
    <Link href={{ pathname: '/pet/[id]', params: { id: pet.id } }} asChild>
      <PressScale
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.surface,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        {/* Rank pequeno */}
        {rank !== undefined && rank <= 99 ? (
          <View
            style={{
              width: 22,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 14,
                color: theme.textDim,
              }}
            >
              {rank}
            </Text>
          </View>
        ) : null}

        <PetAvatar pet={pet} size={56} />

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 15,
                color: theme.text,
              }}
              numberOfLines={1}
            >
              {pet.name}
            </Text>
            {pet.memorial_at ? <Text style={{ fontSize: 12 }}>🌈</Text> : null}
            {personalityEmoji ? (
              <Text style={{ fontSize: 11 }}>{personalityEmoji}</Text>
            ) : null}
            {pet.social_temperament ? (
              <Text style={{ fontSize: 11 }}>{temperamentEmoji(pet.social_temperament)}</Text>
            ) : null}
          </View>

          {/* Chips de espécie + raça */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
            }}
          >
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: theme.brandLight,
              }}
            >
              <Text
                style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.brandDark }}
              >
                {speciesLabel(pet.species)}
              </Text>
            </View>
            {pet.breed ? (
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.textDim,
                }}
                numberOfLines={1}
              >
                {pet.breed}
              </Text>
            ) : null}
            {age ? (
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.textDim,
                }}
              >
                · {age}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Followers badge */}
        {typeof pet.followers_count === 'number' && pet.followers_count > 0 ? (
          <View style={{ alignItems: 'center', minWidth: 44 }}>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 16,
                color: theme.text,
                letterSpacing: -0.3,
              }}
            >
              {formatCount(pet.followers_count)}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 9,
                color: theme.textDim,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {pet.followers_count === 1 ? 'seguidor' : 'seguidores'}
            </Text>
          </View>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.textDim} />
        )}
      </PressScale>
    </Link>
  );
}
