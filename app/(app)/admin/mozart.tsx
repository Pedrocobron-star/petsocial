import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import {
  createMozartMessage,
  deleteMozartMessage,
  fetchMozartMessages,
  qkMozartMessages,
  updateMozartMessage,
  type MozartMessage,
} from '@/lib/mozart-messages';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminMozartScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const listQuery = useQuery({
    queryKey: qkMozartMessages,
    queryFn: fetchMozartMessages,
    enabled: isAdmin,
  });

  const [editing, setEditing] = useState<MozartMessage | 'new' | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const msgs = listQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Mozart · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 70 }}>
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
          <Image source={{ uri: MOZART.rosto }} style={{ width: 46, height: 46 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#FBBF24', letterSpacing: 1 }}>
              MASCOTE OFICIAL
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Boas-vindas do Mozart
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              DMs automáticas pra cada novo tutor
            </Text>
          </View>
        </View>

        {/* Explicação */}
        <View
          style={{
            backgroundColor: theme.brandSurface,
            borderRadius: 12,
            padding: 12,
            flexDirection: 'row',
            gap: 8,
          }}
        >
          <Ionicons name="information-circle" size={18} color={theme.brand} />
          <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.text, lineHeight: 17 }}>
            O Mozart envia estas mensagens, na ordem, pra quem entra no app pela primeira vez. Edições valem
            pros próximos novos tutores (quem já recebeu não recebe de novo). Desative uma mensagem pra ela
            parar de ser enviada.
          </Text>
        </View>

        {listQuery.isLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}

        {msgs.map((m, i) => (
          <Pressable
            key={m.id}
            onPress={() => setEditing(m)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.borderLight,
              gap: 8,
              opacity: m.active ? 1 : 0.55,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: theme.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#fff' }}>{i + 1}</Text>
              </View>
              {!m.active ? (
                <View style={{ backgroundColor: '#E5E5E5', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 5 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#525252', letterSpacing: 0.4 }}>
                    DESATIVADA
                  </Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <Ionicons name="create-outline" size={16} color={theme.textDim} />
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: theme.text, lineHeight: 20 }}>{m.content}</Text>
          </Pressable>
        ))}

        <Button title="+ Adicionar mensagem" variant="secondary" onPress={() => setEditing('new')} fullWidth />
      </ScrollView>

      <MozartMsgModal
        target={editing}
        nextOrder={msgs.length}
        onClose={() => setEditing(null)}
      />
    </View>
  );
}

function MozartMsgModal({
  target,
  nextOrder,
  onClose,
}: {
  target: MozartMessage | 'new' | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const isNew = target === 'new';
  const existing = target && target !== 'new' ? target : null;

  const [content, setContent] = useState('');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState('0');

  useEffect(() => {
    if (!target) return;
    if (existing) {
      setContent(existing.content);
      setActive(existing.active);
      setOrder(String(existing.sort_order));
    } else {
      setContent('');
      setActive(true);
      setOrder(String(nextOrder));
    }
  }, [target, existing, nextOrder]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const clean = content.trim();
      if (!clean) throw new Error('Escreva a mensagem');
      const sort_order = Number.parseInt(order, 10) || 0;
      if (existing) {
        await updateMozartMessage(existing.id, { content: clean, active, sort_order });
      } else {
        await createMozartMessage({ content: clean, active, sort_order });
      }
    },
    onSuccess: () => {
      toast.success(existing ? 'Mensagem atualizada' : 'Mensagem adicionada');
      qc.invalidateQueries({ queryKey: qkMozartMessages });
      onClose();
    },
    onError: (e) => toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tenta de novo'),
  });

  const delMut = useMutation({
    mutationFn: () => deleteMozartMessage(existing!.id),
    onSuccess: () => {
      toast.success('Mensagem apagada');
      qc.invalidateQueries({ queryKey: qkMozartMessages });
      onClose();
    },
    onError: () => toast.error('Erro ao apagar'),
  });

  const busy = saveMut.isPending || delMut.isPending;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
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
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text }}>
              {isNew ? 'Nova mensagem' : 'Editar mensagem'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          <TextInput
            value={content}
            onChangeText={setContent}
            multiline
            editable={!busy}
            placeholder="Mensagem que o Mozart envia…"
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

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 110 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text, marginBottom: 5 }}>
                Ordem
              </Text>
              <TextInput
                value={order}
                onChangeText={setOrder}
                keyboardType="number-pad"
                editable={!busy}
                style={{
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  color: theme.text,
                  backgroundColor: theme.bg,
                }}
              />
            </View>
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.bg,
                borderRadius: 12,
                paddingHorizontal: 12,
                marginTop: 22,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13.5, color: theme.text }}>Ativa</Text>
              <Switch value={active} onValueChange={setActive} disabled={busy} />
            </View>
          </View>

          <Button
            title={saveMut.isPending ? 'Salvando…' : 'Salvar'}
            onPress={() => saveMut.mutate()}
            loading={saveMut.isPending}
            disabled={busy}
            fullWidth
          />
          {existing ? (
            <Button
              title="Apagar mensagem"
              variant="danger"
              onPress={() => delMut.mutate()}
              loading={delMut.isPending}
              disabled={busy}
              fullWidth
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
