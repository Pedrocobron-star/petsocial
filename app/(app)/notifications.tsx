import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetAvatar } from '@/components/pet-avatar';
import { PawRefreshControl, PawRefreshOverlay } from '@/components/ui/paw-refresh-control';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { FONTS } from '@/lib/fonts';
import { fetchArticles, type NewsArticle } from '@/lib/news';
import { fetchNotifications, markAllNotificationsRead, qk } from '@/lib/queries';
import type { NotificationWithDetails } from '@/lib/types';
import { useHealthAlerts, type PetAlert } from '@/lib/use-health-alerts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

type Category = 'all' | 'social' | 'health' | 'news';

const FILTERS: { value: Category; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'social', label: 'Social' },
  { value: 'health', label: 'Saúde' },
  { value: 'news', label: 'Novidades' },
];

const CATEGORY_META: Record<Exclude<Category, 'all'>, { label: string; emoji: string }> = {
  health: { label: 'Saúde', emoji: '🩺' },
  social: { label: 'Social', emoji: '💬' },
  news: { label: 'Novidades', emoji: '📰' },
};

type Row =
  | { type: 'header'; key: string; label: string; emoji: string }
  | { type: 'social'; key: string; n: NotificationWithDetails }
  | { type: 'health'; key: string; alert: PetAlert }
  | { type: 'news'; key: string; article: NewsArticle };

export default function NotificationsScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<Category>('all');
  const [refreshing, setRefreshing] = useState(false);

  // --- Fontes ---
  const socialQuery = useQuery({
    queryKey: userId ? qk.notifications(userId) : ['notifications', 'anon'],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });
  const { alerts: healthAlerts } = useHealthAlerts(userId);
  const newsQuery = useQuery({
    queryKey: ['news', 'latest-notif'],
    queryFn: () => fetchArticles({ limit: 8 }),
    staleTime: 1000 * 60 * 10,
  });

  const social = useMemo(() => socialQuery.data ?? [], [socialQuery.data]);
  const news = useMemo(() => newsQuery.data ?? [], [newsQuery.data]);

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications(userId!) });
      qc.invalidateQueries({ queryKey: qk.unreadCount(userId!) });
    },
  });

  // Marca as sociais como lidas ao abrir
  useEffect(() => {
    if (userId) markAllMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const counts = useMemo(
    () => ({
      all: social.length + healthAlerts.length + news.length,
      social: social.length,
      health: healthAlerts.length,
      news: news.length,
    }),
    [social, healthAlerts, news],
  );

  const buildCategoryRows = useMemo(
    () =>
      (cat: Exclude<Category, 'all'>): Row[] => {
        if (cat === 'social') return social.map((n) => ({ type: 'social', key: `s-${n.id}`, n }));
        if (cat === 'health')
          return healthAlerts.map((a) => ({ type: 'health', key: `h-${a.pet.id}-${a.id}`, alert: a }));
        return news.map((art) => ({ type: 'news', key: `n-${art.id}`, article: art }));
      },
    [social, healthAlerts, news],
  );

  const rows = useMemo<Row[]>(() => {
    if (filter !== 'all') return buildCategoryRows(filter);
    const out: Row[] = [];
    (['health', 'social', 'news'] as const).forEach((cat) => {
      const items = buildCategoryRows(cat);
      if (!items.length) return;
      const meta = CATEGORY_META[cat];
      out.push({ type: 'header', key: `hdr-${cat}`, label: meta.label, emoji: meta.emoji });
      out.push(...items);
    });
    return out;
  }, [filter, buildCategoryRows]);

  const filtersWithCount = FILTERS.map((f) => ({
    ...f,
    label: counts[f.value] > 0 ? `${f.label} ${counts[f.value]}` : f.label,
  }));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      qc.invalidateQueries({ queryKey: qk.notifications(userId!) }),
      qc.invalidateQueries({ queryKey: ['news', 'latest-notif'] }),
    ]);
    setRefreshing(false);
  };

  const loading = socialQuery.isLoading && rows.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View
        style={{
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
          paddingTop: 4,
        }}
      >
        <SegmentedControl options={filtersWithCount} value={filter} onChange={setFilter} />
      </View>

      <PawRefreshOverlay refreshing={refreshing} />

      <FlatList
        data={rows}
        keyExtractor={(it) => it.key}
        renderItem={({ item }) => {
          if (item.type === 'header') return <SectionHeader label={item.label} emoji={item.emoji} />;
          if (item.type === 'social') return <SocialRow notification={item.n} />;
          if (item.type === 'health') return <HealthRow alert={item.alert} />;
          return <NewsRow article={item.article} />;
        }}
        refreshControl={<PawRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={({ leadingItem }) =>
          (leadingItem as Row)?.type !== 'header' ? (
            <View style={{ height: 1, backgroundColor: theme.borderLight }} />
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        ListHeaderComponent={<PushOptInBanner />}
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              emoji="🔔"
              mozart="dormindo"
              title="Sem notificações"
              description="Quando rolar curtida, lembrete de saúde ou novidade do portal, tudo aparece aqui."
            />
          )
        }
      />
    </View>
  );
}

