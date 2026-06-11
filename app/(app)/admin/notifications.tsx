import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import {
  AUDIENCE_LABELS,
  AUDIENCE_OPTIONS,
  adminCancelScheduledNotification,
  adminCreateScheduledNotification,
  adminListScheduledNotifications,
  adminRunDispatchNow,
  qkScheduledNotif,
  type NotifAudience,
  type ScheduledNotification,
} from '@/lib/scheduled-notifications';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export default function AdminNotificationsScreen() {
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const isAdmin = session?.user.email === ADMIN_EMAIL;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [audience, setAudience] = useState<NotifAudience>('all');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [schedDate, setSchedDate] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  });
  const [schedTime, setSchedTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });

  const listQuery = useQuery({
    queryKey: qkScheduledNotif.list,
    queryFn: () => adminListScheduledNotifications(100),
    enabled: isAdmin,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const clean = title.trim();
      if (!clean) throw new Error('Dá um título pra notificação');
      let scheduledAt: string;
      if (mode === 'schedule') {
        const dt = new Date(`${schedDate}T${schedTime}`);
        if (Number.isNaN(dt.getTime())) throw new Error('Data/hora inválida');
        if (dt.getTime() <= Date.now()) throw new Error('Escolha um horário no futuro');
        scheduledAt = dt.toISOString();
      } else {
        scheduledAt = new Date().toISOString();
      }
      await adminCreateScheduledNotification({
        title: clean,
        body: body.trim() || null,
        url: url.trim() || null,
        audience,
        scheduled_at: scheduledAt,
      });
      if (mode === 'now') {
        try {
          await adminRunDispatchNow();
        } catch {
          // A notificação JÁ foi criada; só o envio imediato falhou. Não engole:
          // avisa que ela ainda sai no próximo ciclo do cron de dispatch (5 min).
          throw new Error('Notificação criada, mas o envio imediato falhou — ela sai no próximo ciclo (até 5 min).');
        }
      }
    },
    onSuccess: () => {
      toast.success(
        mode === 'now' ? 'Notificação enviada!' : 'Notificação agendada!',
        mode === 'now' ? 'Já saiu pra base' : 'Sai automaticamente no horário marcado',
      );
      setTitle('');
      setBody('');
      setUrl('');
      qc.invalidateQueries({ queryKey: qkScheduledNotif.list });
    },
    onError: (e) => toast.error('Não consegui enviar', e instanceof Error ? e.message : 'Tenta de novo'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => adminCancelScheduledNotification(id),
    onSuccess: () => {
      toast.success('Agendamento cancelado');
      qc.invalidateQueries({ queryKey: qkScheduledNotif.list });
    },
    onError: () => toast.error('Erro ao cancelar'),
  });

  if (!session) return <Redirect href="/welcome" />;
  if (!isAdmin) return <Redirect href="/(app)/(tabs)" />;

  const rows = listQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Notificações · Admin' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
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
              backgroundColor: '#3B82F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="notifications" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#93C5FD', letterSpacing: 1 }}>
              BROADCAST
            </Text>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#FFFFFF', marginTop: 2 }}>
              Criar notificação
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#A3A3A3', marginTop: 2 }}>
              Aparece no app e como push no celular
            </Text>
          </View>
        </View>

        {/* Compositor */}
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: theme.borderLight,
            gap: 12,
          }}
        >
          <Labeled label="Título *">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex.: 🐾 Novidade no Maestro Pet!"
              placeholderTextColor={theme.textDim}
              style={inputStyle(theme)}
            />
          </Labeled>
          <Labeled label="Mensagem">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Texto que aparece embaixo do título"
              placeholderTextColor={theme.textDim}
              multiline
              style={[inputStyle(theme), { minHeight: 64, textAlignVertical: 'top' }]}
            />
          </Labeled>
          <Labeled label="Link ao tocar (opcional)">
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="/news  ou  /(app)/games"
              placeholderTextColor={theme.textDim}
              autoCapitalize="none"
              style={inputStyle(theme)}
            />
          </Labeled>

          {/* Público */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Enviar para</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {AUDIENCE_OPTIONS.map((opt) => {
                const sel = audience === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setAudience(opt.value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1.5,
                      borderColor: sel ? theme.brand : theme.borderLight,
                      backgroundColor: sel ? theme.brandSurface : theme.surface,
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: sel ? theme.brand : theme.text }}>
                      {opt.label}
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>{opt.sub}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Quando */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>Quando</Text>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.bg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
                padding: 4,
                gap: 4,
              }}
            >
              <ModeSeg label="Enviar agora" selected={mode === 'now'} onPress={() => setMode('now')} theme={theme} />
              <ModeSeg label="Agendar" selected={mode === 'schedule'} onPress={() => setMode('schedule')} theme={theme} />
            </View>
          </View>

          {mode === 'schedule' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Labeled label="Data" style={{ flex: 1.4 }}>
                <TextInput
                  value={schedDate}
                  onChangeText={setSchedDate}
                  placeholder="AAAA-MM-DD"
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                  style={inputStyle(theme)}
                />
              </Labeled>
              <Labeled label="Hora" style={{ flex: 1 }}>
                <TextInput
                  value={schedTime}
                  onChangeText={setSchedTime}
                  placeholder="HH:MM"
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="none"
                  style={inputStyle(theme)}
                />
              </Labeled>
            </View>
          ) : null}

          <Button
            title={mode === 'now' ? 'Enviar agora' : 'Agendar notificação'}
            onPress={() => createMut.mutate()}
            loading={createMut.isPending}
            fullWidth
          />
        </View>

        {/* Histórico */}
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text, marginTop: 4 }}>
          Enviadas e agendadas
        </Text>
        {listQuery.isLoading ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            <ActivityIndicator color={theme.textDim} />
          </View>
        ) : null}
        {rows.map((n: ScheduledNotification) => {
          const pending = !n.sent_at;
          return (
            <View
              key={n.id}
              style={{
                backgroundColor: theme.surface,
                borderRadius: 14,
                padding: 14,
                borderWidth: 1,
                borderColor: theme.borderLight,
                gap: 6,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    backgroundColor: pending ? '#FEF3C7' : '#DCFCE7',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 9,
                      letterSpacing: 0.4,
                      color: pending ? '#92400E' : '#166534',
                    }}
                  >
                    {pending ? 'AGENDADA' : 'ENVIADA'}
                  </Text>
                </View>
                <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
                  {AUDIENCE_LABELS[n.audience]}
                  {!pending && n.sent_count != null ? ` · ${n.sent_count} pessoas` : ''}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>{n.title}</Text>
              {n.body ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: theme.textDim }}>{n.body}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}>
                  {pending ? 'Sai ' : 'Enviada '}
                  {format(parseISO(pending ? n.scheduled_at : (n.sent_at as string)), "d/MM 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </Text>
                {pending ? (
                  <Pressable onPress={() => cancelMut.mutate(n.id)} hitSlop={6}>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#DC2626' }}>Cancelar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}

        {!listQuery.isLoading && rows.length === 0 ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, textAlign: 'center', padding: 20 }}>
            Nenhuma notificação ainda. Crie a primeira acima 👆
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Labeled({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  const { theme } = useTheme();
  return (
    <View style={[{ gap: 5 }, style]}>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>{label}</Text>
      {children}
    </View>
  );
}

function ModeSeg({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: 9,
        alignItems: 'center',
        backgroundColor: selected ? theme.brand : 'transparent',
      }}
    >
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: selected ? '#FFFFFF' : theme.textDim }}>
        {label}
      </Text>
    </Pressable>
  );
}

function inputStyle(theme: ReturnType<typeof useTheme>['theme']) {
  return {
    borderWidth: 1,
    borderColor: theme.borderLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: theme.text,
    backgroundColor: theme.bg,
  } as const;
}
