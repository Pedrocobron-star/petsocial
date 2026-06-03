import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComposeBar } from '@/components/compose-bar';
import { DailyChallengeCard } from '@/components/daily-challenge-card';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FeedHeader } from '@/components/feed-header';
import { HealthRemindersBanner } from '@/components/health-reminders-banner';
import { OnboardingTour } from '@/components/onboarding-tour';
import { PetPicker } from '@/components/pet-picker';
import { PostCard } from '@/components/post-card';
import { PostSkeleton } from '@/components/post-skeleton';
import { RecallBanner } from '@/components/recall-banner';
import { SponsoredPostCard } from '@/components/sponsored-post-card';
import { StoriesRing } from '@/components/stories-ring';
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
  const userId = session?.user.id;

  const feedQuery = useQuery({
    queryKey: activePet ? qk.feed(activePet.id, filter) : ['feed', 'none', filter],
    queryFn: () => fetchFeed(activePet!.id, filter),
    enabled: !!activePet,
  });

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
    refetchInterval: 30_000,
  });

  const unreadMsgQuery = useQuery({
    queryKey: userId ? qk.unreadMessages(userId) : ['unread-messages', 'anon'],
    queryFn: () => fetchUnreadMessageCount(userId!),
    enabled: !!userId,
    refetchInterval: 30_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['feed'] }),
      userId ? qc.invalidateQueries({ queryKey: qk.unreadCount(userId) }) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  const unread = unreadQuery.data ?? 0;
  const unreadMsg = unreadMsgQuery.data ?? 0;

  // Intercala sponsored a cada 5 posts orgânicos
  const feedItems: FeedItem<PostWithDetails>[] = interleaveSponsored(
    feedQuery.data ?? [],
    sponsoredQuery.data ?? [],
    5,
  );

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

      {feedQuery.isLoading && (feedQuery.data ?? []).length === 0 ? (
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
              <PostCard post={item.data} />
            )
          }
          refreshControl={<PawRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 24, flexGrow: 1 }}
          ListHeaderComponent={
            <>
              <StoriesRing />
              <RecallBanner />
              <HealthRemindersBanner />
              {activePet ? <ComposeBar pet={activePet} /> : null}
              <DailyChallengeCard />
            </>
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🦴"
              title="Sem posts ainda"
              description="Posta a primeira foto ou siga outros pets pra ver o feed encher."
              action={
                <Link href="/(app)/(tabs)/create" asChild>
                  <Button title="Criar primeiro post" />
                </Link>
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