/** CTA pra ativar push (notificações no celular mesmo com o app fechado). */
function PushOptInBanner() {
  const { theme } = useTheme();
  return (
    <Link href="/(app)/notification-settings" asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: theme.brandSurface,
          paddingHorizontal: 14,
          paddingVertical: 11,
          margin: 12,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: theme.brandLight,
        }}
      >
        <Ionicons name="notifications" size={18} color={theme.brand} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
            Receber no celular
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
            Ative pra ser avisado mesmo com o app fechado.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

function SectionHeader({ label, emoji }: { label: string; emoji: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
        backgroundColor: theme.bg,
      }}
    >
      <Text style={{ fontSize: 13 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          letterSpacing: 1.2,
          color: theme.brand,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SocialRow({ notification: n }: { notification: NotificationWithDetails }) {
  const router = useRouter();
  const { theme } = useTheme();
  if (!n.actor) return null;
  if (n.kind !== 'mention' && n.kind !== 'pet_tagged' && !n.target_pet) return null;

  const verb =
    n.kind === 'like'
      ? 'curtiu um post de'
      : n.kind === 'comment'
      ? 'comentou em um post de'
      : n.kind === 'follow'
      ? 'começou a seguir'
      : n.kind === 'pet_tagged'
      ? 'marcou seu pet num post'
      : 'mencionou você em um post';

  const icon =
    n.kind === 'like'
      ? { name: 'heart' as const, color: '#ef4444' }
      : n.kind === 'comment'
      ? { name: 'chatbubble' as const, color: '#3b82f6' }
      : n.kind === 'mention'
      ? { name: 'at' as const, color: '#8b5cf6' }
      : n.kind === 'pet_tagged'
      ? { name: 'pricetag' as const, color: '#F97316' }
      : { name: 'person-add' as const, color: '#F97316' };

  const onPress = () => {
    if (
      (n.kind === 'like' || n.kind === 'comment' || n.kind === 'mention' || n.kind === 'pet_tagged') &&
      n.post_id
    ) {
      router.push({ pathname: '/post/[id]', params: { id: n.post_id } });
    } else if (n.kind === 'follow' || n.kind === 'mention') {
      router.push({ pathname: '/pet/[id]', params: { id: n.actor!.id } });
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: n.read ? theme.surface : theme.brandSurface,
      }}
    >
      <View className="relative">
        <Link href={{ pathname: '/pet/[id]', params: { id: n.actor.id } }} asChild>
          <Pressable>
            <PetAvatar pet={n.actor} size={44} />
          </Pressable>
        </Link>
        <View
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            height: 20,
            width: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            backgroundColor: theme.surface,
            borderWidth: 1.5,
            borderColor: theme.bg,
          }}
        >
          <Ionicons name={icon.name} size={11} color={icon.color} />
        </View>
      </View>
      <View className="flex-1">
        <Text
          style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: theme.text }}
          numberOfLines={2}
        >
          <Text style={{ fontFamily: FONTS.bodyBold }}>{n.actor.name}</Text> {verb}
          {n.target_pet ? (
            <>
              {' '}
              <Text style={{ fontFamily: FONTS.bodyBold }}>{n.target_pet.name}</Text>
            </>
          ) : null}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </Text>
      </View>
    </Pressable>
  );
}

const SEVERITY_TINT: Record<PetAlert['severity'], { dot: string; bg: string }> = {
  urgent: { dot: '#DC2626', bg: '#FEE2E2' },
  warning: { dot: '#D97706', bg: '#FEF3C7' },
  info: { dot: '#2563EB', bg: '#DBEAFE' },
};

function HealthRow({ alert }: { alert: PetAlert }) {
  const { theme } = useTheme();
  const href = alert.action?.href ?? `/pet/${alert.pet.id}/health`;
  const tint = SEVERITY_TINT[alert.severity];
  return (
    <Link href={href as never} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: theme.surface,
        }}
      >
        <View className="relative">
          <PetAvatar pet={alert.pet} size={44} />
          <View
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              height: 20,
              width: 20,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: tint.bg,
              borderWidth: 1.5,
              borderColor: theme.bg,
            }}
          >
            <Text style={{ fontSize: 10 }}>{alert.emoji}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}
            numberOfLines={1}
          >
            {alert.title}
          </Text>
          <Text
            style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}
            numberOfLines={1}
          >
            {alert.pet.name} · {alert.description}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}

function NewsRow({ article }: { article: NewsArticle }) {
  const router = useRouter();
  const { theme } = useTheme();
  const emoji = article.category?.emoji ?? '📰';
  const when = article.published_at ?? article.created_at;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/news/[slug]', params: { slug: article.slug } })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: theme.surface,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: theme.brandLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
          {article.category?.name ? `${article.category.name} · ` : ''}
          {formatDistanceToNow(new Date(when), { addSuffix: true, locale: ptBR })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
    </Pressable>
  );
}
