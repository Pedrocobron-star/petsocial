import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PetAvatar } from '@/components/pet-avatar';
import { PetPicker } from '@/components/pet-picker';
import { PetTagsPicker } from '@/components/pet-tags-picker';
import { Button } from '@/components/ui/button';
import { TextArea } from '@/components/ui/text-area';
import { UpgradeModal } from '@/components/upgrade-modal';
import { speciesEmoji } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import {
  addPetTags,
  attachHashtagsToPost,
  fetchMyPostsTodayCount,
  FREE_POSTS_PER_DAY,
  notifyMentions,
  qk,
} from '@/lib/queries';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { MediaType, Pet } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useIsPro } from '@/providers/subscription-provider';
import { useToast } from '@/providers/toast-provider';

const MAX_MEDIA = 10;
const DRAFT_KEY_PREFIX = 'petsocial:post-draft:';

interface PickedMedia {
  uri: string;
  type: MediaType;
}

export default function CreatePostScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { pets, activePet, setActivePet } = useActivePet();
  const toast = useToast();
  const qc = useQueryClient();
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [taggedPets, setTaggedPets] = useState<Pet[]>([]);
  const [tagsPickerOpen, setTagsPickerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const isPro = useIsPro();

  const userId = session?.user.id;
  const petId = activePet?.id ?? null;

  // Conta posts feitos hoje pra mostrar contador + gate de paywall.
  // Pro não precisa — limit é ilimitado.
  const postsTodayQuery = useQuery({
    queryKey: ['my-posts-today', userId],
    queryFn: fetchMyPostsTodayCount,
    enabled: !!userId && !isPro,
    staleTime: 30_000,
  });
  const postsToday = postsTodayQuery.data ?? 0;
  const reachedLimit = !isPro && postsToday >= FREE_POSTS_PER_DAY;

  // Carrega draft salvo por pet (legenda em texto). Mídia não salva pq URI local
  // pode expirar.
  useEffect(() => {
    if (!petId) return;
    AsyncStorage.getItem(DRAFT_KEY_PREFIX + petId)
      .then((draft) => {
        if (draft) setCaption(draft);
      })
      .catch(() => {})
      .finally(() => setDraftLoaded(true));
  }, [petId]);

  // Auto-save draft a cada mudança (debounce de 600ms via timeout)
  useEffect(() => {
    if (!petId || !draftLoaded) return;
    const trimmed = caption.trim();
    const t = setTimeout(() => {
      if (trimmed) {
        AsyncStorage.setItem(DRAFT_KEY_PREFIX + petId, caption).catch(() => {});
      } else {
        AsyncStorage.removeItem(DRAFT_KEY_PREFIX + petId).catch(() => {});
      }
    }, 600);
    return () => clearTimeout(t);
  }, [caption, petId, draftLoaded]);

  if (!userId || !activePet) return null;

  const pickMedia = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error('Permissão necessária', 'Libere o acesso à galeria nas configurações.');
      return;
    }
    const remaining = MAX_MEDIA - media.length;
    if (remaining <= 0) {
      toast.info('Limite atingido', `Máximo de ${MAX_MEDIA} mídias por post.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 60,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled) return;
    const picked: PickedMedia[] = result.assets.map((a) => ({
      uri: a.uri,
      type: a.type === 'video' ? 'video' : 'image',
    }));
    setMedia((cur) => [...cur, ...picked].slice(0, MAX_MEDIA));
  };

  const removeAt = (i: number) => setMedia((cur) => cur.filter((_, idx) => idx !== i));

  // Reordenar — move item entre posições
  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= media.length) return;
    setMedia((cur) => {
      const next = [...cur];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
    haptic.light();
  };

  const handleSubmit = async () => {
    if (media.length === 0) {
      toast.info('Adiciona uma mídia', 'Pelo menos 1 foto ou vídeo é necessário.');
      return;
    }
    // Gate de paywall pro free tier (defensa em UI; server tem trigger duro também)
    if (reachedLimit) {
      haptic.warning();
      setPaywallOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const uploads = await Promise.all(
        media.map(async (m, i) => {
          const ext = guessExtension(m.uri, m.type === 'video' ? 'mp4' : 'jpg');
          const url = await uploadToBucket('posts', userId, m.uri, ext);
          return { url, media_type: m.type, position: i };
        }),
      );

      const { data: post, error: postErr } = await supabase
        .from('posts')
        .insert({ pet_id: activePet.id, caption: caption.trim() || null })
        .select('id')
        .single();
      if (postErr) {
        // Trigger do server bloqueou (segurança extra caso o gate UI tenha falhado)
        if (
          postErr.message?.includes('free_post_limit_reached') ||
          (postErr as { code?: string }).code === 'P0001'
        ) {
          haptic.warning();
          setPaywallOpen(true);
          return;
        }
        throw postErr;
      }
      const postId = (post as { id: string }).id;

      const { error: mediaErr } = await supabase
        .from('post_media')
        .insert(uploads.map((u) => ({ ...u, post_id: postId })));
      if (mediaErr) throw mediaErr;

      // Hashtags + menções
      if (caption.trim()) {
        try {
          await attachHashtagsToPost(postId, caption);
          await notifyMentions(caption, activePet.id, postId);
        } catch {
          // Não bloqueia o post se hashtags falharem
        }
      }

      // Pet tags (marcações de outros pets)
      if (taggedPets.length > 0) {
        try {
          await addPetTags(
            postId,
            taggedPets.map((p) => p.id),
          );
        } catch {
          // Não bloqueia o post se tags falharem
        }
      }

      setMedia([]);
      setCaption('');
      setTaggedPets([]);
      // Limpa draft após sucesso
      AsyncStorage.removeItem(DRAFT_KEY_PREFIX + activePet.id).catch(() => {});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['feed'] }),
        qc.invalidateQueries({ queryKey: ['my-posts-today'] }),
      ]);
      haptic.success();
      toast.success('Postado!', `${activePet.name} agora tá no feed 🎉`);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      haptic.error();
      toast.error('Erro ao postar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-neutral-50">
      <View className="border-b border-neutral-200 bg-white px-4 py-3">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: FONTS.display, fontSize: 26, color: '#1A1410' }}>Novo post</Text>
          {/* Contador de posts/dia — só pra free */}
          {!isPro ? (
            <Pressable
              onPress={() => reachedLimit && setPaywallOpen(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: reachedLimit ? '#FEE2E2' : '#FFEDD5',
              }}
            >
              <Ionicons
                name={reachedLimit ? 'lock-closed' : 'today-outline'}
                size={11}
                color={reachedLimit ? '#991B1B' : '#9A3412'}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 11,
                  color: reachedLimit ? '#991B1B' : '#9A3412',
                }}
              >
                {postsToday}/{FREE_POSTS_PER_DAY} hoje
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: '#FEF3C7',
              }}
            >
              <Ionicons name="star" size={11} color="#92400E" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#92400E' }}>
                Pro · ilimitado
              </Text>
            </View>
          )}
        </View>
        {caption.trim() && draftLoaded ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="save-outline" size={11} color="#737373" />
            <Text style={{ fontFamily: FONTS.body, fontSize: 10, color: '#737373' }}>
              Rascunho salvo automaticamente
            </Text>
          </View>
        ) : null}
        {/* Banner explicativo quando o free já atingiu o limite */}
        {reachedLimit ? (
          <Pressable
            onPress={() => setPaywallOpen(true)}
            style={{
              marginTop: 10,
              backgroundColor: '#FEF3C7',
              padding: 10,
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 16 }}>⭐</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#92400E' }}>
                Você já postou hoje
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#92400E', marginTop: 1 }}>
                Vire Pet Pro pra postar à vontade · R$ 8,32/mês
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#92400E" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerClassName="p-4 pb-12" keyboardShouldPersistTaps="handled">
        {pets.length > 1 ? (
          <View className="mb-4">
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 13, color: '#404040', marginBottom: 6 }}>
              Postando como
            </Text>
            <View className="-mx-4">
              <PetPicker pets={pets} selectedId={activePet.id} onSelect={setActivePet} />
            </View>
          </View>
        ) : (
          <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-white p-3">
            <PetAvatar pet={activePet} size={40} />
            <View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#737373' }}>
                Postando como
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: '#1A1410' }}>
                {activePet.name}
              </Text>
            </View>
          </View>
        )}

        {media.length === 0 ? (
          <Pressable
            onPress={pickMedia}
            className="mb-4 aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-white"
          >
            <View className="items-center">
              <Ionicons name="cloud-upload-outline" size={48} color="#737373" />
              <Text className="mt-2 font-medium text-neutral-600">Toque pra escolher fotos ou vídeos</Text>
              <Text className="mt-1 text-xs text-neutral-500">
                Até {MAX_MEDIA} • Vídeos de até 60s
              </Text>
            </View>
          </Pressable>
        ) : (
          <View className="mb-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2"
            >
              {media.map((m, i) => (
                <MediaThumbnail
                  key={`${m.uri}-${i}`}
                  media={m}
                  index={i}
                  total={media.length}
                  onRemove={() => removeAt(i)}
                  onMoveLeft={() => moveItem(i, i - 1)}
                  onMoveRight={() => moveItem(i, i + 1)}
                />
              ))}
              {media.length < MAX_MEDIA ? (
                <Pressable
                  onPress={pickMedia}
                  className="h-28 w-28 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white"
                >
                  <Ionicons name="add" size={32} color="#737373" />
                  <Text className="text-xs text-neutral-500">Mais</Text>
                </Pressable>
              ) : null}
            </ScrollView>
            <Text className="mt-2 text-xs text-neutral-500">
              {media.length}/{MAX_MEDIA} {media.length === 1 ? 'mídia' : 'mídias'}
              {media.length > 1 ? ' · use as setas pra reordenar' : ''}
            </Text>
          </View>
        )}

        <TextArea
          label="Legenda (opcional)"
          placeholder="O que tá rolando? Use #hashtags e @nomes pra interagir"
          value={caption}
          onChangeText={setCaption}
          rows={3}
        />

        {/* Marcar pets — chips + botão */}
        <View style={{ marginTop: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodySemibold, fontSize: 13, color: '#404040' }}>
              Marcar pets {taggedPets.length > 0 ? `(${taggedPets.length})` : ''}
            </Text>
            <Pressable
              onPress={() => setTagsPickerOpen(true)}
              hitSlop={6}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                backgroundColor: '#FFEDD5',
              }}
            >
              <Ionicons name="pricetag-outline" size={12} color="#9A3412" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#9A3412' }}>
                {taggedPets.length > 0 ? 'Editar' : 'Marcar'}
              </Text>
            </Pressable>
          </View>
          {taggedPets.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {taggedPets.map((p) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 999,
                    backgroundColor: '#F97316',
                  }}
                >
                  <Text style={{ fontSize: 10 }}>{speciesEmoji(p.species)}</Text>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' }}>
                    {p.name}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View className="mt-4">
          <Button
            title={reachedLimit ? 'Limite atingido — Virar Pro' : 'Postar'}
            onPress={handleSubmit}
            loading={submitting}
            fullWidth
          />
        </View>
      </ScrollView>

      <PetTagsPicker
        visible={tagsPickerOpen}
        selected={taggedPets}
        authorPetId={activePet?.id}
        onClose={() => setTagsPickerOpen(false)}
        onChange={setTaggedPets}
      />

      <UpgradeModal
        visible={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        reason="maxPostsPerDay"
      />
    </SafeAreaView>
  );
}

function MediaThumbnail({
  media,
  index,
  total,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  media: PickedMedia;
  index: number;
  total: number;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}) {
  const canLeft = index > 0;
  const canRight = index < total - 1;
  return (
    <View className="relative">
      <View className="h-28 w-28 overflow-hidden rounded-2xl bg-neutral-200">
        {media.type === 'image' ? (
          <Image source={{ uri: media.uri }} style={{ width: 112, height: 112 }} contentFit="cover" />
        ) : (
          <VideoThumb uri={media.uri} />
        )}
      </View>
      {/* Botão remover */}
      <Pressable
        onPress={onRemove}
        hitSlop={8}
        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/70"
        accessibilityLabel="Remover mídia"
      >
        <Ionicons name="close" size={14} color="#fff" />
      </Pressable>
      {/* Badge da posição */}
      <View className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5">
        <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
      </View>
      {/* Setas reorder — só quando tem mais de 1 */}
      {total > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            flexDirection: 'row',
            gap: 2,
          }}
        >
          {canLeft ? (
            <Pressable
              onPress={onMoveLeft}
              hitSlop={6}
              accessibilityLabel="Mover pra esquerda"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.65)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-back" size={12} color="#fff" />
            </Pressable>
          ) : null}
          {canRight ? (
            <Pressable
              onPress={onMoveRight}
              hitSlop={6}
              accessibilityLabel="Mover pra direita"
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                backgroundColor: 'rgba(0,0,0,0.65)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-forward" size={12} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return (
    <View style={{ width: 112, height: 112 }}>
      <VideoView
        player={player}
        style={{ width: 112, height: 112 }}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Selo de "vídeo" pra diferenciar de foto na seleção */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: 'rgba(0,0,0,0.45)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      </View>
    </View>
  );
}
