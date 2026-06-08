import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { EmptyState } from '@/components/empty-state';
import { UserInitialAvatar } from '@/components/user-initial-avatar';
import { FONTS } from '@/lib/fonts';
import { fetchConversations, qk } from '@/lib/queries';
import type { ConversationSummary } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

export default function MessagesScreen() {
  return (
    <AppThemeProvider app="messages">
      <MessagesInner />
    </AppThemeProvider>
  );
}

function MessagesInner() {
  const { session } = useSession();
  const { theme } = useTheme();
  const userId = session?.user.id;
  const [query, setQuery] = useState('');

  const listQuery = useQuery({
    queryKey: userId ? qk.conversations(userId) : ['conversations', 'anon'],
    queryFn: () => fetchConversations(userId!),
    enabled: !!userId,
  });

  // Filtra por display_name e por preview da última mensagem
  const filtered = useMemo<ConversationSummary[]>(() => {
    const all = listQuery.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const qn = normalize(q);
    return all.filter((c) => {
      if (normalize(c.other_user.display_name).includes(qn)) return true;
      const preview = c.last_message?.content ?? '';
      if (normalize(preview).includes(qn)) return true;
      return false;
    });
  }, [listQuery.data, query]);

  const showEmptySearch = query.trim().length > 0 && filtered.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ConversationRow conv={item} />}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: theme.borderLight, marginLeft: 76 }} />
        )}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 4 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            <AreaHero area="messages" />
            {/* Search bar */}
            <View
              style={{
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: 8,
                backgroundColor: theme.surface,
                borderBottomWidth: 1,
                borderBottomColor: theme.borderLight,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  backgroundColor: theme.borderLight,
                  borderRadius: 12,
                }}
              >
                <Ionicons name="search" size={16} color={theme.textDim} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar conversas..."
                  placeholderTextColor={theme.textDim}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    fontFamily: FONTS.body,
                    fontSize: 14,
                    color: theme.text,
                  }}
                />
                {query.length > 0 ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color={theme.textDim} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          listQuery.isLoading ? null : showEmptySearch ? (
            <EmptyState
              emoji="🔍"
              title="Nada encontrado"
              description={`Sem conversas que combinem com "${query}".`}
            />
          ) : (
            <EmptyState
              emoji="💬"
              title="Sem conversas ainda"
              description="Abra o perfil de outro pet e toque em 'Enviar mensagem' pra começar a conversar com o tutor."
            />
          )
        }
      />
    </View>
  );
}

function ConversationRow({ conv }: { conv: ConversationSummary }) {
  const { theme } = useTheme();
  const preview = conv.last_message?.content ?? 'Diga oi 👋';
  const time = conv.last_message
    ? formatDistanceToNow(new Date(conv.last_message.created_at), { locale: ptBR })
    : '';

  return (
    <Link href={{ pathname: '/chat/[id]', params: { id: conv.id } } as never} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: conv.unread_count > 0 ? theme.accent.surface : theme.surface,
        }}
      >
        <UserInitialAvatar
          avatarUrl={conv.other_user.avatar_url}
          displayName={conv.other_user.display_name}
          userId={conv.other_user.id}
          size={52}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={{
                fontFamily: conv.unread_count > 0 ? FONTS.bodyBold : FONTS.bodySemibold,
                fontSize: 15,
                color: theme.text,
              }}
              numberOfLines={1}
            >
              {conv.other_user.display_name}
            </Text>
            {time ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginLeft: 8 }}>
                {time}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text
              style={{
                flex: 1,
                fontFamily: conv.unread_count > 0 ? FONTS.bodyBold : FONTS.body,
                fontSize: 13,
                color: conv.unread_count > 0 ? theme.text : theme.textDim,
              }}
              numberOfLines={1}
            >
              {preview}
            </Text>
            {conv.unread_count > 0 ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: theme.accent.color, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.accent.onAccent }}>
                  {conv.unread_count}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
