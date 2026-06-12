import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import {
  computeHealthAlerts,
  countAlertsBySeverity,
  type AlertSeverity,
  type HealthAlert,
} from '@/lib/health-alerts';
import { computeHealthScore } from '@/lib/health-score';
import { petAgeText } from '@/lib/pet-age';
import {
  fetchHealthSummary,
  fetchMyPets,
  fetchParasiteSummary,
  fetchParasiteTreatments,
  fetchPetSymptoms,
  fetchVetVisits,
  fetchWeightRecords,
  qk,
} from '@/lib/queries';
import type { HealthSummary, Pet, PetSymptom } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

/**
 * Vista consolidada de todos os pets — uma tela só pra tutor ver o estado
 * de saúde de cada pet, ranqueado por score (pior primeiro). Ideal pra
 * famílias com múltiplos pets.
 */
export default function PetsOverviewScreen() {
  const { session } = useSession();
  const { theme } = useTheme();
  const userId = session?.user.id;

  const petsQuery = useQuery({
    queryKey: userId ? qk.myPets(userId) : ['my-pets-noop'],
    queryFn: () => (userId ? fetchMyPets(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  const petsRaw = petsQuery.data;
  const pets = useMemo(() => petsRaw ?? [], [petsRaw]);

  // Carrega summary, parasiteSummary e activeSymptoms pra TODOS os pets em paralelo
  const summariesQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.healthSummary(pet.id),
      queryFn: () => fetchHealthSummary(pet.id),
    })),
  });
  const parasitesQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.parasiteSummary(pet.id),
      queryFn: () => fetchParasiteSummary(pet.id),
    })),
  });
  const symptomsQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.petSymptoms(pet.id, 'active'),
      queryFn: () => fetchPetSymptoms(pet.id, 'active'),
    })),
  });
  // Arrays completos — sem eles os alertas de parasita atrasado / variação de peso /
  // consulta vencida NÃO apareciam aqui, deixando o overview otimista vs o hub.
  const parasiteTreatmentsQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.parasiteTreatments(pet.id),
      queryFn: () => fetchParasiteTreatments(pet.id),
    })),
  });
  const vetVisitsQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.vetVisits(pet.id),
      queryFn: () => fetchVetVisits(pet.id),
    })),
  });
  const weightsQuery = useQueries({
    queries: pets.map((pet) => ({
      queryKey: qk.weightRecords(pet.id),
      queryFn: () => fetchWeightRecords(pet.id),
    })),
  });

  const rows = useMemo(() => {
    return pets.map((pet, i) => {
      const summary = summariesQuery[i]?.data;
      const parasiteSummary = parasitesQuery[i]?.data;
      const symptoms = symptomsQuery[i]?.data ?? [];
      const parasites = parasiteTreatmentsQuery[i]?.data ?? [];
      const vetVisits = vetVisitsQuery[i]?.data ?? [];
      const weights = weightsQuery[i]?.data ?? [];
      const score = summary ? computeHealthScore(summary, parasiteSummary).score : null;
      const alerts: HealthAlert[] = summary
        ? computeHealthAlerts({ pet, summary, symptoms, parasites, vetVisits, weights })
        : [];
      const counts = countAlertsBySeverity(alerts);
      return {
        pet,
        summary,
        symptoms,
        score,
        alerts,
        counts,
        topAlert: alerts[0] ?? null,
        loading:
          summariesQuery[i]?.isLoading ||
          parasitesQuery[i]?.isLoading ||
          symptomsQuery[i]?.isLoading,
      };
    });
  }, [
    pets,
    summariesQuery,
    parasitesQuery,
    symptomsQuery,
    parasiteTreatmentsQuery,
    vetVisitsQuery,
    weightsQuery,
  ]);

  // Ordena: alertas urgentes primeiro, depois score asc (pior cuidado primeiro)
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (a.counts.urgent !== b.counts.urgent) return b.counts.urgent - a.counts.urgent;
        if (a.counts.warning !== b.counts.warning) return b.counts.warning - a.counts.warning;
        const sa = a.score ?? 100;
        const sb = b.score ?? 100;
        return sa - sb;
      }),
    [rows],
  );

  const totalAlerts = rows.reduce((sum, r) => sum + r.alerts.length, 0);
  const totalUrgent = rows.reduce((sum, r) => sum + r.counts.urgent, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Meus pets · Saúde' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {pets.length > 1 ? (
          <OverviewHeader
            petsCount={pets.length}
            totalAlerts={totalAlerts}
            totalUrgent={totalUrgent}
          />
        ) : null}

        {pets.length === 0 && !petsQuery.isLoading ? (
          <EmptyState
            emoji="🐾"
            title="Sem pets cadastrados ainda"
            description="Adicione seu primeiro pet pra começar a acompanhar a saúde dele."
            action={
              <Link href="/pet/new" asChild>
                <Button title="Adicionar pet" onPress={() => undefined} />
              </Link>
            }
          />
        ) : null}

        {sorted.map((row) => (
          <PetHealthRow key={row.pet.id} row={row} />
        ))}
      </ScrollView>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Header
