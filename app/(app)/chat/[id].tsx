import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isSameDay, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { UserInitialAvatar } from '@/components/user-initial-avatar';
import { FONTS } from '@/lib/fonts';
import {
  fetchConversationOtherUser,
  fetchMessages,
  markConversationRead,
  qk,
  sendMessage,
} from '@/lib/queries';
import type { Message } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<Message>>(null);
  const [draft, setDraft] = useState('');

  const userId = session?.user.id;

  const otherUserQuery = useQuery({
    queryKey: ['conversation-other', id, userId],
    queryFn: () => fetchConversationOtherUser(id!, userId!),
    enabled: !!id && !!userId,
  });

  const messagesQuery = useQuery({
    queryKey: id ? qk.messages(id) : ['messages', 'none'],
    queryFn: () => fetchMessages(id!),
    enabled: !!id,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(id!, userId!, content),
    onMutate: async (content) => {
      // Optimistic: adiciona localmente já
      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        conversation_id: id!,
        sender_id: userId!,
        content,
        created_at: new Date().toISOString(),
      };
      await qc.cancelQueries({ queryKey: qk.messages(id!) });
      const prev = qc.getQueryData<Message[]>(qk.messages(id!)) ?? [];
      qc.setQueryData<Message[]>(qk.messages(id!), [...prev, optimistic]);
      setDraft('');
      // rolar pro fim
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return { prev };
    },
    onError: (_err, content, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.messages(id!), ctx.prev);
      // restaura o texto (se o campo ainda estiver vazio) pra não perder a mensagem
      setDraft((d) => (d.trim() ? d : content));
      toast.error('Mensagem não enviada', 'Toque pra tentar de novo.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.messages(id!) });
      qc.invalidateQueries({ queryKey: qk.conversations(userId!) });
    },
  });

  // Marca como lido sempre que abre ou que mensagens novas chegam
  useEffect(() => {
    if (!id || !userId) return;
    markConversationRead(id, userId)
      .then(() => {
        qc.invalidateQueries({ queryKey: qk.unreadMessages(userId) });
        // também atualiza a LISTA de conversas pra tirar o destaque de não-lida
        qc.invalidateQueries({ queryKey: qk.conversations(userId) });
      })
      .catch(() => {});
  }, [id, userId, messagesQuery.data?.length, qc]);

  // Auto-scroll quando lista cresce
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 30);
  }, [messagesQuery.data?.length]);

  const messages = messagesQuery.data ?? [];
  const other = otherUserQuery.data;

  // Enriquece a lista com day headers e flags showTime/showGap pra renderizar
  // bubbles corretamente. Memoizado pra não recomputar a cada keystroke.
  const items = useMemo<ChatItem[]>(() => {
    const result: ChatItem[] = [];
    let lastDay: Date | null = null;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const next = messages[i + 1];
      const date = parseISO(m.created_at);
      // Day separator quando o dia muda
      if (!lastDay || !isSameDay(lastDay, date)) {
        result.push({ kind: 'day', date, key: `day-${date.toDateString()}` });
        lastDay = date;
      }
      // Mostra hora apenas na última msg do "burst" (mesma pessoa, gap < 5min,
      // OU se for a última do dia/lista)
      const isLastOfBurst =
        !next ||
        next.sender_id !== m.sender_id ||
        !isSameDay(date, parseISO(next.created_at)) ||
        Math.abs(parseISO(next.created_at).getTime() - date.getTime()) > 5 * 60 * 1000;
      // Gap pequeno quando primeira do burst
      const prev = messages[i - 1];
      const showGap =
        !prev ||
        prev.sender_id !== m.sender_id ||
        !isSameDay(date, parseISO(prev.created_at)) ||
        Math.abs(date.getTime() - parseISO(prev.created_at).getTime()) > 5 * 60 * 1000;
      result.push({ kind: 'msg', message: m, showGap, showTime: isLastOfBurst, key: m.id });
    }
    return result;
  }, [messages]);

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <UserInitialAvatar
                avatarUrl={other?.avatar_url}
                displayName={other?.display_name}
                userId={other?.id}
                size={32}
              />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: theme.text }}>
                {other?.display_name ?? 'Conversa'}
              </Text>
            </View>
          ),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        {messagesQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.brand} />
          </View>
        ) : (
          <FlatList
            ref={listRef as never}
            data={items}
            keyExtractor={(it) => it.key}
            renderItem={({ item }) => {
              if (item.kind === 'day') return <DaySeparator date={item.date} />;
              return (
                <MessageBubble
                  message={item.message}
                  isMe={item.message.sender_id === userId}
                  showGap={item.showGap}
                  showTime={item.showTime}
                />
              );
            }}
            contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 12, flexGrow: 1 }}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>👋</Text>
                <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text, textAlign: 'center' }}>
                  Diga oi!
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    marginTop: 6,
                    textAlign: 'center',
                  }}
                >
                  Esta é sua primeira conversa com {other?.display_name ?? 'esse tutor'}.
                </Text>
              </View>
            }
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 14,
            backgroundColor: theme.surface,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Mensagem..."
            placeholderTextColor={theme.textDim}
            multiline
            maxLength={2000}
            style={{
              flex: 1,
              backgroundColor: theme.borderLight,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 10,
              fontFamily: FONTS.body,
              fontSize: 15,
              color: theme.text,
              maxHeight: 120,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sendMutation.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() ? theme.brand : theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-up" size={20} color={draft.trim() ? '#fff' : theme.textDim} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

type ChatItem =
  | { kind: 'day'; date: Date; key: string }
  | { kind: 'msg'; message: Message; showGap: boolean; showTime: boolean; key: string };

function DaySeparator({ date }: { date: Date }) {
  const { theme } = useTheme();
  const label = isToday(date)
    ? 'Hoje'
    : isYesterday(date)
      ? 'Ontem'
      : format(date, "d 'de' MMMM", { locale: ptBR });
  return (
    <View style={{ alignItems: 'center', marginVertical: 14 }}>
      <View
        style={{
          backgroundColor: theme.borderLight,
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            color: theme.textDim,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Detecta URLs e quebra em pedaços renderizáveis. */
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function renderMessageContent(content: string, isMe: boolean, linkColor: string) {
  const parts = content.split(URL_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      // Reset regex pra próximo teste — RegExp global é stateful
      URL_RE.lastIndex = 0;
      const url = part.startsWith('http') ? part : `https://${part}`;
      return (
        <Text
          key={i}
          onPress={() => Linking.openURL(url).catch(() => {})}
          style={{
            fontFamily: FONTS.bodyBold,
            color: isMe ? '#fff' : linkColor,
            textDecorationLine: 'underline',
          }}
        >
          {part}
        </Text>
      );
    }
    URL_RE.lastIndex = 0;
    return <Text key={i}>{part}</Text>;
  });
}

function MessageBubble({
  message,
  isMe,
  showGap,
  showTime,
}: {
  message: Message;
  isMe: boolean;
  showGap: boolean;
  showTime: boolean;
}) {
  const { theme } = useTheme();
  const isPending = message.id.startsWith('tmp-');
  const time = format(parseISO(message.created_at), 'HH:mm');
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginTop: showGap ? 8 : 2,
      }}
    >
      <View style={{ maxWidth: '80%' }}>
        <View
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 18,
            borderBottomRightRadius: isMe ? 4 : 18,
            borderBottomLeftRadius: isMe ? 18 : 4,
            backgroundColor: isMe ? theme.brand : theme.surface,
            borderWidth: isMe ? 0 : 1,
            borderColor: theme.border,
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 15,
              color: isMe ? '#fff' : theme.text,
              lineHeight: 20,
            }}
          >
            {renderMessageContent(message.content, isMe, theme.brand)}
          </Text>
        </View>
        {showTime ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              gap: 4,
              marginTop: 3,
              paddingHorizontal: 6,
            }}
          >
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
              {time}
            </Text>
            {/* Status: clock pra pending, check pra enviado. Só nas minhas msgs. */}
            {isMe ? (
              isPending ? (
                <Ionicons name="time-outline" size={11} color={theme.textDim} />
              ) : (
                <Ionicons name="checkmark" size={11} color={theme.textDim} />
              )
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}
