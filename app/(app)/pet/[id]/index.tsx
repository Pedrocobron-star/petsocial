import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, Text, View } from 'react-native';

import { BirthdayBanner } from '@/components/birthday-banner';
import { EmptyState } from '@/components/empty-state';
import { MetaTags } from '@/components/meta-tags';
import { MozartFounderCard } from '@/components/mozart-founder-card';
import { PetProfileHero } from '@/components/pet-profile-hero';
import { PetProfileSkeleton } from '@/components/pet-profile-skeleton';
import { PetQuickActions } from '@/components/pet-quick-actions';
import { ReportModal } from '@/components/report-modal';
import { CenteredColumn } from '@/components/ui/centered-column';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { MAX_FEED_WIDTH, FEED_CARD_MARGIN } from '@/lib/layout';
import { isMozartPet } from '@/lib/mozart';
import { birthdayYears, isBirthdayToday } from '@/lib/pet-age';
import {
  blockUser,
  fetchIsFollowing,
  fetchParasiteSummary,
  fetchPet,
  fetchPetPostsPage,
  fetchPetStats,
  fetchUserIsPro,
  fetchVaccinations,
  getOrCreateDM,
  isUserBlocked,
  qk,
  toggleFollow,
  unblockUser,
} from '@/lib/queries';
import { petUrl, sharePost } from '@/lib/share';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

