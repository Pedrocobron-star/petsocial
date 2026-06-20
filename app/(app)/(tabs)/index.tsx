import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DailyMissionCard } from '@/components/daily-mission-card';
import { EmptyState } from '@/components/empty-state';
import { EngagementNudge } from '@/components/engagement-nudge';
import { Fab } from '@/components/fab';
import { FeedEngagementNudge } from '@/components/feed-engagement-nudge';
import { FeedHeader } from '@/components/feed-header';
import { HealthRemindersBanner } from '@/components/health-reminders-banner';
import { OnboardingTour } from '@/components/onboarding-tour';
import { PetPicker } from '@/components/pet-picker';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/post-skeleton';
import { RecallBanner } from '@/components/recall-banner';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PawRefreshControl, PawRefreshOverlay } from '@/components/ui/paw-refresh-control';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  fetchFeed,
  fetchUnreadMessageCount,
  fetchUnreadNotificationCount,
  qk,
  type FeedFilter,
} from '@/lib/queries';
import {
  fetchActiveSponsoredPosts,
  interleaveSponsored,
  type FeedItem,
} from '@/lib/sponsored';
import type { PostWithDetails } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const FEED_FILTERS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Para você' },
  { value: 'following', label: 'Quem sigo' },
  { value: 'top_week', label: 'Top semana 🔥' },
];

export default function FeedScreen() {
  const { session } = useSession();
  const { pets, activePet, setActivePet } = useActivePet();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const userId = session?.user.id;

  const feedQuery = useInfiniteQuery({
    queryKey: activePet ? qk.feed(activePet.id, filter) : ['feed', 'none', filter],
    queryFn: ({ pageParam }) => fetchFeed(activePet!.id, filter, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!activePet,
    staleTime: 60_000,
  });

  // Achata as páginas num array só de posts pro interleave + render.
  const posts = feedQuery.data?.pages.flatMap((p) => p.items) ?? [];

  // Sponsored posts ativos — buscados em paralelo, cache de 2min
  const sponsoredQuery = useQuery({
    queryKey: ['sponsored-active'],
    queryFn: () => fetchActiveSponsoredPosts(10),
    staleTime: 2 * 60_000,
  });

  const unreadQuery = useQuery({
    queryKey: userId ? qk.unreadCount(userId) : ['unread-count', 'anon'],
    queryFn: () => fetchUnreadNotificationCount(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unreadMsgQuery = useQuery({
    queryKey: userId ? qk.unreadMessages(userId) : ['unread-messages', 'anon'],
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: !!userId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['feed'] }),
      qc.invalidateQueries({ queryKey: ['sponsored-active'] }),
      userId ? qc.invalidateQueries({ queryKey: qk.unreadCount(userId) }) : Promise.resolve(),
      userId ? qc.invalidateQueries({ queryKey: qk.unreadMessages(userId) }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const unread = unreadQuery.data ?? 0;
  const unreadMsg = unreadMsgQuery.data ?? 0;

  // Intercala sponsored a cada 5 posts orgânicos
  const feedItems: FeedItem<PostWithDetails>[] = interleaveSponsored(
    posts,
    sponsoredQuery.data ?? [],
    5,
  );

  // Viewability: só o post visível dá autoplay no vídeo (estilo Instagram).
  // Refs estáveis — FlatList não aceita trocar esses callbacks em runtime.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems.find((v) => v.isViewable);
      if (first?.key) setActiveKey(first.key);
    },
  ).current;
  // Fallback: enquanto a viewability não dispara, o 1º post orgânico é o ativo.
  const effectiveActiveKey =
    activeKey ?? feedItems.find((it) => it.kind !== 'sponsored')?.key ?? null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      <OnboardingTour />
      {/* Header full-width com filhos centralizados internamente via FeedHeader */}
      <View style={{ backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.borderLight }}>
        <CenteredColumn maxWidth={720} withMargin={false}>
          <FeedHeader unreadMessages={unreadMsg} unreadNotifications={unread} />
        </CenteredColumn>
      </View>

      {pets.length > 1 ? (
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.borderLight,
            backgroundColor: theme.surface,
          }}
        >
          <CenteredColumn maxWidth={720} withMargin={false}>
            <PetPicker pets={pets} selectedId={activePet?.id ?? null} onSelect={setActivePet} />
          </CenteredColumn>
        </View>
      ) : null}

      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
          backgroundColor: theme.surface,
        }}
      >
        <CenteredColumn maxWidth={720} withMargin={false}>
          <SegmentedControl options={FEED_FILTERS} value={filter} onChange={setFilter} />
        </CenteredColumn>
      </View>

      <Fab href="/(app)/(tabs)/create" icon="camera" />
      <PawRefreshOverlay refreshing={refreshing} />

      {feedQuery.isLoading && posts.length === 0 ? (
        <View style={{ paddingVertical: 8 }}>
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) =>
            item.kind === 'sponsored' ? (
              <SponsoredPostCard post={item.data} />
            ) : (
              <PostCard post={item.data} isActive={item.key === effectiveActiveKey} />
            )
          }
          extraData={effectiveActiveKey}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          refreshControl={<PawRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feedQuery.hasNextPage && !feedQuery.isFetchingNextPage) feedQuery.fetchNextPage();
          }}
          ListFooterComponent={
            feedQuery.isFetchingNextPage ? (
              <View style={{ paddingVertical: 12 }}>
                <PostSkeleton />
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 24, flexGrow: 1 }}
          ListHeaderComponent={
            <>
              <DailyMissionCard />
              <FeedEngagementNudge />
              <EngagementNudge />
              <RecallBanner />
              <HealthRemindersBanner />
            </>
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🦴"
              mozart="oi"
              title="Seja o primeiro!"
              description="Crie um post pro seu pet ou siga outros pets pra ver o feed encher."
              action={
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Link href="/(app)/(tabs)/create" asChild>
                    <Button title="Postar foto" />
                  </Link>
                  <Link href="/(app)/(tabs)/explore" asChild>
                    <Button title="Descobrir pets" variant="secondary" />
                  </Link>
                </View>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
