import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { speciesLabel, temperamentEmoji, temperamentLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { formatCount } from '@/lib/format';
import { petAgeText } from '@/lib/pet-age';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { ImageViewer } from './image-viewer';
import { PetAvatar } from './pet-avatar';
import { Button } from './ui/button';
import { CenteredColumn } from './ui/centered-column';
import { NumberCounter } from './ui/number-counter';
import { PressScale } from './ui/press-scale';

interface Props {
  pet: Pet;
  stats: { posts_count: number; followers_count: number; following_count: number };
  isOwn: boolean;
  isFollowing: boolean;
  onFollow: () => void;
  onMessage: () => void;
  followLoading?: boolean;
  messageLoading?: boolean;
}

const PERSONALITY_INFO: Record<string, { emoji: string; label: string }> = {
  adventurer: { emoji: '🌄', label: 'Aventureiro' },
  cuddler: { emoji: '🤗', label: 'Mimoso' },
  playful: { emoji: '🎾', label: 'Brincalhão' },
  shy: { emoji: '🌸', label: 'Tímido' },
  independent: { emoji: '🦅', label: 'Independente' },
  royal: { emoji: '👑', label: 'Realeza' },
};

export function PetProfileHero({
  pet,
  stats,
  isOwn,
  isFollowing,
  onFollow,
  onMessage,
  followLoading,
  messageLoading,
}: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const ageText = petAgeText(pet.birthdate);
  const personality = pet.personality_type ? PERSONALITY_INFO[pet.personality_type] : null;


  return (
    <View style={{ backgroundColor: theme.surface, paddingBottom: 16 }}>
      {/* Banner warm com paw decorativos */}
      <View
        style={{
          height: 96,
          backgroundColor: '#FFEDD5',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Text
          style={{
            position: 'absolute',
            top: 6,
            left: 12,
            fontSize: 80,
            opacity: 0.12,
          }}
        >
          🐾
        </Text>
        <Text
          style={{
            position: 'absolute',
            top: 20,
            right: 30,
            fontSize: 56,
            opacity: 0.1,
            transform: [{ rotate: '20deg' }],
          }}
        >
          🐾
        </Text>
        <Text
          style={{
            position: 'absolute',
            top: 50,
            left: '40%',
            fontSize: 40,
            opacity: 0.08,
            transform: [{ rotate: '-15deg' }],
          }}
        >
          🐾
        </Text>
      </View>

      <CenteredColumn maxWidth={540} withMargin={false} style={{ paddingHorizontal: 16 }}>
        {/* Avatar com overlap no banner — tap pra fullscreen */}
        <Animated.View
          entering={ZoomIn.springify().damping(10).mass(0.7)}
          style={{
            marginTop: -50,
            alignItems: 'center',
          }}
        >
          <PressScale
            onPress={() => pet.avatar_url && setAvatarOpen(true)}
            style={{
              padding: 4,
              borderRadius: 999,
              backgroundColor: theme.surface,
              shadowColor: '#7C2D12',
              shadowOpacity: 0.15,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            <PetAvatar pet={pet} size={108} />
          </PressScale>
        </Animated.View>

        {/* Nome + identidade */}
        <View style={{ alignItems: 'center', marginTop: 12, gap: 6 }}>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 30,
              color: theme.text,
              letterSpacing: -0.5,
            }}
          >
            {pet.name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: theme.brandLight,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.brandDark }}>
                {speciesLabel(pet.species)}
              </Text>
              {pet.breed ? (
                <>
                  <Text style={{ fontSize: 10, color: theme.brandDark, opacity: 0.6 }}>·</Text>
                  <Text
                    style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.brandDark }}
                  >
                    {pet.breed}
                  </Text>
                </>
              ) : null}
            </View>
            {ageText ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                · {ageText}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Bio */}
        {pet.bio ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 21,
              color: theme.textMuted,
              textAlign: 'center',
              marginTop: 12,
              paddingHorizontal: 16,
            }}
          >
            {pet.bio}
          </Text>
        ) : null}

        {/* Personality / Temperament badges */}
        {personality || pet.social_temperament ? (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
              marginTop: 12,
              flexWrap: 'wrap',
            }}
          >
            {personality ? (
              <Link
                href={{ pathname: '/pet/[id]/quiz' as never, params: { id: pet.id } as never }}
                asChild
              >
                <PressScale
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: '#F3E8FF',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>{personality.emoji}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#7C3AED' }}>
                    {personality.label}
                  </Text>
                </PressScale>
              </Link>
            ) : null}
            {pet.social_temperament ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#F5F5F5',
                }}
              >
                <Text style={{ fontSize: 14 }}>{temperamentEmoji(pet.social_temperament)}</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#404040' }}>
                  {temperamentLabel(pet.social_temperament)}
                </Text>
              </View>
            ) : null}
            {!personality && isOwn ? (
              <Link
                href={{ pathname: '/pet/[id]/quiz' as never, params: { id: pet.id } as never }}
                asChild
              >
                <PressScale
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: '#FEF3C7',
                    borderWidth: 1,
                    borderColor: '#FCD34D',
                    borderStyle: 'dashed',
                  }}
                >
                  <Text style={{ fontSize: 14 }}>🧠</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#92400E' }}>
                    Faça o quiz
                  </Text>
                </PressScale>
              </Link>
            ) : null}
          </View>
        ) : null}

        {/* Stats em pills — agora com NumberCounter animado */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            marginTop: 16,
            paddingHorizontal: 4,
          }}
        >
          <View style={{ flex: 1 }}>
            <StatPill label="publicações" singular="publicação" value={stats.posts_count} />
          </View>
          <Link href={{ pathname: '/pet/[id]/followers', params: { id: pet.id } }} asChild>
            <PressScale style={{ flex: 1 }} scale={0.95}>
              <StatPill label="seguidores" singular="seguidor" value={stats.followers_count} />
            </PressScale>
          </Link>
          <Link href={{ pathname: '/pet/[id]/following', params: { id: pet.id } }} asChild>
            <PressScale style={{ flex: 1 }} scale={0.95}>
              <StatPill label="seguindo" value={stats.following_count} />
            </PressScale>
          </Link>
        </View>

        {/* Action buttons */}
        {!isOwn ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={isFollowing ? 'Deixar de seguir' : '+ Seguir'}
                variant={isFollowing ? 'secondary' : 'primary'}
                onPress={onFollow}
                loading={followLoading}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Mensagem"
                variant="secondary"
                onPress={onMessage}
                loading={messageLoading}
                fullWidth
              />
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Editar perfil"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })
                }
                fullWidth
              />
            </View>
            <PressScale
              onPress={() =>
                router.push({
                  pathname: '/pet/[id]/time-capsule' as never,
                  params: { id: pet.id } as never,
                })
              }
              style={{
                width: 48,
                borderRadius: 12,
                backgroundColor: '#1A1410',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="film-outline" size={20} color="#F59E0B" />
            </PressScale>
          </View>
        )}
      </CenteredColumn>

      {/* Avatar fullscreen */}
      {pet.avatar_url ? (
        <ImageViewer
          visible={avatarOpen}
          onClose={() => setAvatarOpen(false)}
          url={pet.avatar_url}
        />
      ) : null}
    </View>
  );
}

function StatPill({
  label,
  singular,
  value,
}: {
  label: string;
  singular?: string;
  value: number;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: theme.borderLight,
        paddingVertical: 10,
        borderRadius: 14,
      }}
    >
      <NumberCounter
        value={value}
        formatter={formatCount}
        style={{
          fontFamily: FONTS.display,
          fontSize: 20,
          color: theme.text,
          letterSpacing: -0.5,
        }}
      />
      <Text
        style={{
          fontFamily: FONTS.bodyMedium,
          fontSize: 10,
          color: theme.textDim,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginTop: -2,
        }}
      >
        {value === 1 && singular ? singular : label}
      </Text>
    </View>
  );
}
