import { Image } from 'expo-image';
import { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { speciesLabel } from '@/lib/constants';
import type { Pet } from '@/lib/types';

import { Pet3DEmoji } from './pet-3d-emoji';

interface Props {
  pet: Pick<Pet, 'avatar_url' | 'species' | 'name'> & {
    id?: string;
    birthdate?: string | null;
    memorial_at?: string | null;
    personality_type?: string | null;
  };
  size?: number;
  ring?: boolean;
  /** Pulse ring animado (uso pra pet ativo / online status) */
  pulse?: boolean;
  /** Anel com gradiente colorido (estilo Instagram Stories) */
  rainbow?: boolean;
}

const PERSONALITY_RING_COLOR: Record<string, string> = {
  adventurer: '#F97316',
  cuddler: '#EC4899',
  playful: '#9333EA',
  shy: '#3B82F6',
  independent: '#16A34A',
  royal: '#F59E0B',
};

function PetAvatarInner({
  pet,
  size = 40,
  ring = false,
  pulse = false,
  rainbow = false,
}: Props) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  // Pulse ring animation
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (!pulse) return;
    pulseScale.value = withRepeat(
      withTiming(1.25, { duration: 1500, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    pulseOpacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [pulse, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  // Personality color ou memorial → cor do ring
  const personalityColor = pet.personality_type ? PERSONALITY_RING_COLOR[pet.personality_type] : null;
  const isMemorial = !!pet.memorial_at;

  // A11y label — leitor de tela descreve o avatar
  const a11yLabel = isMemorial
    ? `Avatar de ${pet.name}, ${speciesLabel(pet.species)}, em memória`
    : `Avatar de ${pet.name}, ${speciesLabel(pet.species)}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={a11yLabel}
      style={{ position: 'relative', width: size, height: size }}
    >
      {pulse ? (
        <Animated.View
          style={[
            pulseStyle,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: 3,
              borderColor: '#F97316',
            },
          ]}
          pointerEvents="none"
        />
      ) : null}
      {/* Rainbow / personality ring (gradiente fake com borda colorida) */}
      {(rainbow || personalityColor) && !isMemorial ? (
        <View
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            borderWidth: 2.5,
            borderColor: rainbow ? '#9333EA' : personalityColor ?? '#F97316',
          }}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={dims}
        className={`items-center justify-center overflow-hidden bg-brand-light ${
          ring && !rainbow && !personalityColor ? 'border-2 border-brand' : ''
        }`}
      >
        {pet.avatar_url ? (
          <Image
            source={{ uri: pet.avatar_url }}
            style={[dims, isMemorial ? { opacity: 0.5 } : null]}
            contentFit="cover"
          />
        ) : (
          <Pet3DEmoji species={pet.species} size={size * 0.92} dimmed={isMemorial} />
        )}
        {isMemorial ? (
          <View
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: (size * 0.4) / 2,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: size * 0.28 }}>🌈</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Comparator: shallow no pet (Pick<Pet> ainda é plano) + primitives.
 * Listas de pets (feed, followers, etc) ganham re-renders skipados quando
 * parent atualiza state local que não afeta esse avatar.
 */
function arePetAvatarPropsEqual(prev: Props, next: Props): boolean {
  if (
    prev.size !== next.size ||
    prev.ring !== next.ring ||
    prev.pulse !== next.pulse ||
    prev.rainbow !== next.rainbow
  ) {
    return false;
  }
  // Pet shallow — compara só campos que afetam render
  const a = prev.pet;
  const b = next.pet;
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.avatar_url === b.avatar_url &&
    a.species === b.species &&
    a.name === b.name &&
    (a as { id?: string }).id === (b as { id?: string }).id &&
    a.memorial_at === b.memorial_at &&
    a.personality_type === b.personality_type
  );
}

export const PetAvatar = memo(PetAvatarInner, arePetAvatarPropsEqual);
