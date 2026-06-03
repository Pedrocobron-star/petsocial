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
 * Por enquanto: mostra pets que você segue como "stories" navegáveis (clica → vai no perfil).
 * Quando Stories real for implementado, vira o ponto de entrada das histórias.
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
  // Inclui o próprio pet ativo no início
  const yourPet = activePet;

  if (!yourPet) return null;

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
        paddingVertical: 12,
      }}
    >
      <CenteredColumn maxWidth={720} withMargin={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
      >
        {/* Seu pet — botão "+" pra criar story (placeholder por enquanto) */}
        <Link href="/(app)/(tabs)/create" asChild>
          <Pressable style={{ alignItems: 'center', gap: 6, width: 68 }}>
            <View style={{ position: 'relative' }}>
              <PetAvatar pet={yourPet} size={58} animation="pulse" />
              <View
                style={{
                  position: 'absolute',
                  right: -2,
                  bottom: -2,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: theme.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2.5,
                  borderColor: theme.surface,
                }}
              >
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                color: theme.text,
                maxWidth: 60,
              }}
              numberOfLines={1}
            >
              Você
            </Text>
          </Pressable>
        </Link>

        {pets.map((p) => (
          <Link
            key={p.id}
            href={{ pathname: '/pet/[id]', params: { id: p.id } }}
            asChild
          >
            <Pressable style={{ alignItems: 'center', gap: 6, width: 68 }}>
              <PetAvatar pet={p} size={58} rainbow animation="breathe" />
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.textDim,
                  maxWidth: 60,
                }}
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
