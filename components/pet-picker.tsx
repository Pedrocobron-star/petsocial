import { ScrollView, Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { PressScale } from './ui/press-scale';

interface Props {
  pets: Pet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PetPicker({ pets, selectedId, onSelect }: Props) {
  const { theme } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-1.5">
      {pets.map((pet) => {
        const active = pet.id === selectedId;
        return (
          <PressScale
            key={pet.id}
            onPress={() => onSelect(pet.id)}
            accessibilityRole="radio"
            accessibilityLabel={pet.name}
            accessibilityState={{ selected: active }}
            scale={0.94}
            style={{
              alignItems: 'center',
              borderRadius: 16,
              paddingHorizontal: 10,
              paddingVertical: 5,
              backgroundColor: active ? theme.brandSurface : theme.borderLight,
            }}
          >
            <PetAvatar
              pet={pet}
              size={38}
              ring={active}
              pulse={active}
            />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: active ? FONTS.bodyBold : FONTS.bodyMedium,
                fontSize: 11,
                color: active ? theme.brand : theme.textMuted,
                marginTop: 3,
                maxWidth: 60,
              }}
            >
              {pet.name}
            </Text>
          </PressScale>
        );
      })}
    </ScrollView>
  );
}
