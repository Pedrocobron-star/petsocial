import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetListItem } from '@/components/pet-list-item';
import { FONTS } from '@/lib/fonts';
import { fetchFollowing, fetchPet, qk } from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

export default function FollowingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const followingQuery = useQuery({
    queryKey: qk.following(id),
    queryFn: () => fetchFollowing(id),
    enabled: !!id,
  });

  const title = petQuery.data ? `${petQuery.data.name} segue` : 'Seguindo';
  const data = followingQuery.data ?? [];
  const count = data.length;

  const onRefresh = async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: qk.following(id) });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PetListItem pet={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.borderLight }} />}
        contentContainerStyle={{ flexGrow: 1 }}
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
            <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.surface }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                Seguindo {count} {count === 1 ? 'pet' : 'pets'}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          followingQuery.isLoading ? (
            <View style={{ paddingTop: 48, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={theme.brand} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Carregando...
              </Text>
            </View>
          ) : (
            <EmptyState
              emoji="👀"
              title="Ainda não segue ninguém"
              description="Vá no Explore pra descobrir pets bacanas."
            />
          )
        }
      />
    </View>
  );
}
