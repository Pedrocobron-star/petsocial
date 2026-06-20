import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { memo, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Text, TextInput, View , Alert } from 'react-native';
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
import { MAX_FEED_WIDTH } from '@/lib/layout';
import { isMozartPet } from '@/lib/mozart';
import {
  addComment,
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

import { EditPostModal } from './edit-post-modal';
import { PostEditHistoryModal } from './post-edit-history-modal';
import { FloatPlusOne } from './float-plus-one';
import { HeartBurst } from './heart-burst';
import { ImageViewer } from './image-viewer';
import { MediaCarousel } from './media-carousel';
import { PetAvatar } from './pet-avatar';
import { PostActionsSheet } from './post-actions-sheet';
import { OfficialBadge } from './official-badge';
import { PremiumBadge } from './premium-badge';
import { ReportModal } from './report-modal';
import { RichText } from './rich-text';

const SCREEN_W = Dimensions.get('window').width;

/** Botão de ação do post — ícone simples, estilo Instagram (sem pílula colorida). */
function IconAction({
  name,
  size = 26,
  color,
  onPress,
  accessibilityLabel,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{ paddingHorizontal: 6, paddingVertical: 4 }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

function PostCardComponent({
  post,
  isActive = true,
}: {
  post: PostWithDetails;
  /** Post visível no feed → vídeo dá autoplay (estilo Instagram). Default true. */
  isActive?: boolean;
}) {
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
  const [commentText, setCommentText] = useState('');
  const [commentsCount, setCommentsCount] = useState(post.comments_count);

  // Re-sincroniza estado otimista quando o feed revalida (evita like/contador grudado)
  useEffect(() => {
    setLiked(post.liked_by_me);
    setLikesCount(post.likes_count);
    setCommentsCount(post.comments_count);
  }, [post.liked_by_me, post.likes_count, post.comments_count]);
  const [postingComment, setPostingComment] = useState(false);
  const isPro = useIsPro();
  // Autor do post = dono do pet do post. Pode editar/apagar.
  const isAuthor = !!userId && post.pet.owner_id === userId;
  const wasEdited =
    !!post.updated_at &&
    new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000;
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
    }
    setLiked(next);
    setLikesCount((c) => c + (next ? 1 : -1));
    try {
      await toggleLike(post.id, activePet.id, liked);
    } catch {
      setLiked(liked);
      setLikesCount(post.likes_count);
      toast.error('Não consegui curtir', 'Tenta de novo.');
      return;
    }
    qc.invalidateQueries({ queryKey: ['feed'] });
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || !activePet || postingComment) return;
    setPostingComment(true);
    setCommentText('');
    setCommentsCount((c) => c + 1);
    haptic.light();
    try {
      await addComment(post.id, activePet.id, text);
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: qk.comments(post.id) });
      qc.invalidateQueries({ queryKey: qk.post(post.id) });
    } catch {
      setCommentsCount((c) => Math.max(0, c - 1));
      setCommentText(text);
      toast.error('Não consegui comentar', 'Tenta de novo.');
    } finally {
      setPostingComment(false);
    }
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
      title: `${post.pet.name} no Maestro Pet`,
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

  // Edge-to-edge no mobile (estilo Instagram); cap no MAX_FEED_WIDTH no desktop
  const cardWidth = Math.min(SCREEN_W, MAX_FEED_WIDTH);
  const mediaWidth = cardWidth;
  // Mídia exibida (em repost, a do post original). O botão "expandir" (ImageViewer)
  // só faz sentido pra imagem — vídeo já tem player próprio com seus controles.
  const displayMedia =
    post.reposted_from && post.original_post ? post.original_post.media : post.media;
  const firstImage = displayMedia?.find((m) => m.media_type === 'image');

  const captionTooLong = post.caption && post.caption.length > 140;
  const captionToShow =
    captionExpanded || !captionTooLong ? post.caption : post.caption!.slice(0, 140).trimEnd() + '...';

  return (
    <Animated.View
      entering={FadeInDown.duration(320).easing(Easing.out(Easing.cubic))}
      style={{
        width: cardWidth,
        alignSelf: 'center',
        marginBottom: 6,
        paddingBottom: 8,
        backgroundColor: theme.surface,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderLight,
      }}
    >
      {/* Badge de repost — aparece acima do header quando o post é um repost */}
      {post.reposted_from ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingTop: 8,
          }}
        >
          <Ionicons name="repeat" size={13} color={theme.brand} />
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

      {/* Header estilo Instagram: avatar + nome + tempo, menu à direita */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 9,
        }}
      >
        <Link href={{ pathname: '/pet/[id]', params: { id: post.pet.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 }}>
            <PetAvatar pet={post.pet} size={36} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text, flexShrink: 1 }}
                  numberOfLines={1}
                >
                  {post.pet.name}
                </Text>
                {/* Mozart (anfitrião oficial) ganha o selo verificado dourado;
                    demais tutores Pro mantêm o PremiumBadge. */}
                {isMozartPet(post.pet.id) ? (
                  <OfficialBadge size={14} />
                ) : post.owner_is_pro ? (
                  <PremiumBadge size={14} />
                ) : null}
              </View>
              <Text
                numberOfLines={1}
                style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 1 }}
              >
                {speciesEmoji(post.pet.species)}
                {post.pet.breed ? ' ' + post.pet.breed : ''} · {formatRelativeShort(post.created_at)}
                {wasEdited ? ' · editado' : ''}
              </Text>
            </View>
          </Pressable>
        </Link>
        <Pressable
          hitSlop={10}
          onPress={() => {
            haptic.light();
            setActionsOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Mais ações do post"
          style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
        </Pressable>
      </View>

      {/* Mídia edge-to-edge (estilo Instagram) */}
      <Pressable
        onPress={handleDoubleTap}
        onLongPress={() => {
          haptic.medium();
          setActionsOpen(true);
        }}
        style={{ position: 'relative', backgroundColor: theme.name === 'dark' ? '#000' : '#F5F3F0' }}
      >
        {/* Quando é repost: mostra mídia do post ORIGINAL. Se o original foi
            apagado, mostra um aviso em vez de um card vazio/fantasma. */}
        {post.reposted_from && !post.original_post ? (
          <View
            style={{
              width: mediaWidth,
              paddingVertical: 30,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="trash-outline" size={22} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
              O post original foi removido
            </Text>
          </View>
        ) : (
          <MediaCarousel
            media={post.reposted_from && post.original_post ? post.original_post.media : post.media}
            width={mediaWidth}
            isActive={isActive}
          />
        )}
        <HeartBurst visible={heartBurstVisible} onComplete={() => setHeartBurstVisible(false)} />
        {firstImage ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              haptic.light();
              setImageViewerOpen(true);
            }}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Expandir imagem"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(0,0,0,0.5)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="expand-outline" size={15} color="#fff" />
          </Pressable>
        ) : null}
      </Pressable>

      {/* Ações — ícones simples (curtir / comentar / enviar / salvar) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingTop: 7,
          paddingBottom: 2,
        }}
      >
        <View style={{ position: 'relative' }}>
          <FloatPlusOne visible={plusOneVisible} onDone={() => setPlusOneVisible(false)} />
          <Animated.View style={heartStyle}>
            <IconAction
              name={liked ? 'heart' : 'heart-outline'}
              size={27}
              color={liked ? '#EF4444' : theme.text}
              onPress={handleLike}
              accessibilityLabel="Curtir"
            />
          </Animated.View>
        </View>
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Comentar"
            style={{ paddingHorizontal: 6, paddingVertical: 4 }}
          >
            <Ionicons name="chatbubble-outline" size={24} color={theme.text} />
          </Pressable>
        </Link>
        <IconAction
          name="paper-plane-outline"
          size={23}
          color={theme.text}
          onPress={onShareTap}
          accessibilityLabel="Compartilhar"
        />
        {activePet && activePet.id !== post.pet.id ? (
          <IconAction
            name="repeat-outline"
            size={24}
            color={theme.text}
            onPress={async () => {
              try {
                await repostPost(post.id, activePet.id);
                toast.success('Repostado!', `Apareceu no perfil de ${activePet.name}`);
                await qc.invalidateQueries({ queryKey: qk.petPosts(activePet.id) });
                await qc.invalidateQueries({ queryKey: ['feed', activePet.id] });
              } catch (e) {
                toast.error('Não consegui repostar', e instanceof Error ? e.message : 'Tente novamente.');
              }
            }}
            accessibilityLabel={`Repostar como ${activePet.name}`}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <IconAction
          name={isSaved ? 'bookmark' : 'bookmark-outline'}
          size={23}
          color={isSaved ? theme.brand : theme.text}
          onPress={onSaveTap}
          accessibilityLabel="Salvar"
        />
      </View>

      {/* Curtidas */}
      {likesCount > 0 ? (
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 13,
            color: theme.text,
            paddingHorizontal: 12,
            marginTop: 1,
          }}
        >
          {formatCount(likesCount)} {likesCount === 1 ? 'curtida' : 'curtidas'}
        </Text>
      ) : null}

      {/* Legenda: nome em negrito + texto */}
      {post.caption ? (
        <View style={{ paddingHorizontal: 12, paddingTop: 3 }}>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: theme.text }}>
            <Text style={{ fontFamily: FONTS.bodyBold }}>{post.pet.name} </Text>
            <RichText
              text={captionToShow!}
              baseStyle={{ fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: theme.text }}
            />
            {captionTooLong && !captionExpanded ? (
              <Text
                onPress={() => setCaptionExpanded(true)}
                style={{ fontFamily: FONTS.body, fontSize: 13.5, color: theme.textDim }}
              >
                {' '}mais
              </Text>
            ) : null}
          </Text>
        </View>
      ) : null}

      {/* Citação do post original — só quando é repost */}
      {post.reposted_from && post.original_post?.caption ? (
        <View
          style={{
            marginHorizontal: 12,
            marginTop: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderLeftWidth: 2,
            borderLeftColor: theme.brand,
            backgroundColor: theme.brandSurface,
            borderRadius: 6,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brandDark, marginBottom: 2 }}>
            {post.original_post.pet.name}
          </Text>
          <Text
            style={{ fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: theme.text }}
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
            gap: 5,
            paddingHorizontal: 12,
            paddingTop: 6,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>com</Text>
          {post.pet_tags.map((tagPet) => (
            <Link key={tagPet.id} href={{ pathname: '/pet/[id]', params: { id: tagPet.id } }} asChild>
              <Pressable>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brand }}>
                  @{tagPet.name}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : null}

      {/* Ver comentários */}
      {commentsCount > 0 ? (
        <Link href={{ pathname: '/post/[id]', params: { id: post.id } }} asChild>
          <Pressable style={{ paddingHorizontal: 12, paddingTop: 4 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: theme.textDim }}>
              {commentsCount === 1
                ? 'Ver 1 comentário'
                : `Ver todos os ${commentsCount} comentários`}
            </Text>
          </Pressable>
        </Link>
      ) : null}

      {/* Comentar inline (estilo Instagram) — sem sair do feed */}
      {activePet ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 12,
            paddingTop: 8,
          }}
        >
          <PetAvatar pet={activePet} size={26} />
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Adicionar comentário…"
            placeholderTextColor={theme.textDim}
            editable={!postingComment}
            returnKeyType="send"
            onSubmitEditing={submitComment}
            style={{
              flex: 1,
              fontFamily: FONTS.body,
              fontSize: 13,
              color: theme.text,
              paddingVertical: 2,
            }}
          />
          {commentText.trim() ? (
            <Pressable onPress={submitComment} hitSlop={8} disabled={postingComment}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
                Publicar
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
                      await qc.invalidateQueries({ queryKey: ['feed', activePet.id] });
                    } catch (e) {
                      toast.error(
                        'Não consegui repostar',
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
                                await qc.invalidateQueries({ queryKey: ['feed', activePet.id] });
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
            await qc.invalidateQueries({ queryKey: ['feed', activePet.id] });
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
      {firstImage ? (
        <ImageViewer
          visible={imageViewerOpen}
          onClose={() => setImageViewerOpen(false)}
          url={firstImage.url}
        />
      ) : null}
    </Animated.View>
  );
}

/**
 * Memoizado: evita re-render quando o feed revalida e a prop `post` (e `isActive`)
 * não mudam. Shallow compare padrão — suficiente porque o feed reusa a mesma
 * referência de objeto `post` entre renders quando nada mudou.
 */
export const PostCard = memo(PostCardComponent);
