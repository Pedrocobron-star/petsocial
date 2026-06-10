import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchFollowing, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { CenteredColumn } from './ui/centered-column';

/**
 * Linha horizontal de stories no topo do feed.
 * Mostra pets que você segue como "stories" navegáveis (clica → vai no perfil).
 * Compacta pra não roubar espaço do conteúdo no mobile.
 */
export function StoriesRing() {
  const { theme } = useTheme();
  const { activePet } = useActivePet();

  const followingQuery = useQuery({
    queryKey: activePet ? qk.following(activePet.id) : ['following', 'none'],
    queryFn: () => fetchFollowing(activePet!.id),
    enabled: !!activePet,
  });

  const pets = followingQuery.data ?? [];
  const yourPet = activePet;

  if (!yourPet) return null;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
        paddingVertical: 8,
      }}
    >
      <CenteredColumn maxWidth={720} withMargin={false}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 10 }}
        >
          {/* Seu pet — atalho pra criar post */}
          <Link href="/(app)/(tabs)/create" asChild>
            <Pressable style={{ alignItems: 'center', gap: 4, width: 54 }}>
              <View style={{ position: 'relative' }}>
                <PetAvatar pet={yourPet} size={44} />
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: theme.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.surface,
                  }}
                >
                  <Ionicons name="add" size={12} color="#fff" />
                </View>
              </View>
              <Text
                style={{ fontFamily: FONTS.bodyBold, fontSize: 10.5, color: theme.text, maxWidth: 52 }}
                numberOfLines={1}
              >
                Você
              </Text>
            </Pressable>
          </Link>

          {pets.map((p) => (
            <Link key={p.id} href={{ pathname: '/pet/[id]', params: { id: p.id } }} asChild>
              <Pressable style={{ alignItems: 'center', gap: 4, width: 54 }}>
                <PetAvatar pet={p} size={44} rainbow />
                <Text
                  style={{ fontFamily: FONTS.body, fontSize: 10.5, color: theme.textDim, maxWidth: 52 }}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </Pressable>
            </Link>
          ))}
        </ScrollView>
      </CenteredColumn>
    </View>
  );
}
