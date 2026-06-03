import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PaywallCard } from '@/components/paywall-card';
import { PremiumBadge } from '@/components/premium-badge';
import { TypingDots } from '@/components/typing-dots';
import { UpgradeModal } from '@/components/upgrade-modal';
import { detectEmergency } from '@/lib/ai-emergency';
import { track } from '@/lib/analytics';
import { getAiSuggestions } from '@/lib/ai-suggestions';
import { copyToClipboard } from '@/lib/clipboard';
import { FONTS } from '@/lib/fonts';
import {
  createAiConversation,
  fetchAiConversations,
  fetchAiMessages,
  fetchAiMessagesSentToday,
  fetchPet,
  qk,
  sendAiMessage,
} from '@/lib/queries';
import type { AiMessage } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/** Limite diário de mensagens pro plano free. */
const FREE_AI_DAILY_LIMIT = 5;

export default function AiAssistantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const { session } = useSession();
  const isPro = useIsPro();
  const toast = useToast();
  const qc = useQueryClient();
  const listRef = useRef<FlatList<AiMessage>>(null);

  const [draft, setDraft] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const userId = session?.user.id;

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const convsQuery = useQuery({
    queryKey: userId ? qk.aiConversations(userId) : ['ai-conversations', 'anon'],
    queryFn: () => fetchAiConversations(userId!),
    enabled: !!userId,
  });

  // Pega ou cria a conversation pro pet
  useEffect(() => {
    if (!convsQuery.data || !userId || !id || conversationId) return;
    const existing = convsQuery.data.find((c) => c.pet_id === id);
    if (existing) {
      setConversationId(existing.id);
    }
  }, [convsQuery.data, userId, id, conversationId]);

  const msgsQuery = useQuery({
    queryKey: conversationId ? qk.aiMessages(conversationId) : ['ai-messages', 'none'],
    queryFn: () => fetchAiMessages(conversationId!),
    enabled: !!conversationId,
  });

  // Rate limit do plano free — conta mensagens user-sent nas últimas 24h
  const dailyCountQuery = useQuery({
    queryKey: userId ? qk.aiMessagesSentToday(userId) : ['ai-msg-today', 'anon'],
    queryFn: () => fetchAiMessagesSentToday(userId!),
    enabled: !!userId && !isPro,
    // Re-fetch a cada minuto pra contagem ficar fresca
    refetchInterval: 60_000,
  });
  const sentToday = isPro ? 0 : dailyCountQuery.data ?? 0;
  const remaining = isPro ? Infinity : Math.max(0, FREE_AI_DAILY_LIMIT - sentToday);
  const reachedLimit = !isPro && remaining === 0;

  const sendMut = useMutation({
    mutationFn: async (text: string) => {
      let convId = conversationId;
      if (!convId) {
        const conv = await createAiConversation(
          userId!,
          id,
          `Sobre ${petQuery.data?.name ?? 'meu pet'}`,
        );
        convId = conv.id;
        setConversationId(convId);
      }
      return sendAiMessage(convId, text, petQuery.data);
    },
    onMutate: async (text) => {
      setDraft('');
      const optimistic: AiMessage = {
        id: `tmp-${Date.now()}`,
        conversation_id: conversationId ?? 'tmp',
        role: 'user',
        content: text,
        tokens_used: null,
        created_at: new Date().toISOString(),
      };
      if (conversationId) {
        await qc.cancelQueries({ queryKey: qk.aiMessages(conversationId) });
        const prev = qc.getQueryData<AiMessage[]>(qk.aiMessages(conversationId)) ?? [];
        qc.setQueryData<AiMessage[]>(qk.aiMessages(conversationId), [...prev, optimistic]);
      }
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    },
    onSuccess: () => {
      if (conversationId) qc.invalidateQueries({ queryKey: qk.aiMessages(conversationId) });
      // Re-conta limite diário pra refletir mensagem nova
      if (userId) qc.invalidateQueries({ queryKey: qk.aiMessagesSentToday(userId) });
    },
    onError: () => toast.error('Erro ao enviar', 'Tenta de novo'),
  });

  // Free user: limite diário de FREE_AI_DAILY_LIMIT mensagens (todas conversas)
  const canSend = isPro || !reachedLimit;

  const onSend = (text?: string) => {
    const finalText = (text ?? draft).trim();
    if (!finalText || sendMut.isPending) return;
    if (!canSend) {
      track('paywall_blocked', { intent: 'ai-daily-limit', sent_today: sentToday });
      setShowUpgrade(true);
      return;
    }
    sendMut.mutate(finalText);
  };

  const pet = petQuery.data;
  const messages = msgsQuery.data ?? [];

  const handleNewConversation = () => {
    if (messages.length === 0) return;
    Alert.alert(
      'Nova conversa?',
      'A IA não terá memória do que conversamos antes. Útil pra começar um tópico totalmente novo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Começar nova',
          onPress: () => {
            setConversationId(null);
            setDraft('');
            // Invalida pra mostrar empty state com sugestões
            qc.invalidateQueries({ queryKey: ['ai-messages'] });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>🤖</Text>
              <View>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
                  Assistente Pet
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                  Sobre {pet?.name ?? 'seu pet'}
                </Text>
              </View>
            </View>
          ),
          headerRight: () =>
            messages.length > 0 ? (
              <Pressable
                onPress={handleNewConversation}
                hitSlop={10}
                style={{ marginRight: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                accessibilityLabel="Iniciar nova conversa"
              >
                <Ionicons name="add-circle-outline" size={22} color={theme.brand} />
              </Pressable>
            ) : null,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={{ padding: 16, gap: 4, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 32 }}>
              <Text style={{ fontSize: 56, marginBottom: 12 }}>🤖</Text>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  color: theme.text,
                  textAlign: 'center',
                }}
              >
                Pergunte sobre {pet?.name ?? 'seu pet'}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: theme.textDim,
                  textAlign: 'center',
                  marginTop: 8,
                  paddingHorizontal: 24,
                  lineHeight: 20,
                }}
              >
                Saúde, comportamento, alimentação.{'\n'}
                <Text style={{ fontFamily: FONTS.bodyBold }}>
                  Em emergências, sempre procure um veterinário.
                </Text>
              </Text>

              <AiSuggestions pet={pet ?? undefined} onSelect={(t) => onSend(t)} />
            </View>
          }
          ListFooterComponent={
            sendMut.isPending ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 4,
                  alignItems: 'flex-start',
                  marginTop: 8,
                }}
              >
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: 18,
                    borderBottomLeftRadius: 4,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <TypingDots color={theme.brand} size={7} />
                </View>
              </View>
            ) : null
          }
        />

        {/* Emergency banner — só pisca quando user digita palavras críticas */}
        {detectEmergency(draft) ? (
          <Pressable
            onPress={() => {
              const url = Platform.select({
                ios: 'https://maps.apple.com/?q=veterinario+24+horas',
                android: 'geo:0,0?q=veterinario+24+horas',
                default: 'https://www.google.com/maps/search/?api=1&query=veterinario+24+horas',
              });
              Linking.openURL(url!).catch(() => {});
            }}
            style={{
              marginHorizontal: 12,
              marginBottom: 4,
              backgroundColor: '#DC2626',
              borderRadius: 12,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 22 }}>🚨</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' }}>
                Parece emergência. NÃO espere a IA.
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#FFFFFF', opacity: 0.9, marginTop: 2 }}>
                Toque pra ver vets 24h próximos no mapa.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}

        {/* Indicador Pro ativo */}
        {isPro ? (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              backgroundColor: '#FEF3C7',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <PremiumBadge size={12} />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#92400E', letterSpacing: 0.5 }}>
              PRO · MENSAGENS ILIMITADAS
            </Text>
          </View>
        ) : null}

        {/* Banner contador no plano free */}
        {!isPro && reachedLimit ? (
          <View style={{ marginHorizontal: 12, marginBottom: 8 }}>
            <PaywallCard
              intent="ai-daily-limit"
              emoji="🤖"
              title="Limite diário atingido"
              description={`Você usou ${FREE_AI_DAILY_LIMIT} mensagens do assistente IA hoje. No Pet Pro é ilimitado — pergunte o quanto quiser sobre cuidados, sintomas, alimentação.`}
              compact
            />
          </View>
        ) : !isPro && sentToday > 0 ? (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 4,
              backgroundColor: '#FEF3C7',
              borderRadius: 10,
              padding: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 14 }}>⭐</Text>
            <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 11, color: '#78350F' }}>
              {remaining === 1
                ? 'Última pergunta hoje no plano free. Vire Pro pra ilimitado.'
                : `${remaining} de ${FREE_AI_DAILY_LIMIT} perguntas restantes hoje. Vire Pro pra ilimitado.`}
            </Text>
          </View>
        ) : null}

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
            placeholder={canSend ? 'Pergunte qualquer coisa...' : 'Vire Pro pra mais perguntas'}
            placeholderTextColor={theme.textDim}
            editable={canSend}
            multiline
            maxLength={1000}
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
              opacity: canSend ? 1 : 0.5,
            }}
          />
          <Pressable
            onPress={() => onSend()}
            disabled={!draft.trim() || sendMut.isPending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() && canSend ? theme.brand : theme.borderLight,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-up" size={20} color={draft.trim() && canSend ? '#fff' : theme.textDim} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason="generic"
      />
    </View>
  );
}

