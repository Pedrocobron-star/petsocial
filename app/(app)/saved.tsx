import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PostCard } from '@/components/post-card';
import { FONTS } from '@/lib/fonts';
import { fetchSavedPosts, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

export default function SavedPostsScreen() {
  const { session } = useSession();
  const { activePet } = useActivePet();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const [refreshing, setRefreshing] = useState(false);

  const savedQuery = useQuery({
    queryKey: userId ? qk.savedPostsFeed(userId) : ['saved-posts-feed', 'anon'],
    queryFn: () => fetchSavedPosts(userId!, activePet!.id),
    enabled: !!userId && !!activePet,
  });

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: qk.savedPostsFeed(userId) });
    } finally {
      setRefreshing(false);
    }
  };

  const data = savedQuery.data ?? [];
  const count = data.length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        }
        ListHeaderComponent={
          count > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.textDim,
                }}
              >
                {count} {count === 1 ? 'post salvo' : 'posts salvos'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          savedQuery.isLoading ? (
            <View style={{ paddingTop: 48, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={theme.brand} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Carregando salvos...
              </Text>
            </View>
          ) : (
            <EmptyState
              emoji="🔖"
              title="Sem salvos ainda"
              description="Toca no ícone de marcador em qualquer post pra guardar pra ver depois. Ótimo pra lembrar de um truque, receita ou dica de cuidado."
              action={
                <Link href="/(app)/(tabs)" asChild>
                  <Pressable
                    accessibilityLabel="Ir pro feed"
                    style={{
                      backgroundColor: '#F97316',
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.bodyBold, color: '#FFFFFF', fontSize: 13 }}>
                      Explorar feed
                    </Text>
                  </Pressable>
                </Link>
              }
            />
          )
        }
      />
    </View>
  );
}
