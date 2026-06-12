import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePetHealthGate } from '@/components/pet-health-gate';
import { TypingDots } from '@/components/typing-dots';
import { detectEmergency } from '@/lib/ai-emergency';
import { copyToClipboard } from '@/lib/clipboard';
import { FONTS } from '@/lib/fonts';
import { GUIDE_CATEGORIES, GUIDE_TOPICS, matchGuideTopic } from '@/lib/health-guide';
import { fetchPet, qk } from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Tira-dúvidas de Saúde — guia LOCAL de referência (sem IA/LLM, custo zero).
 *
 * Responde com base numa base curada (lib/health-guide.ts): geral, nunca
 * diagnostica nem prescreve. Sem rede, sem limite diário, sem paywall. Mantém
 * o detector de emergência (rede de segurança) e o disclaimer fixo.
 */

interface GuideMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const EMERGENCY_REPLY =
  'Isso pode ser uma emergência. NÃO espere por um guia: procure um veterinário ou um pronto-atendimento 24h o quanto antes.\n\nEnquanto vai, mantenha o pet calmo e aquecido, e anote o que aconteceu (o que comeu, quando começou, sintomas). Toque no botão vermelho acima pra ver vets 24h perto de você.';

function buildFallback(petName: string): string {
  return `Ainda não tenho um guia específico pra essa pergunta sobre ${petName}. 🐾\n\nO mais seguro é registrar o que você observou (sintomas, peso, fotos) aqui no app e levar pra um veterinário, que avalia com precisão.\n\nVocê pode tentar reformular com palavras como "vômito", "vacina", "alimentação", "coceira", ou tocar numa das sugestões.`;
}

export default function HealthGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const healthGate = usePetHealthGate(id);
  const { theme } = useTheme();
  const listRef = useRef<FlatList<GuideMessage>>(null);
  const counter = useRef(0);

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  // Emergência detectada numa msg JÁ enviada — fica fixa até dispensar.
  const [emergencyActive, setEmergencyActive] = useState(false);

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const pet = petQuery.data;
  const petName = pet?.name ?? 'seu pet';

  const nextId = () => {
    counter.current += 1;
    return `m${counter.current}`;
  };

  const send = (raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text || thinking) return;
    setDraft('');

    const isEmergency = detectEmergency(text);
    if (isEmergency) setEmergencyActive(true);

    const userMsg: GuideMessage = { id: nextId(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    // Pequena pausa só pra dar ritmo de conversa (resposta é local/instantânea).
    setTimeout(() => {
      let answer: string;
      if (isEmergency) {
        answer = EMERGENCY_REPLY;
      } else {
        const topic = matchGuideTopic(text);
        answer = topic ? topic.answer : buildFallback(petName);
      }
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: answer }]);
      setThinking(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }, 380);
  };

  const clear = () => {
    setMessages([]);
    setEmergencyActive(false);
    setDraft('');
  };

  if (healthGate) return healthGate;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 22 }}>📋</Text>
              <View>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
                  Tira-dúvidas
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                  Saúde de {petName}
                </Text>
              </View>
            </View>
          ),
          headerRight: () =>
            messages.length > 0 ? (
              <Pressable
                onPress={clear}
                hitSlop={10}
                style={{ marginRight: 12 }}
                accessibilityLabel="Limpar conversa"
              >
                <Ionicons name="refresh" size={20} color={theme.brand} />
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
            <View style={{ flex: 1, alignItems: 'center', paddingTop: 24 }}>
              <Text style={{ fontSize: 52, marginBottom: 12 }}>📋</Text>
              <Text
                style={{ fontFamily: FONTS.display, fontSize: 22, color: theme.text, textAlign: 'center' }}
              >
                Tira-dúvidas de saúde
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
                Respostas de referência sobre cuidados, alimentação e sinais de alerta.{'\n'}
                <Text style={{ fontFamily: FONTS.bodyBold }}>
                  Não substituem o veterinário — em emergências, procure atendimento.
                </Text>
              </Text>

              <TopicSuggestions onSelect={(q) => send(q)} />
            </View>
          }
          ListFooterComponent={
            thinking ? (
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
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

        {/* Rede de segurança — emergência (ao digitar palavra crítica ou após enviar). */}
        {detectEmergency(draft) || emergencyActive ? (
          <View
            style={{
              marginHorizontal: 12,
              marginBottom: 4,
              backgroundColor: '#DC2626',
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Pressable
              onPress={() => {
                const url = Platform.select({
                  ios: 'https://maps.apple.com/?q=veterinario+24+horas',
                  android: 'geo:0,0?q=veterinario+24+horas',
                  default: 'https://www.google.com/maps/search/?api=1&query=veterinario+24+horas',
                });
                Linking.openURL(url!).catch(() => {});
              }}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}
            >
              <Text style={{ fontSize: 22 }}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' }}>
                  Parece emergência. Procure um vet agora.
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#FFFFFF', opacity: 0.9, marginTop: 2 }}>
                  Toque pra ver vets 24h próximos no mapa.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </Pressable>
            {emergencyActive ? (
              <Pressable
                onPress={() => setEmergencyActive(false)}
                hitSlop={10}
                accessibilityLabel="Dispensar aviso de emergência"
                style={{ paddingHorizontal: 12, paddingVertical: 12 }}
              >
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </Pressable>
            ) : null}
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
            placeholder="Pergunte sobre cuidados, sintomas, alimentação..."
            placeholderTextColor={theme.textDim}
            multiline
            maxLength={500}
            onSubmitEditing={() => send()}
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
            onPress={() => send()}
            disabled={!draft.trim() || thinking}
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

function TopicSuggestions({ onSelect }: { onSelect: (q: string) => void }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginTop: 24, gap: 16, paddingHorizontal: 16, width: '100%' }}>
      {GUIDE_CATEGORIES.map((cat) => {
        const items = GUIDE_TOPICS.filter((t) => t.category === cat.id);
        if (items.length === 0) return null;
        return (
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
              {items.map((it) => (
                <Pressable
                  key={it.id}
                  onPress={() => onSelect(it.question)}
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
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
                    {it.question}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Detecta URLs e renderiza clicáveis. */
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function renderContent(content: string, isUser: boolean, linkColor: string) {
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

function MessageBubble({ message }: { message: GuideMessage }) {
  const { theme } = useTheme();
  const toast = useToast();
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    const ok = await copyToClipboard(message.content);
    if (ok) toast.success('Copiado!', 'A resposta foi pra área de transferência.');
    else toast.error('Erro', 'Não consegui copiar.');
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
            {renderContent(message.content, isUser, theme.brand)}
          </Text>
        </Pressable>

        {!isUser ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 10,
              color: theme.textDim,
              marginTop: 4,
              paddingHorizontal: 6,
            }}
          >
            Toque e segure pra copiar
          </Text>
        ) : null}
      </View>
    </View>
  );
}
