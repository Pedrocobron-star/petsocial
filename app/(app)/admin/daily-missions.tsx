import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
import {
  fetchAllMissions,
  qkAllMissions,
  upsertMission,
  type DailyMissionRow,
} from '@/lib/daily-missions';
import { FONTS } from '@/lib/fonts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

export default function AdminDailyMissionsScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const listQuery = useQuery({ queryKey: qkAllMissions, queryFn: fetchAllMissions, enabled: isAdmin });
  const [editing, setEditing] = useState<DailyMissionRow | null>(null);

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const missions = listQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Missão do Dia · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}>
        <View style={{ backgroundColor: '#FFF7ED', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FED7AA' }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#C2410C', letterSpacing: 1 }}>
            OBJETIVO DO DIA
          </Text>
          <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text, marginTop: 2 }}>
            Missão do Dia
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 4, lineHeight: 17 }}>
            Um desafio de foto por dia do mês. Quem posta com a hashtag do dia ganha pontos e conquistas. As notificações das 8h usam o texto da missão de hoje.
          </Text>
        </View>

        {listQuery.isLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}

        {missions.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => setEditing(m)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.borderLight,
              flexDirection: 'row',
              gap: 12,
              alignItems: 'center',
              opacity: m.active ? 1 : 0.55,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: '#FFEDD5',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.textDim }}>Dia {m.day_of_month}</Text>
                <View style={{ backgroundColor: '#FFEDD5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9.5, color: '#9A3412' }}>+{m.points} pts</Text>
                </View>
                {!m.active ? (
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9.5, color: '#DC2626' }}>OFF</Text>
                ) : null}
              </View>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text, marginTop: 1 }} numberOfLines={1}>
                {m.title}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11.5, color: '#C2410C', marginTop: 1 }}>#{m.hashtag}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        ))}
      </ScrollView>

      <MissionEditModal target={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

function MissionEditModal({ target, onClose }: { target: DailyMissionRow | null; onClose: () => void }) {
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [hashtag, setHashtag] = useState('');
  const [points, setPoints] = useState('15');
  const [emoji, setEmoji] = useState('📸');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!target) return;
    setTitle(target.title);
    setPrompt(target.prompt);
    setHashtag(target.hashtag);
    setPoints(String(target.points));
    setEmoji(target.emoji);
    setActive(target.active);
  }, [target]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error('sem missão');
      const p = parseInt(points, 10);
      if (!title.trim()) throw new Error('Dê um título à missão');
      if (!prompt.trim()) throw new Error('Escreva o que o tutor deve postar');
      if (!hashtag.trim()) throw new Error('Defina a hashtag do dia');
      if (Number.isNaN(p) || p < 1 || p > 100) throw new Error('Pontos entre 1 e 100');
      await upsertMission({
        day_of_month: target.day_of_month,
        title,
        prompt,
        hashtag,
        points: p,
        emoji,
        active,
      });
    },
    onSuccess: () => {
      toast.success('Missão salva!');
      qc.invalidateQueries({ queryKey: qkAllMissions });
      qc.invalidateQueries({ queryKey: ['daily-mission', 'today'] });
      onClose();
    },
    onError: (e) => toast.error('Erro ao salvar', e instanceof Error ? e.message : 'Tenta de novo'),
  });

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <ScrollView
          style={{ maxHeight: '92%' }}
          contentContainerStyle={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 20,
            paddingBottom: 34,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: theme.text }}>
              Missão do dia {target?.day_of_month}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          <Field label="Emoji">
            <TextInput value={emoji} onChangeText={setEmoji} maxLength={4} style={inputStyle(theme)} />
          </Field>
          <Field label="Título">
            <TextInput value={title} onChangeText={setTitle} placeholder="Ex: O trono dele" placeholderTextColor={theme.textDim} style={inputStyle(theme)} />
          </Field>
          <Field label="O que postar (texto da missão)">
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              multiline
              placeholder="Descreva a foto do dia..."
              placeholderTextColor={theme.textDim}
              style={[inputStyle(theme), { minHeight: 80, textAlignVertical: 'top' }]}
            />
          </Field>
          <Field label="Hashtag do dia (sem #)">
            <TextInput
              value={hashtag}
              onChangeText={setHashtag}
              autoCapitalize="none"
              placeholder="CantinhoFavorito"
              placeholderTextColor={theme.textDim}
              style={inputStyle(theme)}
            />
          </Field>
          <Field label="Pontos">
            <TextInput value={points} onChangeText={setPoints} keyboardType="number-pad" style={inputStyle(theme)} />
          </Field>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>Missão ativa</Text>
            <Switch value={active} onValueChange={setActive} />
          </View>

          <Button title="Salvar missão" onPress={() => saveMut.mutate()} loading={saveMut.isPending} disabled={saveMut.isPending} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    borderWidth: 1,
    borderColor: theme.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: theme.text,
    backgroundColor: theme.bg,
  } as const;
}
