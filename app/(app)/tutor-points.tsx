import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { TutorLevelBar } from '@/components/tutor-level-bar';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import {
  fetchMyTutorLedger,
  fetchMyTutorPoints,
  qkMyTutorLedger,
  qkMyTutorPoints,
  tutorSourceLabel,
  type TutorPointEntry,
} from '@/lib/tutor-points';
import { useTheme } from '@/providers/theme-provider';

// Como ganhar PT (espelha os valores dos triggers em tutor-points-ledger.sql).
const EARN: { emoji: string; label: string; pts: string }[] = [
  { emoji: '💉', label: 'Registrar uma vacina', pts: '+40' },
  { emoji: '🏥', label: 'Consulta no veterinário', pts: '+30' },
  { emoji: '💊', label: 'Vermífugo / antipulga', pts: '+20' },
  { emoji: '⚖️', label: 'Atualizar o peso (1x/mês)', pts: '+15' },
  { emoji: '🎯', label: 'Cumprir a Missão do Dia', pts: '+15' },
  { emoji: '📸', label: 'Postar no feed (1x/dia)', pts: '+5' },
];

export default function TutorPointsScreen() {
  const { theme } = useTheme();
  const totalQuery = useQuery({ queryKey: qkMyTutorPoints, queryFn: fetchMyTutorPoints, staleTime: 60_000 });
  const ledgerQuery = useQuery({
    queryKey: qkMyTutorLedger,
    queryFn: () => fetchMyTutorLedger(60),
    staleTime: 60_000,
  });
  const entries = ledgerQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Pontos de Tutor' }} />
      <FlatList
        data={entries}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={
          <CenteredColumn maxWidth={540}>
            <TutorLevelBar points={totalQuery.data ?? 0} />

            {/* Como ganhar pontos */}
            <View style={{ marginTop: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 15, color: theme.text, marginBottom: 8 }}>
                Como ganhar pontos
              </Text>
              {EARN.map((e) => (
                <View key={e.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 17 }}>{e.emoji}</Text>
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>{e.label}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#16A34A' }}>{e.pts}</Text>
                </View>
              ))}
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 6, lineHeight: 16 }}>
                Cada coisa conta uma vez por período (sem farm). O 1º do mês no ranking ganha 1 mês de Pet Pro.
              </Text>
            </View>

            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                color: theme.textDim,
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginTop: 18,
                marginBottom: 4,
                paddingHorizontal: 4,
              }}
            >
              Seu histórico
            </Text>
          </CenteredColumn>
        }
        renderItem={({ item }) => <LedgerRow entry={item} />}
        ListEmptyComponent={
          ledgerQuery.isLoading ? (
            <View style={{ paddingTop: 30 }}>
              <ActivityIndicator color={theme.brand} />
            </View>
          ) : (
            <EmptyState
              emoji="⭐"
              title="Você ainda não tem pontos"
              description="Cuide do seu pet, cumpra a Missão do Dia e poste no feed — cada ação vira ponto."
            />
          )
        }
      />
    </View>
  );
}

function LedgerRow({ entry }: { entry: TutorPointEntry }) {
  const { theme } = useTheme();
  const { emoji, label } = tutorSourceLabel(entry.source);
  return (
    <CenteredColumn maxWidth={540}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginBottom: 6,
          borderRadius: 14,
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.borderLight,
        }}
      >
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>{label}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}>
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#16A34A' }}>+{entry.points}</Text>
      </View>
    </CenteredColumn>
  );
}
