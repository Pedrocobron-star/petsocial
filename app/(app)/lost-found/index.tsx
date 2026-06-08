import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { AreaHero } from '@/components/area-hero';
import { EmptyState } from '@/components/empty-state';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { speciesEmoji, speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { formatDistance, getCurrentPosition, haversineKm, type Coords } from '@/lib/geo';
import { fetchLostReports, qk } from '@/lib/queries';
import type { LostReportKind, LostReportWithPet } from '@/lib/types';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { useTheme } from '@/providers/theme-provider';

const FILTERS: { value: LostReportKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'lost', label: 'Perdidos' },
  { value: 'found', label: 'Encontrados' },
];

export default function LostFoundIndexScreen() {
  return (
    <AppThemeProvider app="lostfound">
      <LostFoundInner />
    </AppThemeProvider>
  );
}

function LostFoundInner() {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<LostReportKind | 'all'>('all');
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [myLoc, setMyLoc] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  const query = useQuery({
    queryKey: qk.lostReports(filter),
    queryFn: () => fetchLostReports(filter),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['lost-reports'] });
    setRefreshing(false);
  };

  const toggleNearMe = async () => {
    if (myLoc) {
      setMyLoc(null);
      return;
    }
    setLocating(true);
    const c = await getCurrentPosition();
    setLocating(false);
    setMyLoc(c);
  };

  const reports = query.data ?? [];
  const rows = myLoc
    ? reports
        .map((r) => ({
          report: r,
          distanceKm:
            r.latitude != null && r.longitude != null
              ? haversineKm(myLoc.lat, myLoc.lng, r.latitude, r.longitude)
              : null,
        }))
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
    : reports.map((r) => ({ report: r, distanceKm: null as number | null }));

  return (
    <View className="flex-1" style={{ backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: 'Achados',
          headerRight: () => (
            <Link href={'/(app)/lost-found/report' as never} asChild>
              <Pressable
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5 mr-2"
                style={{ backgroundColor: theme.accent.color }}
              >
                <Ionicons name="add" size={16} color={theme.accent.onAccent} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.accent.onAccent }}>
                  Reportar
                </Text>
              </Pressable>
            </Link>
          ),
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.report.id}
        renderItem={({ item }) => <ReportCard report={item.report} distanceKm={item.distanceKm} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginHorizontal: -12, marginTop: -12, marginBottom: 12 }}>
            <AreaHero area="lostfound" />
            <View
              style={{
                borderBottomWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                paddingTop: 4,
              }}
            >
              <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
              <Pressable
                onPress={toggleNearMe}
                accessibilityRole="button"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  paddingVertical: 8,
                }}
              >
                <Ionicons
                  name={myLoc ? 'navigate' : 'navigate-outline'}
                  size={14}
                  color={myLoc ? theme.accent.color : theme.textDim}
                />
                <Text
                  style={{ fontFamily: FONTS.bodyBold, fontSize: 12.5, color: myLoc ? theme.accent.color : theme.textDim }}
                >
                  {locating
                    ? 'Localizando…'
                    : myLoc
                      ? 'Perto de mim ✓ · toque pra desligar'
                      : 'Ordenar por proximidade'}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          query.isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <ActivityIndicator color={theme.accent.color} />
            </View>
          ) : query.isError ? (
            <EmptyState
              emoji="⚠️"
              title="Não foi possível carregar"
              description="Deu um problema ao buscar os reportes. Verifica sua conexão e tenta de novo."
              action={<Button title="Tentar de novo" onPress={() => query.refetch()} />}
            />
          ) : (
            <EmptyState
              emoji={filter === 'found' ? '🐾' : '🔍'}
              title={
                filter === 'found'
                  ? 'Nenhum pet encontrado reportado'
                  : filter === 'lost'
                  ? 'Nenhum pet perdido por aqui'
                  : 'Sem reportes ativos'
              }
              description="Pets perdidos e encontrados aparecem aqui. Reporte se viu ou perdeu alguém."
              action={
                <Link href={'/(app)/lost-found/report' as never} asChild>
                  <Button title="Criar reporte" />
                </Link>
              }
            />
          )
        }
      />
    </View>
  );
}

function ReportCard({
  report,
  distanceKm,
}: {
  report: LostReportWithPet;
  distanceKm?: number | null;
}) {
  const { theme } = useTheme();
  const kindLabel = report.kind === 'lost' ? 'Pet perdido' : 'Pet encontrado';
  const kindColor = report.kind === 'lost' ? '#991B1B' : '#15803d';
  const kindBg = report.kind === 'lost' ? '#FEE2E2' : '#DCFCE7';

  const displayName = report.pet?.name ?? report.pet_name ?? 'Sem nome';
  const displaySpecies = report.pet?.species ?? report.species;
  const displayBreed = report.pet?.breed ?? report.breed;
  // photo_url do reporte tem prioridade (foto específica), depois cai pro avatar do pet
  const reportPhoto = report.photo_url;
  const linkedPet = report.pet;

  return (
    <Link href={{ pathname: '/lost-found/[id]' as never, params: { id: report.id } as never }} asChild>
      <Pressable
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          gap: 12,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            backgroundColor: '#FED7AA',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {reportPhoto ? (
            <Image source={{ uri: reportPhoto }} style={{ width: 64, height: 64 }} contentFit="cover" />
          ) : linkedPet ? (
            <PetAvatar pet={linkedPet} size={64} />
          ) : (
            <Text style={{ fontSize: 32 }}>
              {displaySpecies ? speciesEmoji(displaySpecies) : '🐾'}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              backgroundColor: kindBg,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: kindColor }}>
              {kindLabel.toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.text }}>
            {displayName}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            {displaySpecies ? speciesLabel(displaySpecies) : 'Espécie não informada'}
            {displayBreed ? ` • ${displayBreed}` : ''}
          </Text>
          <View className="mt-1.5 flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color={theme.textDim} />
            <Text
              style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textMuted, flex: 1 }}
              numberOfLines={1}
            >
              {report.last_seen_location}
            </Text>
          </View>
          {distanceKm != null && (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11.5, color: theme.accent.color, marginTop: 2 }}>
              📍 a {formatDistance(distanceKm)} de você
            </Text>
          )}
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR })}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}
