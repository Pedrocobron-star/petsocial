import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Dimensions, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

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
  hasBlockBetween,
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
    // O grid mostra posts do pet do PERFIL (id) — NÃO depende do viewer ter um
    // activePet. Conta sem pet / cold-load também vê os posts (viewer null ->
    // liked_by_me=false). Antes `&& !!activePet` deixava a query desabilitada e
    // o ListEmpty caía em "Sem posts ainda" FALSO.
    queryFn: ({ pageParam }) => fetchPetPostsPage(id, activePet?.id ?? null, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!id,
  });
  // Achata as páginas. O índice de mídia (pra galeria) é calculado sobre esta
  // lista achatada — a galeria usa a lista cheia na mesma ordem, então bate.
  // Memoizado: sem isso `flatMap` recria um array novo a cada render (derrota
  // qualquer memo abaixo). O `mediaOffsets` é um prefix-sum EXCLUSIVO dos
  // media.length (offset[k] = soma de media.length dos posts ANTERIORES a k),
  // derivado do MESMO `posts` — substitui o loop O(n) por tile do renderItem
  // por um lookup O(1), produzindo exatamente o mesmo valor `start` da galeria.
  const { posts, mediaOffsets } = useMemo(() => {
    const flat = postsQuery.data?.pages.flatMap((p) => p.items) ?? [];
    const offsets = new Array<number>(flat.length);
    let acc = 0;
    for (let i = 0; i < flat.length; i++) {
      offsets[i] = acc;
      acc += flat[i].media.length;
    }
    return { posts: flat, mediaOffsets: offsets };
  }, [postsQuery.data]);
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
    onError: (err: unknown) => {
      const e = err as { message?: string; code?: string } | null;
      if (e && (e.code === 'P0001' || /bloqueio/i.test(e.message ?? ''))) {
        toast.info('Não é possível abrir a conversa', 'Há um bloqueio entre vocês.');
        return;
      }
      toast.error('Não foi possível abrir a conversa');
    },
  });

  const [reportOpen, setReportOpen] = useState(false);
  const blockedQuery = useQuery({
    queryKey: pet && myUserId ? qk.isBlocked(myUserId, pet.owner_id) : ['is-blocked', 'none'],
    queryFn: () => isUserBlocked(myUserId!, pet!.owner_id),
    enabled: !!pet && !!myUserId && pet.owner_id !== myUserId,
  });
  // Bloqueio nos DOIS sentidos (eu bloqueei OU ele me bloqueou) — gate do botão
  // "Enviar mensagem". O blockedQuery acima só cobre "eu bloqueei" e serve pro
  // toggle Bloquear/Desbloquear; o gate precisa do bidirecional.
  const blockBetweenQuery = useQuery({
    queryKey: pet && myUserId ? ['block-between', myUserId, pet.owner_id] : ['block-between', 'none'],
    queryFn: () => hasBlockBetween(myUserId!, pet!.owner_id),
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

  // Pull-to-refresh: revalida perfil + stats + grid de posts. Não toca em
  // privacidade nem nos guards — só re-busca o que já está habilitado.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        petQuery.refetch(),
        statsQuery.refetch(),
        postsQuery.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
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

  // Aliases estáveis pras deps do `header` useMemo: `.mutate` mantém identidade
  // entre renders (ao contrário do objeto da mutation), e `.isPending` é o único
  // escalar que realmente afeta o render do header.
  const followMutate = followMutation.mutate;
  const openDmMutate = openDmMutation.mutate;
  const followPending = followMutation.isPending;
  const messagePending = openDmMutation.isPending;

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
          onFollow={() => {
            // Viewer logado SEM pet ativo (conta sem pet / janela transitória
            // pós-login): toggleFollow(activePet!.id) lançaria e o react-query
            // engoliria → botão morto. Guarda + feedback claro.
            if (!activePet) {
              toast.info('Escolha um pet', 'Crie ou selecione um pet pra seguir.');
              return;
            }
            // `.mutate` tem identidade estável (não entra nas deps do memo, ao
            // contrário do objeto followMutation que muda a cada render).
            followMutate();
          }}
          onMessage={() => {
            if (blockBetweenQuery.data) {
              toast.info(
                'Não é possível enviar',
                blockedQuery.data ? 'Desbloqueie pra enviar mensagem.' : 'Há um bloqueio entre vocês.',
              );
              return;
            }
            openDmMutate();
          }}
          followLoading={followPending}
          messageLoading={messagePending}
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
    // Antes: followMutation/openDmMutation (objetos com identidade nova a cada
    // render → memo nunca cacheava). Agora só os escalares .isPending; o .mutate
    // (followMutate/openDmMutate) é estável e não precisa de dep.
    followPending,
    messagePending,
    // activePet + os flags de bloqueio são lidos dentro dos handlers onFollow/
    // onMessage — incluí-los mantém o guard (Onda 2) e o gate de bloqueio
    // sempre com o valor atual (antes ficavam omitidos = potencialmente stale).
    activePet,
    toast,
    blockBetweenQuery.data,
    blockedQuery.data,
    vaccinationsQuery.data,
    parasiteSummaryQuery.data,
    id,
    theme,
  ]);

  // fetchPet usa maybeSingle() -> retorna null SEM throw quando o pet nao
  // existe / foi deletado / RLS bloqueia. Separar "carregando" (skeleton) de
  // "sucesso-com-null" (nao encontrado) pra nao prender no PetProfileSkeleton
  // eterno num deep-link quebrado. Mesmo tratamento de id-card.tsx / edit.tsx.
  if (!petQuery.isLoading && !pet) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ title: 'Pet' }} />
        <EmptyState
          emoji="🐾"
          title="Pet não encontrado"
          description="Esse pet não existe mais ou você não tem acesso a ele."
          action={
            <Pressable
              hitSlop={10}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)'))}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
                Voltar
              </Text>
            </Pressable>
          }
        />
      </View>
    );
  }

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
              <Pressable
                hitSlop={10}
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel="Compartilhar perfil"
              >
                <Ionicons name="share-outline" size={22} color={theme.text} />
              </Pressable>
              {!isOwn ? (
                <Pressable
                  hitSlop={10}
                  onPress={onMore}
                  accessibilityRole="button"
                  accessibilityLabel="Mais ações"
                >
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.brand}
            colors={[theme.brand]}
          />
        }
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
          // O(1): prefix-sum pre-computado em vez do loop O(postIndex) por tile.
          const mediaIndex = mediaOffsets[postIndex];
          const hasMultiple = item.media.length > 1;
          const isVideo = cover?.media_type === 'video';
          const caption = item.caption?.trim() ?? '';
          // expo-image NÃO decodifica mp4 → vídeo virava quadrado preto. Só foto
          // renderiza Image; vídeo vira tile com play; só-texto vira card de legenda.
          const showImage = !!cover && !isVideo;
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
              accessibilityRole="button"
              accessibilityLabel={caption ? `Publicação: ${caption.slice(0, 60)}` : 'Publicação sem legenda'}
              style={{
                width: tileSize,
                height: tileSize,
                margin: 1,
                borderRadius: 6,
                overflow: 'hidden',
                backgroundColor: showImage ? theme.borderLight : isVideo ? '#000' : theme.brandSurface,
                borderWidth: showImage ? 0 : 1,
                borderColor: theme.brandLight,
              }}
            >
              {showImage ? (
                <Image
                  source={{ uri: cover.url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  // Evita flash de imagem reciclada ao rolar o grid (FlatList
                  // reusa views). cachePolicy igual ao padrao de pet-3d-emoji.
                  recyclingKey={item.id}
                  cachePolicy="memory-disk"
                />
              ) : isVideo ? (
                // Vídeo: fundo escuro intencional + play (em vez de quadrado preto vazio).
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="play-circle" size={34} color="rgba(255,255,255,0.92)" />
                </View>
              ) : caption ? (
                // Post só-texto: card de legenda com cor de marca (não some no dark).
                <View style={{ flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, marginBottom: 3 }}>📝</Text>
                  <Text
                    numberOfLines={4}
                    ellipsizeMode="tail"
                    style={{
                      fontFamily: FONTS.bodyMedium,
                      fontSize: 11.5,
                      lineHeight: 15,
                      color: theme.text,
                      textAlign: 'center',
                    }}
                  >
                    {caption}
                  </Text>
                </View>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20 }}>📝</Text>
                </View>
              )}

              {/* Badge de múltiplas mídias (só quando há mídia). */}
              {cover && hasMultiple ? (
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

              {/* Prévia da legenda (1 linha) em posts COM foto/vídeo. */}
              {cover && caption ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    paddingHorizontal: 6,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ color: '#fff', fontFamily: FONTS.bodyMedium, fontSize: 11 }}
                  >
                    {caption}
                  </Text>
                </View>
              ) : null}
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
