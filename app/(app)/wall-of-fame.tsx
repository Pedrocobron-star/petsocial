import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { CenteredColumn } from '@/components/ui/centered-column';
import { WallOfFameCard } from '@/components/wall-of-fame-card';
import { WallOfFamePodium } from '@/components/wall-of-fame-podium';
import { FONTS } from '@/lib/fonts';
import { fetchWallOfFame, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

export default function WallOfFameScreen() {
  const { activePet } = useActivePet();
  const { theme } = useTheme();

  const query = useQuery({
    queryKey: qk.wallOfFame(),
    queryFn: () => fetchWallOfFame(activePet!.id),
    enabled: !!activePet,
  });

  const posts = query.data ?? [];
  const top3 = posts.slice(0, 3);
  const rest = posts.slice(3);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Wall of Fame' }} />

      <FlatList
        data={rest}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 8 }}>
              <WallOfFameCard post={item} rank={index + 4} />
            </View>
          </CenteredColumn>
        )}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <View>
            {/* Hero header com banner warm */}
            <View
              style={{
                backgroundColor: '#1A1410',
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: 32,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorações flutuantes */}
              <Text
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 16,
                  fontSize: 90,
                  opacity: 0.06,
                }}
              >
                🏆
              </Text>
              <Text
                style={{
                  position: 'absolute',
                  top: 36,
                  right: 24,
                  fontSize: 60,
                  opacity: 0.05,
                  transform: [{ rotate: '18deg' }],
                }}
              >
                ⭐
              </Text>
              <Text
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: '60%',
                  fontSize: 44,
                  opacity: 0.05,
                  transform: [{ rotate: '-15deg' }],
                }}
              >
                ✨
              </Text>

              <CenteredColumn maxWidth={540} withMargin={false}>
                <Animated.View entering={FadeInDown.duration(400)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ fontSize: 36 }}>🏆</Text>
                    <View>
                      <Text
                        style={{
                          fontFamily: FONTS.display,
                          fontSize: 28,
                          color: '#fff',
                          letterSpacing: -0.5,
                        }}
                      >
                        Wall of Fame
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 13,
                          color: '#D4D4D4',
                          marginTop: 2,
                        }}
                      >
                        Posts mais curtidos dos últimos 7 dias
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </CenteredColumn>
            </View>

            {/* Podium top 3 */}
            {top3.length > 0 ? (
              <View style={{ paddingHorizontal: 14, marginTop: 16 }}>
                <WallOfFamePodium posts={top3} />
              </View>
            ) : null}

            {/* Section header pros próximos */}
            {rest.length > 0 ? (
              <CenteredColumn maxWidth={540}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 24,
                    marginBottom: 6,
                  }}
                >
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      color: theme.textDim,
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                    }}
                  >
                    Honraria menção
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
                </View>
              </CenteredColumn>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          posts.length === 0 && !query.isLoading ? (
            <EmptyState
              emoji="🏆"
              mozart="comemorando"
              title="Ainda sem destaques"
              description="Os posts mais curtidos da semana aparecem aqui. Convide os amigos pra postar!"
            />
          ) : null
        }
      />
    </View>
  );
}
