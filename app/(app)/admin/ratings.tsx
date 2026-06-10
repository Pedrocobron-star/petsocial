import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { adminGrantPro } from '@/lib/admin';
import {
  adminAppRatingsSummary,
  adminListAppRatings,
  adminMozartDm,
  qkRatings,
  type AppRatingRow,
} from '@/lib/app-rating';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';
const STAR_GOLD = '#F59E0B';

interface Template {
  key: string;
  label: string;
  emoji: string;
  tiers: number[];
  grantPro: boolean;
  text: string;
}

const TEMPLATES: Template[] = [
  {
    key: 'thanks',
    label: 'Agradecer',
    emoji: '💛',
    tiers: [4, 5],
    grantPro: false,
    text: 'Oi! Aqui é o Mozart 🐾 Passei pra te agradecer DE MONTE pela avaliação! Fico muito feliz que você tá curtindo o Maestro Pet. Qualquer ideia ou novidade, é só me chamar! 💛',
  },
  {
    key: 'help',
    label: 'Pedir feedback',
    emoji: '🙏',
    tiers: [3],
    grantPro: false,
    text: 'Oi! Aqui é o Mozart 🐾 Obrigado pela avaliação! A gente quer deixar o Maestro Pet ainda melhor pra você — me conta o que faltou ou o que dava pra melhorar? Sua ajuda vale muito! 🙏',
  },
  {
    key: 'recover',
    label: 'Oferecer Pro',
    emoji: '🎁',
    tiers: [1, 2],
    grantPro: true,
    text: 'Oi! Aqui é o Mozart 🐾 Obrigado de verdade por avaliar — é com feedback sincero assim que a gente melhora o app. Quero te dar 1 mês de Pet Pro de presente pra você ter uma experiência melhor por aqui. Me conta o que a gente pode melhorar? 💛',
  },
];

function templateForRating(rating: number): Template {
  return TEMPLATES.find((t) => t.tiers.includes(rating)) ?? TEMPLATES[0];
}

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'} size={size} color={STAR_GOLD} />
      ))}
    </View>
  );
}

