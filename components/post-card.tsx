import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, View , Alert } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';


import { FONTS } from '@/lib/fonts';
import { formatCount, formatRelativeShort } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import {
  deletePost,
  fetchSavedPostIds,
  qk,
  repostPost,
  toggleLike,
  toggleSavePost,
  updatePostCaption,
} from '@/lib/queries';
import { postUrl, sharePost } from '@/lib/share';
import { speciesEmoji } from '@/lib/constants';
import type { PostWithDetails } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

import { animationForPersonality, type AvatarAnimation } from './avatar/animated-pet-avatar';
import { EditPostModal } from './edit-post-modal';
import { PostEditHistoryModal } from './post-edit-history-modal';
import { FloatPlusOne } from './float-plus-one';
import { HeartBurst } from './heart-burst';
import { ImageViewer } from './image-viewer';
import { MediaCarousel } from './media-carousel';
import { PetAvatar } from './pet-avatar';
import { PostActionsSheet } from './post-actions-sheet';
import { PremiumBadge } from './premium-badge';
import { ReactionPill } from './reaction-pill';
import { ReportModal } from './report-modal';
import { RichText } from './rich-text';

const SCREEN_W = Dimensions.get('window').width;
const CARD_RADIUS = 22;
const MEDIA_INNER_PADDING = 6; // Espaço entre borda do card e a foto

