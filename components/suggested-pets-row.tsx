import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { fetchSuggestedPets, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { CenteredColumn } from './ui/centered-column';
import { PressScale } from './ui/press-scale';

/**
 * Carousel horizontal com pets sugeridos.
 * Cards 140px com avatar 72px ringed, nome, espécie e badge de seguidores.
 */
export function SuggestedPetsRow() {
  const { activePet } = useActivePet();
  const { theme } = useTheme();

  const query = useQuery({
    queryKey: activePet ? qk.suggestedPets(activePet.id) : ['suggested-pets', 'none'],
    queryFn: () => fetchSuggestedPets(activePet!.id),
    enabled: !!activePet,
  });

  if (!query.data || query.data.length === 0) return null;

  return (
    <View style={{ marginTop: 18 }}>
      <CenteredColumn maxWidth={540}>
        <View style={{ marginBottom: 10 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: theme.brand,
              textTransform: 'uppercase',
            }}
          >
            Você pode gostar
          </Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 20,
              color: theme.text,
              marginTop: 1,
              letterSpacing: -0.3,
            }}
          >
            Pets pra seguir 🐾
          </Text>
        </View>
      </CenteredColumn>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 14, paddingBottom: 4 }}
      >
        {query.data.map((pet) => (
          <Link
            key={pet.id}
            href={{ pathname: '/pet/[id]', params: { id: pet.id } }}
            asChild
          >
            <PressScale
              style={{
                width: 142,
                backgroundColor: theme.surface,
                borderRadius: 18,
                padding: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.borderLight,
              }}
            >
              {/* Avatar com ring tonal */}
              <View
                style={{
                  padding: 3,
                  borderRadius: 999,
                  backgroundColor: theme.brandLight,
                }}
              >
                <PetAvatar pet={pet} size={66} />
              </View>

              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 14,
                  color: theme.text,
                  marginTop: 8,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {pet.name}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.textDim,
                  marginTop: 1,
                  textAlign: 'center',
                }}
                numberOfLines={1}
              >
                {speciesLabel(pet.species)}
                {pet.breed ? ` · ${pet.breed}` : ''}
              </Text>

              {pet.followers_count > 0 ? (
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: theme.brandSurface,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <Text style={{ fontSize: 9 }}>👥</Text>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 10,
                      color: theme.brandDark,
                    }}
                  >
                    {pet.followers_count}
                  </Text>
                </View>
              ) : (
                <View style={{ height: 16, marginTop: 6 }} />
              )}
            </PressScale>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}