export default function AdminRatingsScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const summaryQuery = useQuery({
    queryKey: qkRatings.summary,
    queryFn: adminAppRatingsSummary,
    enabled: isAdmin,
  });
  const listQuery = useQuery({
    queryKey: qkRatings.list,
    queryFn: () => adminListAppRatings(200),
    enabled: isAdmin,
  });

  const [replyTo, setReplyTo] = useState<AppRatingRow | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const summary = summaryQuery.data;
  const rows = listQuery.data ?? [];
  const dist = summary
    ? [
        { star: 5, count: summary.c5 },
        { star: 4, count: summary.c4 },
        { star: 3, count: summary.c3 },
        { star: 2, count: summary.c2 },
        { star: 1, count: summary.c1 },
      ]
    : [];
  const maxCount = Math.max(1, ...dist.map((d) => d.count));

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Avaliações · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: '#1A1410',
            borderRadius: 16,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: STAR_GOLD,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="star" size={22} color="#1A1410" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: STAR_GOLD, letterSpacing: 1 }}>
              FEEDBACK
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Avaliações do app
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              O que os tutores acham do Maestro Pet
            </Text>
          </View>
        </View>

        {/* Resumo */}
        {summary ? (
          <View
            style={{
              backgroundColor: theme.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: theme.borderLight,
              flexDirection: 'row',
              gap: 16,
            }}
          >
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 92 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 40, color: theme.text }}>
                {summary.avg_rating != null ? summary.avg_rating.toFixed(1) : '—'}
              </Text>
              <Stars n={Math.round(summary.avg_rating ?? 0)} size={16} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 4 }}>
                {summary.total} {summary.total === 1 ? 'avaliação' : 'avaliações'}
              </Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
              {dist.map((d) => (
                <View key={d.star} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: theme.textDim, width: 28 }}>
                    {d.star}★
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: theme.borderLight,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${(d.count / maxCount) * 100}%`,
                        height: '100%',
                        backgroundColor: STAR_GOLD,
                      }}
                    />
                  </View>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, width: 22, textAlign: 'right' }}>
                    {d.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {(summaryQuery.isLoading || listQuery.isLoading) && rows.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}

        {/* Lista — toque pra responder como Mozart */}
        {rows.map((r: AppRatingRow) => (
          <Pressable
            key={r.id}
            onPress={() => setReplyTo(r)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Stars n={r.rating} size={15} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {format(parseISO(r.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
              </Text>
            </View>
            {r.comment ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.text, lineHeight: 20 }}>
                “{r.comment}”
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                {r.user_name || r.user_email || 'Tutor'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-ellipses" size={13} color={theme.brand} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.brand }}>
                  Responder como Mozart
                </Text>
              </View>
            </View>
          </Pressable>
        ))}

        {!listQuery.isLoading && rows.length === 0 ? (
          <EmptyState
            emoji="⭐"
            mozart="curioso"
            title="Nenhuma avaliação ainda"
            description="Quando os tutores avaliarem o app, as notas e comentários aparecem aqui."
          />
        ) : null}
      </ScrollView>

      <MozartReplyModal rating={replyTo} onClose={() => setReplyTo(null)} />
    </View>
  );
}

// ============================================================================
// MozartReplyModal — responde a avaliação como o Mozart (DM) + opção de Pro
// ============================================================================

function MozartReplyModal({ rating, onClose }: { rating: AppRatingRow | null; onClose: () => void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const [text, setText] = useState('');
  const [grantPro, setGrantPro] = useState(false);
  const [sending, setSending] = useState(false);
  const [tplKey, setTplKey] = useState<string>('');

  // Pré-seleciona o template da nota ao abrir numa avaliação nova.
  const ratingId = rating?.id ?? null;
  const ratingStars = rating?.rating ?? 0;
  useEffect(() => {
    if (!ratingId) return;
    const tpl = templateForRating(ratingStars);
    setTplKey(tpl.key);
    setText(tpl.text);
    setGrantPro(tpl.grantPro);
  }, [ratingId, ratingStars]);

  function applyTemplate(t: Template) {
    setTplKey(t.key);
    setText(t.text);
    setGrantPro(t.grantPro);
  }

  async function handleSend() {
    if (!rating) return;
    const msg = text.trim();
    if (!msg) {
      toast.error('Escreva uma mensagem', 'O Mozart precisa de algo pra enviar');
      return;
    }
    setSending(true);
    try {
      await adminMozartDm(rating.user_id, msg);
      if (grantPro) {
        await adminGrantPro(rating.user_id, 30);
      }
      toast.success(
        grantPro ? 'Mozart respondeu + 1 mês de Pro 🎁' : 'Mozart respondeu 🐾',
        'A mensagem já está na conversa do tutor',
      );
      onClose();
    } catch (e) {
      toast.error('Não consegui enviar', e instanceof Error ? e.message : 'Tenta de novo');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={!!rating} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 20,
            paddingBottom: 30,
            gap: 14,
            maxHeight: '90%',
          }}
        >
          {/* Header: Mozart + avaliação */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={{ uri: MOZART.rosto }} style={{ width: 44, height: 44 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: theme.text }}>
                Responder como Mozart
              </Text>
              {rating ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                  {rating.rating}★ · {rating.user_name || rating.user_email || 'Tutor'}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          {rating?.comment ? (
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 13,
                color: theme.textDim,
                fontStyle: 'italic',
                backgroundColor: theme.bg,
                borderRadius: 10,
                padding: 10,
              }}
              numberOfLines={3}
            >
              “{rating.comment}”
            </Text>
          ) : null}

          {/* Templates */}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {TEMPLATES.map((t) => {
              const sel = tplKey === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => applyTemplate(t)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1.5,
                    borderColor: sel ? theme.brand : theme.borderLight,
                    backgroundColor: sel ? theme.brandSurface : theme.surface,
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: sel ? theme.brand : theme.text }}>
                    {t.emoji} {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            editable={!sending}
            placeholder="Mensagem do Mozart…"
            placeholderTextColor={theme.textDim}
            style={{
              minHeight: 110,
              maxHeight: 200,
              borderWidth: 1,
              borderColor: theme.borderLight,
              borderRadius: 12,
              padding: 12,
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.text,
              backgroundColor: theme.bg,
              textAlignVertical: 'top',
            }}
          />

          {/* Toggle Pro */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: theme.bg,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: theme.text }}>
                🎁 Dar 1 mês de Pet Pro
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}>
                Presenteia o tutor pra ele ter uma experiência melhor
              </Text>
            </View>
            <Switch value={grantPro} onValueChange={setGrantPro} disabled={sending} />
          </View>

          <Button
            title={sending ? 'Enviando…' : 'Enviar como Mozart 🐾'}
            onPress={handleSend}
            loading={sending}
            disabled={sending}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
