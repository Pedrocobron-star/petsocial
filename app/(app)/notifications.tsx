import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInDays, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { PawRefreshControl, PawRefreshOverlay } from '@/components/ui/paw-refresh-control';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { FONTS } from '@/lib/fonts';
import {
  fetchNotifications,
  markAllNotificationsRead,
  qk,
} from '@/lib/queries';
import type { NotificationKind, NotificationWithDetails } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

type FilterKind = 'all' | NotificationKind;

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'like', label: 'Curtidas' },
  { value: 'comment', label: 'Comentários' },
  { value: 'follow', label: 'Seguidores' },
];

type Section = 'today' | 'yesterday' | 'this_week' | 'older';
const SECTION_LABEL: Record<Section, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  this_week: 'Esta semana',
  older: 'Mais antigas',
};

function sectionFor(date: Date): Section {
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  const days = differenceInDays(new Date(), date);
  if (days <= 7) return 'this_week';
  return 'older';
}

type ListItem =
  | { kind: 'header'; label: string; key: string }
  | { kind: 'item'; notification: NotificationWithDetails; key: string };

export default function NotificationsScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<FilterKind>('all');
  const [refreshing, setRefreshing] = useState(false);

  const listQuery = useQuery({
    queryKey: userId ? qk.notifications(userId) : ['notifications', 'anon'],
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(userId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications(userId!) });
      qc.invalidateQueries({ queryKey: qk.unreadCount(userId!) });
    },
  });

  // Marca todas como lidas ao abrir
  useEffect(() => {
    if (userId) markAllMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const all = listQuery.data ?? [];

  // Contagens por filter (sempre o total, não o filtrado)
  const counts = useMemo(() => {
    const out: Record<FilterKind, number> = { all: all.length, like: 0, comment: 0, follow: 0, mention: 0, pet_tagged: 0 };
    for (const n of all) out[n.kind] = (out[n.kind] ?? 0) + 1;
    return out;
  }, [all]);

  // Lista filtrada + enriquecida com headers de seção
  const items = useMemo<ListItem[]>(() => {
    const filtered = filter === 'all' ? all : all.filter((n) => n.kind === filter);
    const result: ListItem[] = [];
    let lastSection: Section | null = null;
    for (const n of filtered) {
      const s = sectionFor(parseISO(n.created_at));
      if (s !== lastSection) {
        result.push({ kind: 'header', label: SECTION_LABEL[s], key: `header-${s}` });
        lastSection = s;
      }
      result.push({ kind: 'item', notification: n, key: n.id });
    }
    return result;
  }, [all, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: qk.notifications(userId!) });
    setRefreshing(false);
  };

  const filtersWithCount = FILTERS.map((f) => ({
    ...f,
    label: counts[f.value] > 0 ? `${f.label} ${counts[f.value]}` : f.label,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {all.length > 0 ? (
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
      ) : null}

      <PawRefreshOverlay refreshing={refreshing} />

      <FlatList
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={({ item }) => {
          if (item.kind === 'header') return <SectionHeader label={item.label} />;
          return <NotificationRow notification={item.notification} />;
        }}
        refreshControl={<PawRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={({ leadingItem }) =>
          (leadingItem as ListItem)?.kind === 'item' ? (
            <View style={{ height: 1, backgroundColor: theme.borderLight }} />
          ) : null
        }
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          listQuery.isLoading ? null : filter !== 'all' && all.length > 0 ? (
            <EmptyState
              emoji="🔕"
              title={`Sem ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}`}
              description="Não tem nada nesse filtro ainda. Tenta outro ou volta pra 'Todas'."
              action={<Button title="Ver todas" onPress={() => setFilter('all')} />}
            />
          ) : (
            <EmptyState
              emoji="🔔"
              title="Sem novidades"
              description="Quando alguém curtir, comentar ou seguir um pet seu, aparece aqui."
              action={
                <Link href="/(app)/(tabs)/explore" asChild>
                  <Button title="Explorar pets" />
                </Link>
              }
            />
          )
        }
      />
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 6,
        backgroundColor: theme.bg,
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          letterSpacing: 1.4,
          color: theme.brand,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function NotificationRow({ notification: n }: { notification: NotificationWithDetails }) {
  const router = useRouter();
  const { theme } = useTheme();
  if (!n.actor) return null;
  // Mention e pet_tagged não exigem target_pet diferente, mas as outras precisam
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
      (n.kind === 'like' ||
        n.kind === 'comment' ||
        n.kind === 'mention' ||
        n.kind === 'pet_tagged') &&
      n.post_id
    ) {
      router.push({ pathname: '/post/[id]', params: { id: n.post_id } });
    } else if (n.kind === 'follow') {
      router.push({ pathname: '/pet/[id]', params: { id: n.actor!.id } });
    } else if (n.kind === 'mention') {
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
            <PetAvatar pet={n.actor} size={44} animation={!n.read ? 'wag' : undefined} />
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
