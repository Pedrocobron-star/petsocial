import { ScrollView, Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import type { Pet } from '@/lib/types';

import { PetAvatar } from './pet-avatar';
import { PressScale } from './ui/press-scale';

interface Props {
  pets: Pet[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PetPicker({ pets, selectedId, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-4 py-2">
      {pets.map((pet) => {
        const active = pet.id === selectedId;
        return (
          <PressScale
            key={pet.id}
            onPress={() => onSelect(pet.id)}
            scale={0.94}
            style={{
              alignItems: 'center',
              borderRadius: 18,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: active ? '#FFEDD5' : '#F5F5F5',
            }}
          >
            <PetAvatar
              pet={pet}
              size={44}
              ring={active}
              pulse={active}
              animation={active ? 'pulse' : 'breathe'}
            />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: active ? FONTS.bodyBold : FONTS.bodyMedium,
                fontSize: 11,
                color: active ? '#C2410C' : '#525252',
                marginTop: 4,
                maxWidth: 64,
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
