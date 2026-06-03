import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MediaCarousel } from '@/components/media-carousel';
import { MetaTags } from '@/components/meta-tags';
import type { AvatarAnimation } from '@/components/avatar/animated-pet-avatar';
import { PetAvatar } from '@/components/pet-avatar';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/text-area';
import { FONTS } from '@/lib/fonts';
import {
  addComment,
  deleteComment,
  deletePost,
  fetchComments,
  fetchPost,
  qk,
  toggleCommentLike,
  toggleLike,
  updateComment,
  updatePostCaption,
} from '@/lib/queries';
import { postUrl, sharePost } from '@/lib/share';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';

const SCREEN_W = Dimensions.get('window').width;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePet } = useActivePet();
  const { session } = useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [editCaptionOpen, setEditCaptionOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');
  // Quando user clica "Responder" num comentário, registra o pai pra próximo addComment
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyingToName, setReplyingToName] = useState<string | null>(null);
  // Anima o avatar do pet do post quando ação ocorre.
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

  const postQuery = useQuery({
    queryKey: qk.post(id),
    queryFn: () => fetchPost(id, activePet!.id),
    enabled: !!id && !!activePet,
  });
  const commentsQuery = useQuery({
    queryKey: qk.comments(id),
    queryFn: () => fetchComments(id, activePet?.id ?? null),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(id, activePet!.id, !!postQuery.data?.liked_by_me),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.post(id) });
      // Anima só quando o resultado é "curtir" (não descurtir)
      if (!postQuery.data?.liked_by_me) triggerPetOneShot('heart_burst', 700);
    },
  });
  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      addComment(id, activePet!.id, content, replyingToId),
    onSuccess: () => {
      setDraft('');
      setReplyingToId(null);
      setReplyingToName(null);
      qc.invalidateQueries({ queryKey: qk.comments(id) });
      qc.invalidateQueries({ queryKey: qk.post(id) });
      triggerPetOneShot('bob', 1000);
    },
  });
  // Curtir / descurtir comentário (toggle)
  const likeCommentMutation = useMutation({
    mutationFn: (commentId: string) => {
      if (!activePet) throw new Error('Sem pet ativo');
      const current = commentsQuery.data?.find((c) => c.id === commentId);
      return toggleCommentLike(commentId, activePet.id, !!current?.liked_by_me);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.comments(id) });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deletePost(id),
    onSuccess: () => {
      if (activePet) qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: qk.petPosts(postQuery.data?.pet_id ?? '') });
      router.back();
    },
    onError: (e) => Alert.alert('Erro ao excluir', e instanceof Error ? e.message : 'Tente novamente.'),
  });
  const updateCaptionMutation = useMutation({
    mutationFn: (caption: string | null) => updatePostCaption(id, caption),
    onSuccess: () => {
      setEditCaptionOpen(false);
      qc.invalidateQueries({ queryKey: qk.post(id) });
      if (activePet) qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });
  const editCommentMutation = useMutation({
    mutationFn: ({ cid, content }: { cid: string; content: string }) => updateComment(cid, content),
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingCommentText('');
      qc.invalidateQueries({ queryKey: qk.comments(id) });
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });
  const deleteCommentMutation = useMutation({
    mutationFn: (cid: string) => deleteComment(cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.comments(id) });
      qc.invalidateQueries({ queryKey: qk.post(id) });
    },
    onError: (e) => Alert.alert('Erro', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const post = postQuery.data;
  if (!post) return null;

  const isOwner = post.pet.owner_id === session?.user.id;

  const onShare = async () => {
    const result = await sharePost({
      title: `${post.pet.name} no Pet Social`,
      message: post.caption ? `${post.pet.name}: ${post.caption}` : `Veja o post de ${post.pet.name}`,
      url: postUrl(id),
    });
    if (result === 'copied') Alert.alert('Link copiado', 'Pode colar onde quiser.');
  };

  const onOwnerMenu = () => {
    Alert.alert('Opções do post', undefined, [
      {
        text: 'Editar legenda',
        onPress: () => {
          setCaptionDraft(post.caption ?? '');
          setEditCaptionOpen(true);
        },
      },
      {
        text: 'Excluir post',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir post?', 'Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Excluir', style: 'destructive', onPress: () => deleteMutation.mutate() },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const onCommentMenu = (commentId: string, content: string) => {
    Alert.alert('Opções do comentário', undefined, [
      {
        text: 'Editar',
        onPress: () => {
          setEditingCommentId(commentId);
          setEditingCommentText(content);
        },
      },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Excluir comentário?', 'Essa ação não pode ser desfeita.', [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Excluir',
              style: 'destructive',
              onPress: () => deleteCommentMutation.mutate(commentId),
            },
          ]),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const w = Math.min(SCREEN_W, 600);
  const myUserId = session?.user.id;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      {post ? (
        <MetaTags
          title={`${post.pet.name} no Pet Social`}
          description={
            post.caption
              ? post.caption.slice(0, 160)
              : `Post de ${post.pet.name} no Pet Social`
          }
          image={post.media[0]?.url ?? post.pet.avatar_url}
          type="article"
          jsonLd={{
            '@context': 'https://schema.org',
            '@type': 'SocialMediaPosting',
            headline: post.caption?.slice(0, 110) ?? `Post de ${post.pet.name}`,
            datePublished: post.created_at,
            image: post.media[0]?.url ?? post.pet.avatar_url ?? undefined,
            author: { '@type': 'Person', name: post.pet.name },
          }}
        />
      ) : null}
      <Stack.Screen
        options={{
          headerRight: () => (
            <View className="flex-row items-center gap-1 pr-1">
              <Pressable hitSlop={10} onPress={onShare} className="px-2">
                <Ionicons name="share-outline" size={22} color="#111" />
              </Pressable>
              {isOwner ? (
                <Pressable hitSlop={10} onPress={onOwnerMenu} className="px-2">
                  <Ionicons name="ellipsis-horizontal" size={22} color="#111" />
                </Pressable>
              ) : null}
            </View>
          ),
        }}
      />
      <ScrollView contentContainerClassName="pb-4">
        {/* Badge de repost — só aparece quando o post é um repost */}
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
            <Ionicons name="repeat" size={14} color="#F97316" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#F97316' }}>
              {post.pet.name} repostou
            </Text>
            {post.original_post ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
                de {post.original_post.pet.name}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View className="flex-row items-center gap-3 px-4 py-3">
          <PetAvatar
            pet={post.pet}
            size={36}
            animation={petOneShot ?? 'breathe'}
            triggerKey={petAnimTrigger}
          />
          <View>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#1A1410' }}>
              {post.pet.name}
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
              {post.updated_at &&
              new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 60_000
                ? ' · editado'
                : ''}
            </Text>
          </View>
        </View>

        {/* Mídia: usa do post original se for repost, senão usa a própria */}
        <MediaCarousel
          media={post.reposted_from && post.original_post ? post.original_post.media : post.media}
          width={w}
        />

        {/* Citação do post original quando é repost */}
        {post.reposted_from && post.original_post?.caption ? (
          <View
            style={{
              marginHorizontal: 14,
              marginTop: 12,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderLeftWidth: 3,
              borderLeftColor: '#F97316',
              backgroundColor: '#FFEDD5',
              borderRadius: 8,
            }}
          >
            <Text
              style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#9A3412', marginBottom: 4 }}
            >
              {post.original_post.pet.name} escreveu:
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: '#1A1410' }}>
              {post.original_post.caption}
            </Text>
          </View>
        ) : null}

        {/* Pet tags */}
        {post.pet_tags && post.pet_tags.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              paddingHorizontal: 16,
              paddingTop: 10,
              alignItems: 'center',
            }}
          >
            <Ionicons name="pricetag" size={12} color="#737373" />
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>com</Text>
            {post.pet_tags.map((tagPet) => (
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
                    backgroundColor: '#FFEDD5',
                  }}
                >
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412' }}>
                    @{tagPet.name}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : null}

        <View className="flex-row items-center gap-4 px-4 py-3">
          <Pressable onPress={() => likeMutation.mutate()} className="flex-row items-center gap-1.5">
            <Ionicons
              name={post.liked_by_me ? 'heart' : 'heart-outline'}
              size={26}
              color={post.liked_by_me ? '#ef4444' : '#111'}
            />
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: '#1A1410' }}>
              {post.likes_count}
            </Text>
          </Pressable>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="chatbubble-outline" size={24} color="#111" />
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 14, color: '#1A1410' }}>
              {post.comments_count}
            </Text>
          </View>
          <Pressable hitSlop={6} onPress={onShare} className="ml-auto flex-row items-center gap-1.5">
            <Ionicons name="share-outline" size={22} color="#111" />
          </Pressable>
        </View>

        {post.caption ? (
          <View className="px-4 pb-3">
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: '#1A1410' }}>
              <Text style={{ fontFamily: FONTS.bodyBold }}>{post.pet.name}</Text> {post.caption}
            </Text>
          </View>
        ) : null}

        <View className="border-t border-neutral-100 px-4 pt-3">
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.4,
              color: '#F97316',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Comentários
          </Text>
          {(() => {
            // Ordena comentários: raízes em ordem cronológica, replies aninham
            // embaixo do pai (também em ordem cronológica entre si).
            const all = commentsQuery.data ?? [];
            const roots = all.filter((c) => !c.parent_id);
            const repliesByParent = new Map<string, typeof all>();
            for (const c of all) {
              if (c.parent_id) {
                const arr = repliesByParent.get(c.parent_id) ?? [];
                arr.push(c);
                repliesByParent.set(c.parent_id, arr);
              }
            }
            const ordered: typeof all = [];
            for (const root of roots) {
              ordered.push(root);
              const replies = repliesByParent.get(root.id) ?? [];
              for (const r of replies) ordered.push(r);
            }
            return ordered;
          })().map((c) => {
            const isMine = c.pet.owner_id === myUserId;
            const isEditing = editingCommentId === c.id;
            const isReply = !!c.parent_id;
            return (
              <View
                key={c.id}
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  paddingVertical: 8,
                  // Indent visual pra replies — borda esquerda + margem
                  paddingLeft: isReply ? 36 : 0,
                  borderLeftWidth: isReply ? 2 : 0,
                  borderLeftColor: '#FED7AA',
                  marginLeft: isReply ? 14 : 0,
                }}
              >
                <PetAvatar pet={c.pet} size={isReply ? 24 : 28} />
                <View className="flex-1">
                  {isEditing ? (
                    <View className="gap-2">
                      <TextInput
                        value={editingCommentText}
                        onChangeText={setEditingCommentText}
                        autoFocus
                        multiline
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
                      />
                      <View className="flex-row gap-2">
                        <Button
                          title="Salvar"
                          size="sm"
                          onPress={() =>
                            editCommentMutation.mutate({ cid: c.id, content: editingCommentText.trim() })
                          }
                          loading={editCommentMutation.isPending}
                          disabled={!editingCommentText.trim()}
                        />
                        <Button
                          title="Cancelar"
                          size="sm"
                          variant="ghost"
                          onPress={() => {
                            setEditingCommentId(null);
                            setEditingCommentText('');
                          }}
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 20, color: '#1A1410' }}>
                        <Text style={{ fontFamily: FONTS.bodyBold }}>{c.pet.name}</Text> {c.content}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 4,
                        }}
                      >
                        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373' }}>
                          {formatDistanceToNow(new Date(c.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                          {c.updated_at &&
                          new Date(c.updated_at).getTime() - new Date(c.created_at).getTime() >
                            60_000
                            ? ' · editado'
                            : ''}
                        </Text>
                        {/* Curtir */}
                        <Pressable
                          onPress={() => likeCommentMutation.mutate(c.id)}
                          hitSlop={6}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                          accessibilityLabel={c.liked_by_me ? 'Descurtir comentário' : 'Curtir comentário'}
                        >
                          <Ionicons
                            name={c.liked_by_me ? 'heart' : 'heart-outline'}
                            size={13}
                            color={c.liked_by_me ? '#EF4444' : '#737373'}
                          />
                          {c.likes_count > 0 ? (
                            <Text
                              style={{
                                fontFamily: FONTS.bodyMedium,
                                fontSize: 11,
                                color: c.liked_by_me ? '#EF4444' : '#737373',
                              }}
                            >
                              {c.likes_count}
                            </Text>
                          ) : null}
                        </Pressable>
                        {/* Responder */}
                        {!c.parent_id ? (
                          <Pressable
                            onPress={() => {
                              setReplyingToId(c.id);
                              setReplyingToName(c.pet.name);
                            }}
                            hitSlop={6}
                          >
                            <Text
                              style={{
                                fontFamily: FONTS.bodyBold,
                                fontSize: 11,
                                color: '#737373',
                              }}
                            >
                              Responder
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </>
                  )}
                </View>
                {isMine && !isEditing ? (
                  <Pressable
                    hitSlop={10}
                    onPress={() => onCommentMenu(c.id, c.content)}
                    className="px-1"
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color="#737373" />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {(commentsQuery.data ?? []).length === 0 ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#737373', paddingVertical: 8 }}>
              Seja o primeiro a comentar.
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Indicador de "respondendo a" — aparece acima do input quando há replyingToId */}
      {replyingToId ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#FFEDD5',
            borderTopWidth: 1,
            borderTopColor: '#FED7AA',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="arrow-undo-outline" size={14} color="#9A3412" />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#9A3412' }}>
              Respondendo a <Text style={{ fontFamily: FONTS.bodyBold }}>{replyingToName}</Text>
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setReplyingToId(null);
              setReplyingToName(null);
            }}
            hitSlop={8}
          >
            <Ionicons name="close" size={16} color="#9A3412" />
          </Pressable>
        </View>
      ) : null}

      <View className="flex-row items-end gap-2 border-t border-neutral-200 bg-white p-3">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={replyingToName ? `Responder ${replyingToName}...` : 'Comente como...'}
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={500}
          style={{
            flex: 1,
            fontFamily: FONTS.body,
            fontSize: 14,
            color: '#1A1410',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: draft.length > 0 ? '#F97316' : '#d4d4d4',
            backgroundColor: '#fff',
            paddingHorizontal: 16,
            paddingVertical: 10,
            minHeight: 40,
            maxHeight: 120,
            textAlignVertical: 'center',
          }}
        />
        <Pressable
          disabled={!draft.trim() || commentMutation.isPending}
          onPress={() => commentMutation.mutate(draft.trim())}
          className={`rounded-full bg-brand px-4 py-2 ${!draft.trim() ? 'opacity-50' : ''}`}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>Enviar</Text>
        </Pressable>
      </View>

      <Modal
        visible={editCaptionOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setEditCaptionOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="rounded-t-3xl bg-white p-6 pb-10">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-neutral-900">Editar legenda</Text>
              <Pressable hitSlop={10} onPress={() => setEditCaptionOpen(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </Pressable>
            </View>
            <TextArea
              value={captionDraft}
              onChangeText={setCaptionDraft}
              placeholder="O que tá rolando?"
              rows={4}
            />
            <View className="mt-4">
              <Button
                title="Salvar"
                onPress={() => updateCaptionMutation.mutate(captionDraft.trim() || null)}
                loading={updateCaptionMutation.isPending}
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
