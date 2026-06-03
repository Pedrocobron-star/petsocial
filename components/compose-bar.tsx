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
 * Convida o user a postar sem precisar ir até o tab Postar.
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
          gap: 10,
          marginVertical: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: theme.surface,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <PetAvatar pet={pet} size={36} animation="bob" />
        <Text
          style={{
            flex: 1,
            fontFamily: FONTS.body,
            fontSize: 13.5,
            color: theme.textDim,
          }}
        >
          Compartilha algo com {pet.name}...
        </Text>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: theme.brandLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="camera" size={18} color={theme.brand} />
        </View>
      </Pressable>
    </Link>
  );
}
