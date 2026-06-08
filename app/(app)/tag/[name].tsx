import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PostCard } from '@/components/post-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { FONTS } from '@/lib/fonts';
import { fetchPostsByHashtag, qk } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

type TagSort = 'recent' | 'top';
const SORTS: { value: TagSort; label: string }[] = [
  { value: 'recent', label: 'Recentes' },
  { value: 'top', label: 'Top 🔥' },
];

export default function HashtagScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { activePet } = useActivePet();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<TagSort>('recent');

  const postsQuery = useQuery({
    queryKey: qk.hashtag(name),
    queryFn: () => fetchPostsByHashtag(name, activePet!.id),
    enabled: !!name && !!activePet,
  });

  // "Top" reordena por curtidas (desempate por comentários) o conjunto já
  // carregado; "Recentes" mantém a ordem do servidor (created_at desc).
  const posts = useMemo(() => {
    const list = postsQuery.data ?? [];
    if (sort !== 'top') return list;
    return [...list].sort(
      (a, b) =>
        b.likes_count - a.likes_count || b.comments_count - a.comments_count,
    );
  }, [postsQuery.data, sort]);

  const onRefresh = async () => {
    if (!name) return;
    setRefreshing(true);
    try {
      await qc.invalidateQueries({ queryKey: qk.hashtag(name) });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: `#${name}` }} />
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: theme.brandLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24 }}>#️⃣</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.text }}>
            #{name}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
      </View>
      {posts.length > 1 ? (
        <View style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.borderLight }}>
          <SegmentedControl options={SORTS} value={sort} onChange={setSort} />
        </View>
      ) : null}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
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
        ListEmptyComponent={
          postsQuery.isLoading ? (
            <View style={{ paddingTop: 48, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={theme.brand} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Carregando posts de #{name}...
              </Text>
            </View>
          ) : (
            <EmptyState
              emoji="🔍"
              title="Nada por aqui ainda"
              description={`Seja o primeiro a postar com #${name}!`}
            />
          )
        }
      />
    </View>
  );
}