function AiSuggestions({
  pet,
  onSelect,
}: {
  pet: { species?: string; breed?: string | null; birthdate?: string | null } | undefined;
  onSelect: (text: string) => void;
}) {
  const { theme } = useTheme();
  const categories = getAiSuggestions(pet as never);
  return (
    <View style={{ marginTop: 24, gap: 16, paddingHorizontal: 16, width: '100%' }}>
      {categories.map((cat) => (
        <View key={cat.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 }}>
            <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: theme.brand,
              }}
            >
              {cat.label}
            </Text>
          </View>
          <View style={{ gap: 6 }}>
            {cat.items.map((it) => (
              <Pressable
                key={it.text}
                onPress={() => onSelect(it.text)}
                style={{
                  backgroundColor: theme.surface,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>{it.emoji}</Text>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.text,
                  }}
                >
                  {it.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Detecta URLs e renderiza clicáveis (reusa pattern do chat). */
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function renderAiContent(content: string, isUser: boolean, linkColor: string) {
  const parts = content.split(URL_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0;
      const url = part.startsWith('http') ? part : `https://${part}`;
      return (
        <Text
          key={i}
          onPress={() => Linking.openURL(url).catch(() => {})}
          style={{
            fontFamily: FONTS.bodyBold,
            color: isUser ? '#fff' : linkColor,
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

function MessageBubble({ message }: { message: AiMessage }) {
  const { theme } = useTheme();
  const toast = useToast();
  const isUser = message.role === 'user';
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) toast.success('Copiado!', 'A resposta foi pra área de transferência.');
    else toast.error('Erro', 'Não consegui copiar.');
  };

  const handleFeedback = (kind: 'up' | 'down') => {
    if (feedback) return; // só uma vez
    setFeedback(kind);
    track('ai_message_feedback', {
      message_id: message.id,
      conversation_id: message.conversation_id,
      feedback: kind,
    });
    toast.success(
      kind === 'up' ? 'Obrigado!' : 'Anotado',
      kind === 'up' ? 'Vou continuar nessa linha.' : 'Vamos melhorar.',
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginVertical: 4,
      }}
    >
      <View style={{ maxWidth: '88%' }}>
        <Pressable
          onLongPress={isUser ? undefined : handleCopy}
          delayLongPress={400}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 18,
            borderBottomRightRadius: isUser ? 4 : 18,
            borderBottomLeftRadius: isUser ? 18 : 4,
            backgroundColor: isUser ? theme.brand : theme.surface,
            borderWidth: isUser ? 0 : 1,
            borderColor: theme.border,
          }}
        >
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              color: isUser ? '#fff' : theme.text,
              lineHeight: 20,
            }}
          >
            {renderAiContent(message.content, isUser, theme.brand)}
          </Text>
        </Pressable>

        {/* Disclaimer + feedback nas respostas da AI */}
        {!isUser && !message.id.startsWith('tmp-') ? (
          <View style={{ marginTop: 4, paddingHorizontal: 6 }}>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 10,
                color: theme.textDim,
                lineHeight: 13,
              }}
            >
              ⚠️ Sou IA — em dúvida séria, procure um veterinário.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Pressable
                onPress={() => handleFeedback('up')}
                hitSlop={8}
                disabled={!!feedback}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: feedback === 'up' ? theme.brandSurface : 'transparent',
                  opacity: feedback === 'down' ? 0.3 : 1,
                }}
              >
                <Text style={{ fontSize: 13 }}>👍</Text>
              </Pressable>
              <Pressable
                onPress={() => handleFeedback('down')}
                hitSlop={8}
                disabled={!!feedback}
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 10,
                  backgroundColor: feedback === 'down' ? theme.brandSurface : 'transparent',
                  opacity: feedback === 'up' ? 0.3 : 1,
                }}
              >
                <Text style={{ fontSize: 13 }}>👎</Text>
              </Pressable>
              <Pressable onPress={handleCopy} hitSlop={8} style={{ paddingHorizontal: 6, paddingVertical: 3 }}>
                <Ionicons name="copy-outline" size={13} color={theme.textDim} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
