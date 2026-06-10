import { Ionicons } from '@expo/vector-icons';
import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetAvatar } from '@/components/pet-avatar';
import { CenteredColumn } from '@/components/ui/centered-column';
import { type AlertSeverity } from '@/lib/health-alerts';
import { FONTS } from '@/lib/fonts';
import { useHealthAlerts, type PetAlert } from '@/lib/use-health-alerts';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const GROUPS: { key: AlertSeverity; label: string; sub: string; emoji: string; bg: string; fg: string }[] = [
  { key: 'urgent', label: 'Precisa de atenção agora', sub: 'Atrasado ou vencendo', emoji: '🚨', bg: '#FEE2E2', fg: '#991B1B' },
  { key: 'warning', label: 'Pros próximos dias', sub: 'Programe-se', emoji: '🔔', bg: '#FEF3C7', fg: '#92400E' },
  { key: 'info', label: 'De olho', sub: 'Sem pressa', emoji: '📌', bg: '#DBEAFE', fg: '#1E40AF' },
];

export default function RemindersScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const userId = session?.user.id;

  const { alerts: allAlerts, pets, loading } = useHealthAlerts(userId);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: allAlerts.filter((a) => a.severity === g.key) })).filter((g) => g.items.length > 0),
    [allAlerts],
  );

  const urgentCount = allAlerts.filter((a) => a.severity === 'urgent').length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Lembretes', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={560}>
          {/* Header */}
          <View
            style={{
              backgroundColor: allAlerts.length === 0 ? '#F0FDF4' : urgentCount > 0 ? '#FEF2F2' : '#FFFBEB',
              borderRadius: 18,
              padding: 16,
              marginBottom: 14,
              borderWidth: 1,
              borderColor: allAlerts.length === 0 ? '#BBF7D0' : urgentCount > 0 ? '#FECACA' : '#FDE68A',
            }}
          >
            <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>
              {allAlerts.length === 0 ? 'Tudo em dia! 🌟' : 'O que cuidar'}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#525252', marginTop: 4, lineHeight: 19 }}>
              {allAlerts.length === 0
                ? `Nenhum lembrete pendente nos seus ${pets.length} ${pets.length === 1 ? 'pet' : 'pets'}. Continue assim!`
                : `${allAlerts.length} ${allAlerts.length === 1 ? 'item' : 'itens'} pra cuidar${urgentCount > 0 ? ` · ${urgentCount} urgente${urgentCount > 1 ? 's' : ''}` : ''}.`}
            </Text>
          </View>

          {/* Ativar push */}
          <Link href="/(app)/notification-settings" asChild>
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: theme.surface,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
                marginBottom: 16,
              }}
            >
              <Ionicons name="notifications" size={18} color={theme.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                  Receber lembretes no celular
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                  Ative as notificações pra não esquecer nada
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
            </Pressable>
          </Link>

          {loading ? (
            <ActivityIndicator color={theme.brand} style={{ marginTop: 24 }} />
          ) : pets.length === 0 ? (
            <EmptyState emoji="🐾" title="Sem pets ainda" description="Cadastre um pet pra ver os lembretes de saúde aqui." />
          ) : allAlerts.length === 0 ? (
            <EmptyState emoji="✅" mozart="comemorando" title="Nada pendente" description="Vacinas, vermífugos e remédios em dia. A gente te avisa quando chegar a hora." />
          ) : (
            <View style={{ gap: 18 }}>
              {grouped.map((g) => (
                <View key={g.key} style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 15 }}>{g.emoji}</Text>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: g.fg }}>{g.label}</Text>
                    <View style={{ backgroundColor: g.bg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}>
                      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: g.fg }}>{g.items.length}</Text>
                    </View>
                  </View>
                  {g.items.map((a) => (
                    <ReminderRow key={`${a.pet.id}-${a.id}`} alert={a} tone={g} />
                  ))}
                </View>
              ))}
            </View>
          )}
        </CenteredColumn>
      </ScrollView>
    </View>
  );
}

function ReminderRow({ alert, tone }: { alert: PetAlert; tone: { bg: string; fg: string } }) {
  const { theme } = useTheme();
  const href = alert.action?.href ?? `/pet/${alert.pet.id}/health`;
  return (
    <Link href={href as never} asChild>
      <Pressable
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: theme.surface,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <PetAvatar pet={alert.pet} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 13 }}>{alert.emoji}</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text, flex: 1 }} numberOfLines={1}>
              {alert.title}
            </Text>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }} numberOfLines={1}>
            {alert.pet.name} · {alert.description}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
      </Pressable>
    </Link>
  );
}