// ----------------------------------------------------------------------------

function OverviewHeader({
  petsCount,
  totalAlerts,
  totalUrgent,
}: {
  petsCount: number;
  totalAlerts: number;
  totalUrgent: number;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: totalUrgent > 0 ? '#FEE2E2' : '#DCFCE7',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{totalUrgent > 0 ? '⚠️' : '✓'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
          {petsCount} pets sob seu cuidado
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
          {totalAlerts === 0
            ? 'Todos em ordem 🌟'
            : totalUrgent > 0
              ? `${totalUrgent} alerta${totalUrgent > 1 ? 's' : ''} urgente${totalUrgent > 1 ? 's' : ''}, ${totalAlerts - totalUrgent} pra acompanhar`
              : `${totalAlerts} alerta${totalAlerts > 1 ? 's' : ''} pra acompanhar`}
        </Text>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Row per pet
// ----------------------------------------------------------------------------

interface Row {
  pet: Pet;
  summary: HealthSummary | undefined;
  symptoms: PetSymptom[];
  score: number | null;
  alerts: HealthAlert[];
  counts: Record<AlertSeverity, number>;
  topAlert: HealthAlert | null;
  loading: boolean;
}

function PetHealthRow({ row }: { row: Row }) {
  const { theme } = useTheme();
  const { pet, score, topAlert, alerts } = row;
  const scoreTone =
    score == null
      ? { bar: theme.borderLight, label: 'Carregando' }
      : score >= 80
        ? { bar: '#16A34A', label: 'Em dia' }
        : score >= 50
          ? { bar: '#F59E0B', label: 'Atenção' }
          : { bar: '#DC2626', label: 'Precisa cuidar' };

  return (
    <Link href={`/pet/${pet.id}/health` as never} asChild>
      <Pressable
        style={{
          backgroundColor: theme.surface,
          borderRadius: 16,
          padding: 14,
          gap: 10,
          borderWidth: 1,
          borderColor: theme.border,
        }}
      >
        {/* Top row: avatar + name + score */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PetAvatar pet={pet} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 17, color: theme.text }}>
              {pet.name}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              {speciesLabel(pet.species)}
              {pet.breed ? ` · ${pet.breed}` : ''}
              {pet.birthdate ? ` · ${petAgeText(pet.birthdate)}` : ''}
            </Text>
          </View>
          {score != null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 22, color: scoreTone.bar }}>
                {score}%
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 9,
                  color: scoreTone.bar,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {scoreTone.label}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Score bar */}
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.borderLight,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${score ?? 0}%`,
              height: '100%',
              backgroundColor: scoreTone.bar,
            }}
          />
        </View>

        {/* Top alert (urgent/warning) */}
        {topAlert ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor:
                topAlert.severity === 'urgent'
                  ? '#FEE2E2'
                  : topAlert.severity === 'warning'
                    ? '#FEF3C7'
                    : '#DBEAFE',
              padding: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ fontSize: 16 }}>{topAlert.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color:
                    topAlert.severity === 'urgent'
                      ? '#991B1B'
                      : topAlert.severity === 'warning'
                        ? '#92400E'
                        : '#1E40AF',
                }}
              >
                {topAlert.title}
              </Text>
              {alerts.length > 1 ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 10,
                    color: theme.textDim,
                    marginTop: 1,
                  }}
                >
                  +{alerts.length - 1} {alerts.length - 1 === 1 ? 'alerta' : 'alertas'}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={14} color={theme.textDim} />
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontSize: 12 }}>🌟</Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              Nenhum alerta no momento
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}