export function PostCard({ post }: { post: PostWithDetails }) {
  const { activePet } = useActivePet();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [heartBurstVisible, setHeartBurstVisible] = useState(false);
  const [plusOneVisible, setPlusOneVisible] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isPro = useIsPro();
  // Autor do post = dono do pet do post. Pode editar/apagar.
  const isAuthor = !!userId && post.pet.owner_id === userId;
  const wasEdited =
    !!post.updated_at &&
    new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000;
  // Anima o avatar do pet do post quando uma ação é disparada (like, comment).
  // `null` = volta pro estado base (breathe). One-shot dura ~700ms.
  const [petOneShot, setPetOneShot] = useState<AvatarAnimation>(null);
  const [petAnimTrigger, setPetAnimTrigger] = useState(0);
  const petOneShotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPetOneShot = (anim: AvatarAnimation, duration = 700) => {
    if (petOneShotTimeout.current) clearTimeout(petOneShotTimeout.current);
    setPetOneShot(anim);
    setPetAnimTrigger((k) => k + 1);
    petOneShotTimeout.current = setTimeout(() => {
      setPetOneShot(null);
      petOneShotTimeout.current = null;
    }, duration);
  };

  useEffect(() => {
    return () => {
      if (petOneShotTimeout.current) clearTimeout(petOneShotTimeout.current);
    };
  }, []);

  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));
  const lastTapRef = useRef(0);

  const savedIdsQuery = useQuery({
    queryKey: userId ? qk.savedPostIds(userId) : ['saved-post-ids', 'anon'],
    queryFn: () => fetchSavedPostIds(userId!),
    enabled: !!userId,
  });
  const isSaved = savedIdsQuery.data?.has(post.id) ?? false;

  const saveMutation = useMutation({
    mutationFn: () => toggleSavePost(userId!, post.id, isSaved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.savedPostIds(userId!) });
      qc.invalidateQueries({ queryKey: qk.savedPostsFeed(userId!) });
    },
  });

  const animateHeart = () => {
    heartScale.value = withSequence(
      withTiming(1.4, { duration: 120, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }),
    );
  };

  const handleLike = async () => {
    if (!activePet) return;
    const next = !liked;
    if (next) {
      haptic.light();
      animateHeart();
      setPlusOneVisible(true);
      triggerPetOneShot('heart_burst', 700);
    }
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await toggleLike(post.id, activePet.id, liked);
    } catch {
      setLiked(liked);
      setLikesCount(post.likes_count);
      return;
    }
    qc.invalidateQueries({ queryKey: ['feed'] });
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike();
      setHeartBurstVisible(true);
      haptic.medium();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const onShareTap = async () => {
    await sharePost({
      title: `${post.pet.name} no Pet Social`,
      message: post.caption ? `${post.pet.name}: ${post.caption}` : `Veja o post de ${post.pet.name}`,
      url: postUrl(post.id),
    });
  };

  const onSaveTap = () => {
    if (!userId) return;
    haptic.light();
    const becomingSaved = !isSaved;
    saveMutation.mutate();
    if (becomingSaved) toast.success('Salvo!', 'Em "Posts salvos" no seu perfil');
  };

  const cardWidth = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);
  const mediaWidth = cardWidth - MEDIA_INNER_PADDING * 2;

  const captionTooLong = post.caption && post.caption.length > 140;
  const captionToShow =
    captionExpanded || !captionTooLong ? post.caption : post.caption!.slice(0, 140).trimEnd() + '...';

  return (
    <Animated.View
      entering={FadeInDown.duration(360).easing(Easing.out(Easing.cubic))}
      style={{
        width: cardWidth,
        alignSelf: 'center',
        marginBottom: 16,
        backgroundColor: theme.surface,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        shadowColor: '#7C2D12',
        shadowOpacity: 0.04,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      {/* Paw print decorativo no canto superior direito (marca d'água do Pet Social) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 18,
          right: 56,
          opacity: 0.04,
          zIndex: 0,
        }}
      >
        <Text style={{ fontSize: 80 }}>🐾</Text>
      </View>

      {/* Badge de repost — aparece acima do header quando o post é um repost */}
      {post.reposted_from ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 0,
          }}
        >
          <Ionicons name="repeat" size={14} color={theme.brand} />
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brand }}>
            {post.pet.name} repostou
          </Text>
          {post.original_post ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
              de {post.original_post.pet.name}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        <Link href={{ pathname: '/pet/[id]', params: { id: post.pet.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
            <PetAvatar
              pet={post.pet}
              size={44}
              animation={petOneShot ?? animationForPersonality(post.pet.personality_type)}
              triggerKey={petAnimTrigger}
              showMascot
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 16,
                    color: theme.text,
                    letterSpacing: -0.3,
                    lineHeight: 20,
                    flexShrink: 1,
                  }}
                  numberOfLines={1}
                >
                  {post.pet.name}
                </Text>
                {/* Selo dourado de Pet Pro — dono é assinante */}
                {post.owner_is_pro ? <PremiumBadge size={13} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 3,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: theme.brandLight,
                  }}
                >
                  <Text style={{ fontSize: 10 }}>{speciesEmoji(post.pet.species)}</Text>
                  {post.pet.breed ? (
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 10,
                        color: theme.brandDark,
                      }}
                      numberOfLines={1}
                    >
                      {post.pet.breed}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                  · {formatRelativeShort(post.created_at)}
                  {post.updated_at && new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000
                    ? ' · editado'
                    : ''}
                </Text>
              </View>
            </View>
          </Pressable>
        </Link>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptic.light();
            setActionsOpen(true);
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.textDim} />
        </Pressable>
      </View>

      {/* Mídia centralizada com radius interno */}
      <View style={{ paddingHorizontal: MEDIA_INNER_PADDING, paddingBottom: MEDIA_INNER_PADDING }}>
        <Pressable
          onPress={handleDoubleTap}
          onLongPress={() => {
            haptic.medium();
            setActionsOpen(true);
          }}
          style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#F5F3F0',
          }}
        >
          {/* Quando é repost: mostra mídia do post ORIGINAL.
              Quando é post normal: mídia própria. */}
          <MediaCarousel
            media={post.reposted_from && post.original_post ? post.original_post.media : post.media}
            width={mediaWidth}
          />
          <HeartBurst visible={heartBurstVisible} onComplete={() => setHeartBurstVisible(false)} />

          {/* Botão expand fullscreen no canto */}
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              haptic.light();
              setImageViewerOpen(true);
            }}
            hitSlop={6}
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="expand-outline" size={16} color="#fff" />
          </Pressable>
        </Pressable>
      </View>

      {/* Caption do reposter (se for repost) ou caption normal */}
      {post.caption ? (
        <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 12 }}>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 14,
              lineHeight: 20,
              color: theme.text,
            }}
          >
            <RichText
              text={captionToShow!}
              baseStyle={{
                fontFamily: FONTS.body,
                fontSize: 14,
                lineHeight: 20,
                color: theme.text,
              }}
            />
            {captionTooLong && !captionExpanded ? (
              <Text
                onPress={() => setCaptionExpanded(true)}
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 13,
                  color: theme.brand,
                }}
              >
                {' '}ver mais
              </Text>
            ) : null}
          </Text>
        </View>
      ) : null}

      {/* Caption ORIGINAL do post — só quando é repost. Aparece como citação. */}
      {post.reposted_from && post.original_post?.caption ? (
        <View
          style={{
            marginHorizontal: 14,
            marginBottom: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderLeftWidth: 3,
            borderLeftColor: theme.brand,
            backgroundColor: theme.brandSurface,
            borderRadius: 8,
          }}
        >
          <Text
            style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brandDark, marginBottom: 4 }}
          >
            {post.original_post.pet.name} escreveu:
          </Text>
          <Text
            style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: theme.text }}
            numberOfLines={3}
          >
            {post.original_post.caption}
          </Text>
        </View>
      ) : null}

      {/* Pet tags — pets marcados no post */}
      {post.pet_tags && post.pet_tags.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            paddingHorizontal: 18,
            paddingBottom: 12,
            alignItems: 'center',
          }}
        >
          <Ionicons name="pricetag" size={12} color={theme.textDim} />
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
            com
          </Text>
          {post.pet_tags.map((tagPet, i) => (
            <Link
              key={tagPet.id}
              href={{ pathname: '/pet/[id]', params: { id: tagPet.id } }}
              asChild
            >
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: theme.brandLight,
                }}
              >
                <Text style={{ fontSize: 10 }}>{speciesEmoji(tagPet.species)}</Text>
                <Text
                  style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: theme.brandDark }}
                >
                  {tagPet.name}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}

      {/* Separator decorativo: paw centralizada */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          gap: 8,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: theme.borderLight }} />
        <Text style={{ fontSize: 10, opacity: 0.5 }}>🐾</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.borderLight }} />
      </View>

      {/* Reactions row — pills coloridas */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingTop: 11,
          paddingBottom: 14,
          gap: 7,
        }}
      >
        <View style={{ position: 'relative' }}>
          <FloatPlusOne
            visible={plusOneVisible}
            onDone={() => setPlusOneVisible(false)}
          />
          <ReactionPill
            icon={liked ? 'heart' : 'heart-outline'}
            count={likesCount}
            active={liked}
            activeBg="#EF4444"
            inactiveBg="#FEE2E2"
            inactiveColor="#991B1B"
            onPress={handleLike}
          />
        </View>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <View>
            <ReactionPill
              icon="chatbubble-outline"
              count={post.comments_count}
              inactiveBg="#DBEAFE"
              inactiveColor="#1E40AF"
            />
          </View>
        </Link>
        <ReactionPill
          icon="paper-plane-outline"
          inactiveBg="#DCFCE7"
          inactiveColor="#166534"
          onPress={onShareTap}
        />
        <View style={{ flex: 1 }} />
        <ReactionPill
          icon={isSaved ? 'bookmark' : 'bookmark-outline'}
          active={isSaved}
          activeBg="#F97316"
          inactiveBg="#FED7AA"
          inactiveColor="#9A3412"
          onPress={onSaveTap}
        />
      </View>

      {/* Modals */}
      <PostActionsSheet
        visible={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={[
          {
            icon: liked ? 'heart' : 'heart-outline',
            label: liked ? 'Descurtir' : 'Curtir',
            onPress: handleLike,
          },
          {
            icon: isSaved ? 'bookmark' : 'bookmark-outline',
            label: isSaved ? 'Remover dos salvos' : 'Salvar post',
            onPress: onSaveTap,
          },
          {
            icon: 'paper-plane-outline',
            label: 'Compartilhar',
            onPress: onShareTap,
          },
          // Histórico de edições — aparece pra TODOS quando o post foi editado.
          // Free vê upsell, Pro vê histórico completo.
          ...(wasEdited
            ? ([
                {
                  icon: 'time-outline' as const,
                  label: 'Ver histórico de edições',
                  onPress: () => setHistoryOpen(true),
                },
              ] as const)
            : []),
          // Repost: só faz sentido se tem pet ativo E o post NÃO é do próprio pet ativo
          ...(activePet && activePet.id !== post.pet.id
            ? ([
                {
                  icon: 'repeat-outline' as const,
                  label: `Repostar como ${activePet.name}`,
                  onPress: async () => {
                    try {
                      await repostPost(post.id, activePet.id);
                      toast.success('Repostado!', `Apareceu no perfil de ${activePet.name}`);
                      await qc.invalidateQueries({ queryKey: qk.petPosts(activePet.id) });
                      await qc.invalidateQueries({ queryKey: qk.feed(activePet.id) });
                    } catch (e) {
                      toast.error(
                        'Erro ao repostar',
                        e instanceof Error ? e.message : 'Tente novamente.',
                      );
                    }
                  },
                },
              ] as const)
            : []),
          // Autor pode editar caption e apagar o post
          ...(isAuthor
            ? ([
                {
                  icon: 'pencil-outline',
                  label: 'Editar legenda',
                  onPress: () => setEditOpen(true),
                },
                {
                  icon: 'trash-outline',
                  label: 'Apagar post',
                  destructive: true,
                  onPress: () => {
                    Alert.alert(
                      'Apagar post?',
                      'Essa ação não pode ser desfeita. Curtidas e comentários também somem.',
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: 'Apagar',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await deletePost(post.id);
                              toast.success('Post apagado');
                              if (activePet?.id) {
                                await qc.invalidateQueries({ queryKey: qk.feed(activePet.id) });
                                await qc.invalidateQueries({ queryKey: qk.petPosts(post.pet.id) });
                              }
                            } catch (e) {
                              toast.error(
                                'Erro ao apagar',
                                e instanceof Error ? e.message : 'Tente novamente.',
                              );
                            }
                          },
                        },
                      ],
                    );
                  },
                },
              ] as const)
            : []),
          // Reportar só aparece pra quem NÃO é autor
          ...(isAuthor
            ? []
            : ([
                {
                  icon: 'flag-outline',
                  label: 'Reportar',
                  destructive: true,
                  onPress: () => setReportOpen(true),
                },
              ] as const)),
        ]}
      />
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetKind="post"
        targetId={post.id}
      />
      <EditPostModal
        visible={editOpen}
        initialCaption={post.caption}
        onClose={() => setEditOpen(false)}
        onSave={async (newCaption) => {
          await updatePostCaption(post.id, newCaption);
          toast.success('Post editado');
          if (activePet?.id) {
            await qc.invalidateQueries({ queryKey: qk.feed(activePet.id) });
            await qc.invalidateQueries({ queryKey: qk.petPosts(post.pet.id) });
          }
        }}
      />
      <PostEditHistoryModal
        visible={historyOpen}
        postId={post.id}
        isPro={isPro}
        currentCaption={post.caption}
        onClose={() => setHistoryOpen(false)}
      />
      {post.media[0] ? (
        <ImageViewer
          visible={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
          url={post.media[0].url}
        />
      ) : null}
    </Animated.View>
  );
}
