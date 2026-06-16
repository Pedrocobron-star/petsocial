import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';

interface Props {
  pet: Pet;
  subtitle?: string;
}

export function PetListItem({ pet, subtitle }: Props) {
  const { theme } = useTheme();
  const meta = subtitle ?? `${speciesLabel(pet.species)}${pet.breed ? ` • ${pet.breed}` : ''}`;
  return (
    <Link href={{ pathname: '/pet/[id]', params: { id: pet.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver perfil de ${pet.name}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.surface,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <PetAvatar pet={pet} size={48} />
        <View className="flex-1">
          <Text
            numberOfLines={1}
            style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}
          >
            {pet.name}
          </Text>
          <Text
            style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}
            numberOfLines={1}
          >
            {meta}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
