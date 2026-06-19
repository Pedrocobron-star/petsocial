import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { FONTS } from '@/lib/fonts';
import { fetchPet, fetchPostsByPet, qk } from '@/lib/queries';
import type { MediaType } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';

interface GalleryItem {
  id: string;
  url: string;
  type: MediaType;
  post_id: string;
  caption: string | null;
  created_at: string;
  /** Índice no array linear (pra abrir o lightbox no lugar certo). */
  i: number;
}

function capMonth(key: string): string {
  try {
    const l = format(parseISO(`${key}-01`), "MMMM 'de' yyyy", { locale: ptBR });
    return l.charAt(0).toUpperCase() + l.slice(1);
  } catch {
    return key;
  }
}

export default function PetGalleryScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const { theme } = useTheme();
  const { activePet } = useActivePet();
  const { session } = useSession();

  const petQuery = useQuery({ queryKey: qk.pet(id), queryFn: () => fetchPet(id), enabled: !!id });
  const postsQuery = useQuery({
    queryKey: qk.petPosts(id, activePet?.id ?? 'anon'),
    queryFn: () => fetchPostsByPet(id, activePet?.id ?? null),
    enabled: !!id,
  });

  const items: GalleryItem[] = useMemo(() => {
    const arr: GalleryItem[] = [];
    let i = 0;
    for (const p of postsQuery.data ?? []) {
      for (const m of p.media) {
        arr.push({ id: m.id, url: m.url, type: m.media_type, post_id: p.id, caption: p.caption, created_at: p.created_at, i: i++ });
      }
    }
    return arr;
  }, [postsQuery.data]);

  // Lightbox: null = grade; número = aberto naquele índice.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const didInit = useRef(false);
  useEffect(() => {
    // Deep-link do perfil (?start=N) abre direto no lightbox.
    if (!didInit.current && items.length > 0 && start != null) {
      didInit.current = true;
      const s = Math.min(Math.max(parseInt(start, 10) || 0, 0), items.length - 1);
      setLightboxIndex(s);
    }
  }, [items.length, start]);

  // Agrupa por mês (items já vêm do mais novo pro mais antigo).
  const groups = useMemo(() => {
    const map = new Map<string, GalleryItem[]>();
    for (const it of items) {
      const key = it.created_at.slice(0, 7);
      const arr = map.get(key);
      if (arr) arr.push(it);
      else map.set(key, [it]);
    }
    return Array.from(map.entries());
  }, [items]);

  // "Neste dia": fotos de anos anteriores no mesmo dia/mês de hoje.
  const onThisDay = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const d = now.getDate();
    const y = now.getFullYear();
    return items.filter((it) => {
      try {
        const dt = parseISO(it.created_at);
        return dt.getMonth() === m && dt.getDate() === d && dt.getFullYear() < y;
      } catch {
        return false;
      }
    });
  }, [items]);

  const stats = useMemo(() => {
    let photos = 0;
    let videos = 0;
    let earliest: string | null = null;
    for (const it of items) {
      if (it.type === 'video') videos++;
      else photos++;
      if (!earliest || it.created_at < earliest) earliest = it.created_at;
    }
    return { photos, videos, earliest };
  }, [items]);

  const router = useRouter();
  const name = petQuery.data?.name ?? 'pet';
  const isOwner = petQuery.data?.owner_id === session?.user.id;

  const { width } = Dimensions.get('window');
  const cols = 3;
  const gap = 3;
  const pad = 12;
  const tile = Math.floor((Math.min(width, 640) - pad * 2 - gap * (cols - 1)) / cols);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ headerShown: true, title: `Galeria de ${name}` }} />

      {items.length === 0 ? (
        postsQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.brand} />
          </View>
        ) : (
          <EmptyState
            emoji="📸"
            title="Auau, ainda não tem fotinha aqui!"
            description={
              isOwner
                ? 'Quando você postar fotos minhas, elas ficam todas juntinhas aqui pra rolar o dia inteiro 🐾'
                : 'Quando o tutor postar fotos, elas aparecem todas aqui.'
            }
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: 40 }}>
          {/* Stats */}
          <Text style={{ fontFamily: FONTS.body, fontSize: 12.5, color: theme.textDim, paddingVertical: 12 }}>
            {stats.photos} {stats.photos === 1 ? 'foto' : 'fotos'}
            {stats.videos > 0 ? ` · ${stats.videos} ${stats.videos === 1 ? 'vídeo' : 'vídeos'}` : ''}
            {stats.earliest ? ` · desde ${capMonth(stats.earliest.slice(0, 7))}` : ''}
          </Text>

          {/* Neste dia */}
          {onThisDay.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brandDark, marginBottom: 8 }}>
                🐾 Neste dia
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {onThisDay.map((it) => (
                  <Pressable key={`otd-${it.id}`} onPress={() => setLightboxIndex(it.i)}>
                    <Image
                      source={{ uri: it.url }}
                      style={{ width: 110, height: 140, borderRadius: 12, backgroundColor: theme.borderLight }}
                      contentFit="cover"
                    />
                    <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 10, color: theme.textDim, marginTop: 3 }}>
                      {format(parseISO(it.created_at), 'yyyy', { locale: ptBR })}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Grade agrupada por mês */}
          {groups.map(([monthKey, monthItems]) => (
            <View key={monthKey} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: theme.textDim,
                  marginBottom: 8,
                }}
              >
                {capMonth(monthKey)}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
                {monthItems.map((it) => (
                  <Pressable
                    key={it.id}
                    onPress={() => setLightboxIndex(it.i)}
                    style={{ width: tile, height: tile, borderRadius: 8, overflow: 'hidden', backgroundColor: theme.borderLight }}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={it.caption ? `Foto: ${it.caption.slice(0, 50)}` : 'Foto'}
                  >
                    {it.type === 'video' ? (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                        <Ionicons name="play-circle" size={30} color="rgba(255,255,255,0.92)" />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: it.url }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        recyclingKey={it.id}
                        cachePolicy="memory-disk"
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {lightboxIndex !== null ? (
        <GalleryLightbox
          items={items}
          startIndex={lightboxIndex}
          petName={name}
          onClose={() => setLightboxIndex(null)}
          onVerPost={(postId) => {
            setLightboxIndex(null);
            router.push({ pathname: '/post/[id]', params: { id: postId } });
          }}
        />
      ) : null}
    </View>
  );
}

function GalleryLightbox({
  items,
  startIndex,
  petName,
  onClose,
  onVerPost,
}: {
  items: GalleryItem[];
  startIndex: number;
  petName: string;
  onClose: () => void;
  onVerPost: (postId: string) => void;
}) {
  const { width, height } = Dimensions.get('window');
  const [index, setIndex] = useState(startIndex);
  const [showChrome, setShowChrome] = useState(true);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const current = items[index];

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setShowChrome((s) => !s)}
              style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
            >
              {item.type === 'video' ? (
                <GalleryVideo uri={item.url} width={width} height={height} />
              ) : (
                <Image source={{ uri: item.url }} style={{ width, height }} contentFit="contain" transition={150} />
              )}
            </Pressable>
          )}
        />

        {/* Top bar */}
        {showChrome ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              paddingTop: 44,
              paddingBottom: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>{petName}</Text>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: '#a3a3a3' }}>
                {index + 1} de {items.length}
              </Text>
            </View>
            {current ? (
              <Pressable onPress={() => onVerPost(current.post_id)} hitSlop={10}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#F97316' }}>Ver post</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Legenda + data */}
        {showChrome && current ? (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingHorizontal: 18,
              paddingTop: 14,
              paddingBottom: 34,
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: '#d4d4d4' }}>
              {format(parseISO(current.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Text>
            {current.caption ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 14, color: '#fff', marginTop: 4, lineHeight: 19 }} numberOfLines={4}>
                {current.caption}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function GalleryVideo({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}
