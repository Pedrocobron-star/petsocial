import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ExploreSearchBar } from '@/components/explore-search-bar';
import { PopularPetCard } from '@/components/popular-pet-card';
import { SuggestedPetsRow } from '@/components/suggested-pets-row';
import { TrendingHashtags } from '@/components/trending-hashtags';
import { CenteredColumn } from '@/components/ui/centered-column';
import { WallOfFameBanner } from '@/components/wall-of-fame-banner';
import { FONTS } from '@/lib/fonts';
import { fetchPopularPets, qk, searchPets } from '@/lib/queries';
import { useActivePet } from '@/providers/active-pet-provider';
import { useTheme } from '@/providers/theme-provider';

const RECENT_KEY = 'petsocial:explore-recent';
const RECENT_MAX = 6;

export default function ExploreScreen() {
  const { activePet } = useActivePet();
  const { theme } = useTheme();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const trimmed = query.trim();
  const isSearching = trimmed.length > 0;

  // Carrega recent searches da AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRecent(parsed.slice(0, RECENT_MAX));
        } catch {
          // ignora JSON inválido
        }
      }
    });
  }, []);

  // Persiste recent search quando user envia uma busca (>= 2 chars)
  const persistRecent = (q: string) => {
    const norm = q.trim();
    if (norm.length < 2) return;
    setRecent((prev) => {
      const next = [norm, ...prev.filter((r) => r.toLowerCase() !== norm.toLowerCase())].slice(
        0,
        RECENT_MAX,
      );
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {
        // ignora erro de storage
      });
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {
      // ignora
    });
  };

  const popularQuery = useQuery({
    queryKey: qk.explore(),
    queryFn: () => fetchPopularPets(activePet!.id),
    enabled: !!activePet && !isSearching,
  });

  const searchQuery = useQuery({
    queryKey: qk.search(trimmed),
    queryFn: () => searchPets(trimmed),
    enabled: isSearching,
  });

  // Salva busca quando completa com resultado
  useEffect(() => {
    if (isSearching && searchQuery.isSuccess && trimmed.length >= 2) {
      persistRecent(trimmed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery.isSuccess, trimmed]);

  const items = isSearching ? (searchQuery.data ?? []) : (popularQuery.data ?? []);
  const isLoading = isSearching ? searchQuery.isLoading : popularQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (isSearching) {
        await qc.invalidateQueries({ queryKey: qk.search(trimmed) });
      } else {
        await qc.invalidateQueries({ queryKey: qk.explore() });
      }
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Header com título + search bar */}
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: theme.borderLight,
          backgroundColor: theme.surface,
          paddingVertical: 12,
        }}
      >
        <CenteredColumn maxWidth={720} withMargin={false} style={{ paddingHorizontal: 16 }}>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 28,
              color: theme.text,
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            Descobrir 🔍
          </Text>
          <ExploreSearchBar value={query} onChange={setQuery} />
        </CenteredColumn>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 8 }}>
              <PopularPetCard pet={item} rank={isSearching ? undefined : index + 1} />
            </View>
          </CenteredColumn>
        )}
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 120, flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: 48, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color={theme.brand} />
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                {isSearching ? `Buscando "${trimmed}"...` : 'Carregando pets...'}
              </Text>
            </View>
          ) : isSearching ? (
            <EmptyState
              emoji="🔍"
              mozart="detetive"
              title="Nada encontrado"
              description={`Nenhum pet com "${trimmed}" no nome. Tenta uma busca diferente.`}
            />
          ) : (
            <EmptyState
              emoji="🐾"
              mozart="oi"
              title="Nenhum pet ainda"
              description="Convide amigos pra cadastrar os pets deles!"
            />
          )
        }
        ListHeaderComponent={
          !isSearching ? (
            <View>
              {activePet ? <WallOfFameBanner /> : null}
              <SuggestedPetsRow />
              <TrendingHashtags />

              {/* Recent searches — só aparece quando há histórico */}
              {recent.length > 0 ? (
                <CenteredColumn maxWidth={540}>
                  <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="time-outline" size={14} color={theme.textDim} />
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 11,
                            letterSpacing: 1.2,
                            color: theme.textDim,
                            textTransform: 'uppercase',
                          }}
                        >
                          Buscas recentes
                        </Text>
                      </View>
                      <Pressable hitSlop={6} onPress={clearRecent}>
                        <Text
                          style={{
                            fontFamily: FONTS.bodyMedium,
                            fontSize: 11,
                            color: theme.brand,
                          }}
                        >
                          Limpar
                        </Text>
                      </Pressable>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {recent.map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => setQuery(r)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: theme.surface,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: theme.borderLight,
                          }}
                        >
                          <Ionicons name="search" size={10} color={theme.textDim} />
                          <Text
                            style={{
                              fontFamily: FONTS.bodyMedium,
                              fontSize: 12,
                              color: theme.text,
                            }}
                          >
                            {r}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </CenteredColumn>
              ) : null}

              {items.length > 0 ? (
                <CenteredColumn maxWidth={540}>
                  <View style={{ marginTop: 18, marginBottom: 4 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 11,
                        letterSpacing: 1.4,
                        color: theme.brand,
                        textTransform: 'uppercase',
                      }}
                    >
                      Ranking semanal
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.display,
                        fontSize: 20,
                        color: theme.text,
                        marginTop: 1,
                        letterSpacing: -0.3,
                      }}
                    >
                      Pets mais seguidos 👑
                    </Text>
                  </View>
                </CenteredColumn>
              ) : null}
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
