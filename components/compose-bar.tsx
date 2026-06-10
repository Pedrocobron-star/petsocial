import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Dimensions, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';

interface Props {
  pet: Pet;
}

/**
 * "Compartilha algo com o Mozart..." — barra fake do compose, igual ao Threads/Facebook.
 * Convida o user a postar sem precisar ir até o tab Postar. Compacta (1 linha) pra caber no mobile.
 */
export function ComposeBar({ pet }: Props) {
  const { theme } = useTheme();
  const SCREEN_W = Dimensions.get('window').width;
  const width = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);

  return (
    <Link href="/(app)/(tabs)/create" asChild>
      <Pressable
        style={{
          width,
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginVertical: 7,
          paddingHorizontal: 10,
          paddingVertical: 7,
          backgroundColor: theme.surface,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <PetAvatar pet={pet} size={30} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: FONTS.body,
            fontSize: 13,
            color: theme.textDim,
          }}
        >
          Compartilha algo com {pet.name}...
        </Text>
        <View
          accessibilityRole="button"
          accessibilityLabel="Adicionar foto"
          hitSlop={8}
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: theme.brandLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="camera" size={16} color={theme.brand} />
        </View>
      </Pressable>
    </Link>
  );
}
