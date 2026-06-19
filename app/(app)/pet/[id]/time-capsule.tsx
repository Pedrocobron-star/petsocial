import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Dimensions, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { PetAvatar } from '@/components/pet-avatar';
import { usePetHealthGate } from '@/components/pet-health-gate';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { fetchTimeCapsule, qk } from '@/lib/queries';
import { petUrl } from '@/lib/share';
import { ScreenLoading } from '@/components/screen-loading';
import { useTheme } from '@/providers/theme-provider';

const { width: SCREEN_W } = Dimensions.get('window');

export default function TimeCapsuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const router = useRouter();

  const query = useQuery({
    queryKey: qk.timeCapsule(id),
    queryFn: () => fetchTimeCapsule(id),
    enabled: !!id,
  });

  if (healthGate) return healthGate;
  if (query.isLoading) return <ScreenLoading />;
  if (!query.data) return null;
  const { pet, topPosts, stats, monthlyHighlights } = query.data;

  const onShare = async () => {
    try {
      await Share.share({
        title: `${pet.name} em retrospectiva`,
        message: `📼 ${stats.daysActive} dias com ${pet.name}!\n📸 ${stats.postsCount} posts\n❤️ ${stats.likesReceived} curtidas\n\nVeja o ano completo no Maestro Pet:\n${petUrl(pet.id)}`,
      });
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : '');
    }
  };

  const grid3x3Size = (SCREEN_W - 40 - 16) / 3;

  return (
    <View style={{ flex: 1, backgroundColor: '#1A1410' }}>
      <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: '#fff' }} />
      <ScrollView contentContainerStyle={{ paddingTop: 70, paddingBottom: 40 }}>
        {/* Hero */}
        <View style={{ alignItems: 'center', paddingHorizontal: 20, gap: 14 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 2,
              color: '#F59E0B',
              textTransform: 'uppercase',
            }}
          >
            ✨ Pet Capsule ✨
          </Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 32,
              color: '#fff',
              textAlign: 'center',
            }}
          >
            Um ano com{'\n'}
            <Text style={{ color: '#F59E0B' }}>{pet.name}</Text>
          </Text>
          <View style={{ marginTop: 8 }}>
            <PetAvatar pet={pet} size={120} ring />
          </View>
        </View>

        {/* Stats */}
        <View style={{ marginTop: 32, paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <StatCard label="Dias juntos" value={stats.daysActive} emoji="📅" color="#F59E0B" />
          <StatCard label="Posts" value={stats.postsCount} emoji="📸" color="#EC4899" />
          <StatCard label="Curtidas" value={stats.likesReceived} emoji="❤️" color="#EF4444" />
          <StatCard label="Comentários" value={stats.commentsReceived} emoji="💬" color="#3B82F6" />
          {stats.placesVisited > 0 ? (
            <StatCard label="Encontros" value={stats.placesVisited} emoji="🗺️" color="#16A34A" />
          ) : null}
        </View>

        {/* Top posts grid 3x3 */}
        {topPosts.length > 0 ? (
          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.6,
                color: '#F59E0B',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              🏆 Top {Math.min(topPosts.length, 9)} momentos
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {topPosts.slice(0, 9).map((post) => {
                const cover = post.media[0];
                if (!cover) return null;
                return (
                  <View
                    key={post.id}
                    style={{
                      width: grid3x3Size,
                      height: grid3x3Size,
                      borderRadius: 10,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <Image
                      source={{ uri: cover.url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                    {post.likes_count > 0 ? (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          left: 4,
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Ionicons name="heart" size={10} color="#EF4444" />
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#fff' }}>
                          {post.likes_count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Monthly histogram */}
        {monthlyHighlights.length > 0 ? (
          <View style={{ marginTop: 32, paddingHorizontal: 20 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.6,
                color: '#F59E0B',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              📊 Atividade mensal
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                gap: 6,
                height: 100,
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: 12,
                borderRadius: 12,
              }}
            >
              {monthlyHighlights.map((m) => {
                const maxCount = Math.max(...monthlyHighlights.map((x) => x.postCount));
                const height = (m.postCount / Math.max(maxCount, 1)) * 70;
                return (
                  <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                    <View
                      style={{
                        width: '100%',
                        height: Math.max(height, 4),
                        backgroundColor: '#F59E0B',
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                      }}
                    />
                    <Text style={{ fontFamily: FONTS.body, fontSize: 9, color: '#A3A3A3' }}>
                      {m.month.slice(5)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Share */}
        <View style={{ marginTop: 36, paddingHorizontal: 20, gap: 8 }}>
          <Pressable
            onPress={onShare}
            style={{
              backgroundColor: '#F59E0B',
              borderRadius: 999,
              paddingVertical: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="share" size={20} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#fff' }}>
              Compartilhar retrospectiva
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#A3A3A3' }}>Fechar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, emoji, color }: { label: string; value: number; emoji: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '30%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 14,
        padding: 14,
        gap: 4,
      }}
    >
      <Text style={{ fontSize: 22 }}>{emoji}</Text>
      <Text style={{ fontFamily: FONTS.display, fontSize: 26, color }}>
        {value.toLocaleString('pt-BR')}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 10,
          letterSpacing: 1,
          color: '#A3A3A3',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