export default function PetProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { activePet } = useActivePet();
  const toast = useToast();
  const { session } = useSession();
  const { theme } = useTheme();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const pet = petQuery.data;
  const myUserId = session?.user.id;
  // Dono = a CONTA é dona do pet (não "é o pet ativo"). Antes usava
  // activePet?.id === id, então ver um pet PRÓPRIO não-ativo mostrava
  // "+ Seguir/Mensagem" em vez de "Editar" (bug pra quem tem vários pets).
  const isOwn = !!pet && pet.owner_id === myUserId;

  const statsQuery = useQuery({
    queryKey: qk.petStats(id),
    queryFn: () => fetchPetStats(id),
    enabled: !!id,
  });
  const postsQuery = useInfiniteQuery({
    // queryKey null-safe: o `activePet` pode estar null por um instante (logo
    // após login, antes dos pets carregarem) ou pra conta sem pet.
    queryKey: qk.petPostsPaged(id, activePet?.id ?? 'anon'),
    queryFn: ({ pageParam }) => fetchPetPostsPage(id, activePet!.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!id && !!activePet,
  });
  // Achata as páginas. O índice de mídia (pra galeria) é calculado sobre esta
  // lista achatada — a galeria usa a lista cheia na mesma ordem, então bate.
  const posts = postsQuery.data?.pages.flatMap((p) => p.items) ?? [];
  // Dados médicos: só busca se for o DONO. Visitante (perfil público) nem
  // chega a baixar a carteira de vacinas/antiparasitário do pet alheio.
  const vaccinationsQuery = useQuery({
    queryKey: qk.vaccinations(id),
    queryFn: () => fetchVaccinations(id),
    enabled: !!id && isOwn,
  });
  const parasiteSummaryQuery = useQuery({
    queryKey: qk.parasiteSummary(id),
    queryFn: () => fetchParasiteSummary(id),
    enabled: !!id && isOwn,
  });
  // Dono é Pet Pro? → selo dourado no perfil (pra quem vê saber que é assinante).
  const ownerIsProQuery = useQuery({
    queryKey: ['user-is-pro', pet?.owner_id],
    queryFn: () => fetchUserIsPro(pet!.owner_id),
    enabled: !!pet?.owner_id,
  });
  const followingQuery = useQuery({
    queryKey: ['following', activePet?.id, id],
    queryFn: () => fetchIsFollowing(activePet!.id, id),
    enabled: !!id && !!activePet && activePet.id !== id,
  });

  const followMutation = useMutation({
    mutationFn: () => toggleFollow(activePet!.id, id, !!followingQuery.data),
    onMutate: () => haptic.medium(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['following', activePet?.id, id] });
      qc.invalidateQueries({ queryKey: qk.petStats(id) });
      qc.invalidateQueries({ queryKey: qk.petStats(activePet!.id) });
      qc.invalidateQueries({ queryKey: qk.followers(id) });
      qc.invalidateQueries({ queryKey: qk.following(activePet!.id) });
      if (!followingQuery.data && pet) {
        toast.success(`Seguindo ${pet.name}!`, 'Você vai ver os posts no feed');
      }
    },
  });

  const openDmMutation = useMutation({
    mutationFn: () => {
      if (!pet) throw new Error('pet sem dados');
      return getOrCreateDM(pet.owner_id);
    },
    onSuccess: (convId) => {
      router.push({ pathname: '/chat/[id]' as never, params: { id: convId } as never });
    },
    onError: () => {
      toast.error('Não foi possível abrir a conversa');
    },
  });

  const [reportOpen, setReportOpen] = useState(false);
  const blockedQuery = useQuery({
    queryKey: pet && myUserId ? qk.isBlocked(myUserId, pet.owner_id) : ['is-blocked', 'none'],
    queryFn: () => isUserBlocked(myUserId!, pet!.owner_id),
    enabled: !!pet && !!myUserId && pet.owner_id !== myUserId,
  });
  const blockMutation = useMutation({
    mutationFn: () => {
      if (!myUserId || !pet) throw new Error('sem dados');
      return blockedQuery.data
        ? unblockUser(myUserId, pet.owner_id)
        : blockUser(myUserId, pet.owner_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.isBlocked(myUserId!, pet!.owner_id) });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['explore'] });
      toast.success(
        blockedQuery.data ? 'Usuário desbloqueado' : 'Usuário bloqueado',
        blockedQuery.data ? '' : 'Você não vê mais posts dele',
      );
    },
  });

  const onMore = () => {
    if (!pet) return;
    const isBlocked = blockedQuery.data;
    Alert.alert('Mais ações', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reportar', onPress: () => setReportOpen(true) },
      {
        text: isBlocked ? 'Desbloquear tutor' : 'Bloquear tutor',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            isBlocked ? 'Desbloquear?' : 'Bloquear este tutor?',
            isBlocked
              ? 'Você voltará a ver posts dele no feed.'
              : 'Você não verá mais posts ou perfis dele.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: isBlocked ? 'Desbloquear' : 'Bloquear',
                style: 'destructive',
                onPress: () => blockMutation.mutate(),
              },
            ],
          ),
      },
    ]);
  };

  const onShare = async () => {
    if (!pet) return;
    const result = await sharePost({
      title: `${pet.name} no Maestro Pet`,
      message: pet.bio ? `${pet.name}: ${pet.bio}` : `Conheça ${pet.name} no Maestro Pet`,
      url: petUrl(pet.id),
    });
    if (result === 'copied') Alert.alert('Link copiado', 'Pode colar onde quiser.');
  };

  // Grid de posts — 3 colunas dentro do MAX_FEED_WIDTH
  const SCREEN_W = Dimensions.get('window').width;
  const gridWidth = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);
  // 3 tiles, margin: 1 cada (= 2px horizontal por tile → 6px total)
  const tileSize = (gridWidth - 6) / 3;

  const stats = useMemo(
    () => ({
      posts_count: statsQuery.data?.posts_count ?? 0,
      followers_count: statsQuery.data?.followers_count ?? 0,
      following_count: statsQuery.data?.following_count ?? 0,
    }),
    [statsQuery.data],
  );

  const header = useMemo(() => {
    if (!pet) return null;
    return (
      <View>
        {/* Hero — banner + avatar + nome + stats + ações */}
        <PetProfileHero
          pet={pet}
          stats={stats}
          isOwn={isOwn}
          ownerIsPro={!!ownerIsProQuery.data}
          isFollowing={!!followingQuery.data}
          onFollow={() => followMutation.mutate()}
          onMessage={() => {
            if (blockedQuery.data) {
              toast.info('Tutor bloqueado', 'Desbloqueie pra enviar mensagem.');
              return;
            }
            openDmMutation.mutate();
          }}
          followLoading={followMutation.isPending}
          messageLoading={openDmMutation.isPending}
        />

        {/* Banners contextuais (aniversário / memorial) */}
        {isBirthdayToday(pet.birthdate) && !pet.memorial_at ? (
          <CenteredColumn maxWidth={540}>
            <BirthdayBanner
              petName={pet.name}
              years={birthdayYears(pet.birthdate)}
              petId={pet.id}
            />
          </CenteredColumn>
        ) : null}

        {pet.memorial_at ? (
          <CenteredColumn maxWidth={540}>
            <Link
              href={{ pathname: '/pet/[id]/memorial' as never, params: { id: pet.id } as never }}
              asChild
            >
              <Pressable
                style={{
                  marginTop: 12,
                  backgroundColor: theme.borderLight,
                  borderRadius: 16,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text style={{ fontSize: 32 }}>🌈</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                    Em memória de {pet.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: theme.textDim,
                      marginTop: 2,
                    }}
                  >
                    Toque pra deixar uma mensagem 🕯️
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textDim} />
              </Pressable>
            </Link>
          </CenteredColumn>
        ) : null}

        {/* Mozart é o anfitrião/dono da plataforma: cartão de apresentação dele. */}
        {isMozartPet(pet.id) ? <MozartFounderCard /> : null}

        {/* Quick Actions (Saúde, Vacinas, Diário, Carteirinha, IA…) — SÓ pro dono.
            No perfil público (visitante) o perfil é estilo Instagram: só os posts.
            Nada de vacinas / saúde / diário / carteirinha de pet alheio. */}
        {isOwn ? (
          <PetQuickActions
            petId={id}
            isOwn={isOwn}
            vaccinations={vaccinationsQuery.data ?? []}
            parasiteSummary={parasiteSummaryQuery.data}
          />
        ) : null}

        {/* Separador antes do grid */}
        <CenteredColumn maxWidth={540}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: 20,
              marginBottom: 6,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text style={{ fontSize: 14 }}>🐾</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                color: theme.textDim,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              Publicações
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>
        </CenteredColumn>
      </View>
    );
  }, [
    pet,
    stats,
    isOwn,
    ownerIsProQuery.data,
    followingQuery.data,
    followMutation,
    openDmMutation,
    vaccinationsQuery.data,
    parasiteSummaryQuery.data,
    id,
    theme,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {pet ? (
        <MetaTags
          title={`${pet.name} (${pet.breed ?? pet.species}) · Maestro Pet`}
          description={
            pet.bio
              ? pet.bio.slice(0, 160)
              : `${pet.name} tem carteirinha digital, histórico de saúde e perfil no Maestro Pet.`
          }
          image={pet.avatar_url}
          type="profile"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: pet.name,
            description: pet.bio ?? undefined,
            image: pet.avatar_url ?? undefined,
          }}
        />
      ) : null}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 12, paddingRight: 8 }}>
              <Pressable hitSlop={10} onPress={onShare}>
                <Ionicons name="share-outline" size={22} color={theme.text} />
              </Pressable>
              {!isOwn ? (
                <Pressable hitSlop={10} onPress={onMore}>
                  <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />
      {pet ? (
        <ReportModal
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetKind="pet"
          targetId={pet.id}
        />
      ) : null}

      {/* Skeleton enquanto pet carrega (evita layout-shift) */}
      {!pet ? (
        <PetProfileSkeleton />
      ) : (
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
        columnWrapperStyle={{
          width: gridWidth,
          alignSelf: 'center',
        }}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (postsQuery.hasNextPage && !postsQuery.isFetchingNextPage) postsQuery.fetchNextPage();
        }}
        ListHeaderComponent={header}
        renderItem={({ item, index: postIndex }) => {
          const cover = item.media[0];
          let mediaIndex = 0;
          for (let i = 0; i < postIndex; i++) mediaIndex += posts[i].media.length;
          const hasMultiple = item.media.length > 1;
          return (
            <Pressable
              onPress={() =>
                cover
                  ? // Post com mídia → abre a galeria no índice certo.
                    router.push({
                      pathname: '/pet/[id]/gallery' as never,
                      params: { id, start: String(mediaIndex) } as never,
                    })
                  : // Post só-texto não tem foto: abre o post (antes abria a
                    // foto de OUTRO post pelo índice de mídia somado).
                    router.push({ pathname: '/post/[id]' as never, params: { id: item.id } as never })
              }
              style={{
                width: tileSize,
                height: tileSize,
                margin: 1,
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: theme.borderLight,
              }}
            >
              {cover ? (
                <>
                  <Image
                    source={{ uri: cover.url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                  {hasMultiple ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderRadius: 6,
                        paddingHorizontal: 5,
                        paddingVertical: 2,
                      }}
                    >
                      <Ionicons name="copy-outline" size={12} color="#fff" />
                    </View>
                  ) : null}
                </>
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>📝</Text>
                </View>
              )}
            </Pressable>
          );
        }}
        ListFooterComponent={
          postsQuery.isFetchingNextPage ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                Carregando mais…
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          postsQuery.isLoading ? null : (
            <EmptyState
              emoji="📷"
              title={isOwn ? 'Compartilhe o primeiro momento' : 'Sem posts ainda'}
              description={
                isOwn
                  ? `Mostra pro mundo a rotina de ${pet?.name ?? 'seu pet'}. Toque no + pra criar.`
                  : `${pet?.name ?? 'Esse pet'} ainda não postou nada.`
              }
            />
          )
        }
      />
      )}
    </View>
  );
}
