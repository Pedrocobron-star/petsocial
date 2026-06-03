import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { HealthListSkeleton } from '@/components/health/health-list-skeleton';
import { FONTS } from '@/lib/fonts';
import {
  computeHealthAlerts,
  countAlertsBySeverity,
  type AlertCategory,
  type AlertSeverity,
  type HealthAlert,
} from '@/lib/health-alerts';
import {
  fetchHealthSummary,
  fetchParasiteTreatments,
  fetchPet,
  fetchPetSymptoms,
  fetchVetVisits,
  fetchWeightRecords,
  qk,
} from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; bg: string; color: string; border: string }
> = {
  urgent: { label: 'URGENTE', bg: '#FEE2E2', color: '#7F1D1D', border: '#FCA5A5' },
  warning: { label: 'ATENÇÃO', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  info: { label: 'INFO', bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  vaccine: 'Vacinas',
  parasite: 'Parasitas',
  medication: 'Remédios',
  symptom: 'Sintomas',
  vet_visit: 'Consultas',
  weight: 'Peso',
  age: 'Idade',
};

export default function HealthAlertsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const summaryQuery = useQuery({
    queryKey: qk.healthSummary(id),
    queryFn: () => fetchHealthSummary(id),
    enabled: !!id,
  });
  const parasitesQuery = useQuery({
    queryKey: qk.parasiteTreatments(id),
    queryFn: () => fetchParasiteTreatments(id),
    enabled: !!id,
  });
  const symptomsQuery = useQuery({
    queryKey: qk.petSymptoms(id, 'all'),
    queryFn: () => fetchPetSymptoms(id, 'all'),
    enabled: !!id,
  });
  const vetVisitsQuery = useQuery({
    queryKey: qk.vetVisits(id),
    queryFn: () => fetchVetVisits(id),
    enabled: !!id,
  });
  const weightsQuery = useQuery({
    queryKey: qk.weightRecords(id),
    queryFn: () => fetchWeightRecords(id),
    enabled: !!id,
  });

  const alerts = useMemo<HealthAlert[]>(() => {
    if (!petQuery.data) return [];
    return computeHealthAlerts({
      pet: petQuery.data,
      summary: summaryQuery.data,
      parasites: parasitesQuery.data,
      symptoms: symptomsQuery.data,
      vetVisits: vetVisitsQuery.data,
      weights: weightsQuery.data,
    });
  }, [
    petQuery.data,
    summaryQuery.data,
    parasitesQuery.data,
    symptomsQuery.data,
    vetVisitsQuery.data,
    weightsQuery.data,
  ]);

  const counts = countAlertsBySeverity(alerts);
  const isLoading =
    petQuery.isLoading ||
    summaryQuery.isLoading ||
    parasitesQuery.isLoading ||
    symptomsQuery.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: petQuery.data ? `Alertas — ${petQuery.data.name}` : 'Alertas' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {isLoading && alerts.length === 0 ? <HealthListSkeleton count={3} /> : null}

        {alerts.length > 0 ? (
          <SummaryBar counts={counts} total={alerts.length} />
        ) : null}

        {alerts.length === 0 && !isLoading ? (
          <View style={{ marginTop: 24 }}>
            <EmptyState
              emoji="🎉"
              title="Tudo em ordem!"
              description={
                petQuery.data
                  ? `${petQuery.data.name} não tem alertas de saúde no momento. Continue registrando vacinas, peso e sintomas pra manter o histórico atualizado.`
                  : 'Sem alertas no momento.'
              }
            />
          </View>
        ) : null}

        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}

        {alerts.length > 0 ? <DisclaimerFooter /> : null}
      </ScrollView>
    </View>
  );
}

function SummaryBar({
  counts,
  total,
}: {
  counts: Record<AlertSeverity, number>;
  total: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E5E5',
      }}
    >
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: '#1A1410' }}>{total}</Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: '#737373', marginTop: 2 }}>
          TOTAL
        </Text>
      </View>
      {(['urgent', 'warning', 'info'] as AlertSeverity[]).map((sev) => {
        const meta = SEVERITY_META[sev];
        const count = counts[sev];
        return (
          <View
            key={sev}
            style={{
              flex: 1,
              alignItems: 'center',
              backgroundColor: count > 0 ? meta.bg : '#FAFAFA',
              borderRadius: 10,
              paddingVertical: 6,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: count > 0 ? meta.color : '#A3A3A3',
              }}
            >
              {count}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 9,
                color: count > 0 ? meta.color : '#A3A3A3',
                marginTop: 2,
                letterSpacing: 0.4,
              }}
            >
              {meta.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function AlertCard({ alert }: { alert: HealthAlert }) {
  const { theme } = useTheme();
  const meta = SEVERITY_META[alert.severity];

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        gap: 8,
        borderLeftWidth: 4,
        borderLeftColor: meta.color,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text style={{ fontSize: 26 }}>{alert.emoji}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <View
              style={{
                backgroundColor: meta.bg,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: meta.color }}>
                {meta.label}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: '#F1F5F9',
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#475569' }}>
                {CATEGORY_LABELS[alert.category]}
              </Text>
            </View>
          </View>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 15,
              color: theme.text,
              marginTop: 6,
              lineHeight: 20,
            }}
          >
            {alert.title}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: theme.textDim,
              marginTop: 2,
              lineHeight: 18,
            }}
          >
            {alert.description}
          </Text>
        </View>
      </View>

      {alert.action ? (
        <Link href={alert.action.href as never} asChild>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: meta.color,
              paddingVertical: 10,
              borderRadius: 10,
              marginTop: 4,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' }}>
              {alert.action.label}
            </Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </Pressable>
        </Link>
      ) : null}
    </View>
  );
}

function DisclaimerFooter() {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
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
        Alertas baseados nos registros que você fez no app. Pet Social não substitui veterinário.
        Em casos sérios, procure atendimento profissional imediatamente.
      </Text>
    </View>
  );
}
