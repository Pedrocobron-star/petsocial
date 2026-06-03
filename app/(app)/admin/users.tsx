import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Redirect, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

const ADMIN_EMAIL = 'pedrocobron@gmail.com';
const PAGE_SIZE = 25;

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
  total_minutes: number;
  sessions_count: number;
  pets_count: number;
  posts_count: number;
  is_pro: boolean;
}

type SortKey = 'recent_signup' | 'recent_active' | 'total_time';

async function fetchUsers(
  offset: number,
  search: string,
  sort: SortKey,
): Promise<UserRow[]> {
  const { data, error } = await supabase.rpc('admin_user_list', {
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_search: search || null,
    p_sort: sort,
  });
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

export default function AdminUsersScreen() {
  const { session } = useSession();
  const { theme } = useTheme();

  if (!session) return <Redirect href="/welcome" />;
  if (session.user.email !== ADMIN_EMAIL) return <Redirect href="/(app)/(tabs)" />;

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent_signup');
  const [offset, setOffset] = useState(0);

  const usersQuery = useQuery({
    queryKey: ['admin-users', search, sort, offset],
    queryFn: () => fetchUsers(offset, search, sort),
    staleTime: 30_000,
  });

  const users = usersQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Usuários · Admin', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 60 }}>
        {/* Busca */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderWidth: 1,
            borderColor: theme.borderLight,
            gap: 8,
          }}
        >
          <Ionicons name="search" size={18} color={theme.textDim} />
          <TextInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setOffset(0);
            }}
            placeholder="Buscar por email ou nome"
            placeholderTextColor={theme.textDim}
            style={{
              flex: 1,
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.text,
              paddingVertical: 10,
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textDim} />
            </Pressable>
          ) : null}
        </View>

        {/* Sort */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <SortChip
            label="Recentes"
            active={sort === 'recent_signup'}
            onPress={() => {
              setSort('recent_signup');
              setOffset(0);
            }}
          />
          <SortChip
            label="Ativos agora"
            active={sort === 'recent_active'}
            onPress={() => {
              setSort('recent_active');
              setOffset(0);
            }}
          />
          <SortChip
            label="Mais tempo"
            active={sort === 'total_time'}
            onPress={() => {
              setSort('total_time');
              setOffset(0);
            }}
          />
        </View>

        {/* Loading */}
        {usersQuery.isLoading ? (
          <ActivityIndicator color={theme.brand} style={{ padding: 30 }} />
        ) : null}

        {/* Error */}
        {usersQuery.isError ? (
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#991B1B' }}>
            {usersQuery.error instanceof Error ? usersQuery.error.message : 'Erro'}
          </Text>
        ) : null}

        {/* Lista */}
        <View style={{ gap: 6 }}>
          {users.map((u) => (
            <Link
              key={u.id}
              href={{ pathname: '/(app)/admin/users/[id]', params: { id: u.id } }}
              asChild
            >
              <Pressable
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.borderLight,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: u.is_pro ? '#FEF3C7' : '#FED7AA',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 15,
                      color: u.is_pro ? '#92400E' : '#9A3412',
                    }}
                  >
                    {(u.display_name ?? u.email).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}
                      numberOfLines={1}
                    >
                      {u.display_name || u.email.split('@')[0]}
                    </Text>
                    {u.is_pro ? (
                      <View
                        style={{
                          backgroundColor: '#FEF3C7',
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 6,
                        }}
                      >
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: '#92400E' }}>
                          ⭐ PRO
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}
                    numberOfLines={1}
                  >
                    {u.email}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Mini icon="paw" value={u.pets_count} />
                    <Mini icon="image" value={u.posts_count} />
                    <Mini icon="time-outline" value={`${u.total_minutes}m`} />
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{ fontFamily: FONTS.body, fontSize: 10, color: theme.textDim }}
                  >
                    {u.last_seen_at
                      ? format(parseISO(u.last_seen_at), "d MMM HH:mm", { locale: ptBR })
                      : '—'}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.textDim}
                    style={{ marginTop: 4 }}
                  />
                </View>
              </Pressable>
            </Link>
          ))}
        </View>

        {/* Paginação */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Pressable
            disabled={offset === 0}
            onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.borderLight,
              alignItems: 'center',
              opacity: offset === 0 ? 0.4 : 1,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
              ← Anterior
            </Text>
          </Pressable>
          <Pressable
            disabled={users.length < PAGE_SIZE}
            onPress={() => setOffset(offset + PAGE_SIZE)}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 10,
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.borderLight,
              alignItems: 'center',
              opacity: users.length < PAGE_SIZE ? 0.4 : 1,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
              Próximo →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function SortChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: active ? '#F97316' : '#FFEDD5',
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 11,
          color: active ? '#FFFFFF' : '#9A3412',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Mini({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number | string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon} size={11} color="#9A3412" />
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#9A3412' }}>{value}</Text>
    </View>
  );
}
