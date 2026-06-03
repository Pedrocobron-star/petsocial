import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Shimmer } from '@/components/ui/shimmer';
import { FONTS } from '@/lib/fonts';
import {
  cancelAllHealthReminders,
  listScheduledHealthReminders,
} from '@/lib/health-notifications';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type PermissionState = 'unknown' | 'granted' | 'denied' | 'undetermined';

interface ScheduledItem {
  id: string;
  sourceKey: string;
  title: string;
  date: Date | null;
}

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (Platform.OS === 'web') {
        setPermission('denied');
        setScheduled([]);
        return;
      }
      const perm = await Notifications.getPermissionsAsync();
      setPermission(perm.status as PermissionState);
      const items = await listScheduledHealthReminders();
      setScheduled(items);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestPermission = async () => {
    if (Platform.OS === 'web') return;
    const result = await Notifications.requestPermissionsAsync();
    setPermission(result.status as PermissionState);
    if (result.status === 'granted') {
      toast.success('Permissão concedida!');
      await refresh();
    } else {
      toast.info('Permissão não concedida — abra as configurações do sistema pra liberar');
    }
  };

  const cancelOne = async (id: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      setScheduled((prev) => prev.filter((s) => s.id !== id));
      toast.success('Lembrete cancelado');
    } catch {
      toast.error('Não foi possível cancelar');
    }
  };

  const cancelAll = () =>
    Alert.alert('Cancelar TODOS os lembretes?', 'Você pode reagendar editando cada vacina/parasita/consulta.', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Cancelar todos',
        style: 'destructive',
        onPress: async () => {
          await cancelAllHealthReminders();
          setScheduled([]);
          toast.success('Todos os lembretes cancelados');
        },
      },
    ]);

  const grouped = groupByDay(scheduled);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Notificações' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* Status banner */}
        <PermissionBanner
          state={permission}
          onRequest={requestPermission}
          onRefresh={refresh}
          refreshing={refreshing}
        />

        {/* Lista de agendados */}
        {loading ? (
          <View style={{ gap: 8 }}>
            <Shimmer height={48} borderRadius={10} />
            <Shimmer height={48} borderRadius={10} />
            <Shimmer height={48} borderRadius={10} />
          </View>
        ) : scheduled.length === 0 ? (
          <EmptyState
            emoji="🔔"
            title="Sem lembretes agendados"
            description={
              permission === 'granted'
                ? 'Quando você adicionar uma vacina/parasita/consulta com data futura, os lembretes aparecem aqui.'
                : 'Habilite as notificações pra começar a receber lembretes do seu pet.'
            }
          />
        ) : (
          <>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: theme.brand,
                marginTop: 8,
              }}
            >
              Próximos {scheduled.length} lembretes
            </Text>
            {grouped.map(({ day, items }) => (
              <View key={day} style={{ gap: 6 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 12,
                    color: theme.textDim,
                    marginTop: 6,
                  }}
                >
                  {day}
                </Text>
                {items.map((item) => (
                  <ScheduledRow key={item.id} item={item} onCancel={() => cancelOne(item.id)} />
                ))}
              </View>
            ))}

            <View style={{ marginTop: 16 }}>
              <Button
                title="Cancelar TODOS os lembretes"
                variant="secondary"
                onPress={cancelAll}
                fullWidth
              />
            </View>
          </>
        )}

        {/* Disclaimer rodapé */}
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginTop: 16,
            padding: 12,
            backgroundColor: '#FEF3C7',
            borderRadius: 10,
          }}
        >
          <Text style={{ fontSize: 16 }}>ℹ️</Text>
          <Text
            style={{
              flex: 1,
              fontFamily: FONTS.body,
              fontSize: 11,
              color: '#78350F',
              lineHeight: 16,
            }}
          >
            Lembretes são locais (não dependem de internet). Vacinas e parasitas com data futura
            geram 2 notifs (antecipada + no dia). Consultas geram 1 (véspera). Sintomas não geram
            push — só ficam no app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------------

function PermissionBanner({
  state,
  onRequest,
  onRefresh,
  refreshing,
}: {
  state: PermissionState;
  onRequest: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { theme } = useTheme();
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          backgroundColor: '#FEF3C7',
          padding: 14,
          borderRadius: 14,
          gap: 6,
        }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#92400E' }}>
          🌐 Notificações disponíveis no app nativo
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#78350F', lineHeight: 17 }}>
          No navegador, os alertas aparecem dentro do app (em LEMBRETES no health hub). Pra receber
          notificações push no celular, baixe o Pet Social no app store.
        </Text>
      </View>
    );
  }

  const granted = state === 'granted';
  return (
    <View
      style={{
        backgroundColor: granted ? '#DCFCE7' : '#FEE2E2',
        padding: 14,
        borderRadius: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 22 }}>{granted ? '🔔' : '🔕'}</Text>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 14,
              color: granted ? '#166534' : '#991B1B',
            }}
          >
            {granted ? 'Notificações ativas' : 'Notificações desativadas'}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: granted ? '#15803D' : '#7F1D1D',
              marginTop: 2,
            }}
          >
            {granted
              ? 'Você receberá lembretes de vacinas, parasitas e consultas.'
              : 'Sem permissão, os lembretes só aparecem dentro do app.'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {!granted ? (
          <Pressable
            onPress={onRequest}
            style={{
              flex: 1,
              backgroundColor: '#DC2626',
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
              Habilitar notificações
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onRefresh}
          disabled={refreshing}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            opacity: refreshing ? 0.5 : 1,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScheduledRow({ item, onCancel }: { item: ScheduledItem; onCancel: () => void }) {
  const { theme } = useTheme();
  const kindMeta = kindFromSourceKey(item.sourceKey);
  const dateStr = item.date
    ? item.date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderLeftWidth: 3,
        borderLeftColor: kindMeta.color,
      }}
    >
      <Text style={{ fontSize: 20 }}>{kindMeta.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
          {item.title || kindMeta.label}
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
          {dateStr}
        </Text>
      </View>
      <Pressable onPress={onCancel} hitSlop={8} style={{ padding: 6 }}>
        <Ionicons name="close-circle" size={20} color={theme.textDim} />
      </Pressable>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function kindFromSourceKey(sourceKey: string): { emoji: string; label: string; color: string } {
  if (sourceKey.startsWith('vaccine:')) return { emoji: '💉', label: 'Vacina', color: '#F97316' };
  if (sourceKey.startsWith('parasite:')) return { emoji: '💊', label: 'Parasitas', color: '#16A34A' };
  if (sourceKey.startsWith('vet_visit:')) return { emoji: '🩺', label: 'Consulta', color: '#0EA5E9' };
  if (sourceKey.startsWith('medication:')) return { emoji: '🧪', label: 'Remédio', color: '#8B5CF6' };
  return { emoji: '🔔', label: 'Lembrete', color: '#737373' };
}

function groupByDay(items: ScheduledItem[]): { day: string; items: ScheduledItem[] }[] {
  const map = new Map<string, ScheduledItem[]>();
  for (const it of items) {
    const day = it.date
      ? it.date.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
        })
      : 'Sem data';
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(it);
  }
  return Array.from(map.entries())
    .map(([day, items]) => ({
      day: day.charAt(0).toUpperCase() + day.slice(1),
      items: items.sort((a, b) => (a.date && b.date ? a.date.getTime() - b.date.getTime() : 0)),
    }))
    .sort((a, b) => {
      const aTime = a.items[0]?.date?.getTime() ?? Infinity;
      const bTime = b.items[0]?.date?.getTime() ?? Infinity;
      return aTime - bTime;
    });
}
