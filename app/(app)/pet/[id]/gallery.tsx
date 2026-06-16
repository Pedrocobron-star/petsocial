import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from 'react-native';

import { FONTS } from '@/lib/fonts';
import { fetchPet, fetchPostsByPet, qk } from '@/lib/queries';
import type { MediaType } from '@/lib/types';
import { useActivePet } from '@/providers/active-pet-provider';

interface GalleryItem {
  id: string;
  url: string;
  type: MediaType;
  post_id: string;
}

export default function PetGalleryScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const router = useRouter();
  const { activePet } = useActivePet();
  const { width, height } = Dimensions.get('window');

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const postsQuery = useQuery({
    // queryKey é montada no render (antes do `enabled`): activePet pode ser null
    // em cold-load / conta sem pet -> activePet!.id crashava. Null-safe + a
    // galeria mostra posts do pet do PERFIL (viewer null -> liked_by_me=false).
    queryKey: qk.petPosts(id, activePet?.id ?? 'anon'),
    queryFn: () => fetchPostsByPet(id, activePet?.id ?? null),
    enabled: !!id,
  });

  const items: GalleryItem[] = useMemo(() => {
    const arr: GalleryItem[] = [];
    for (const p of postsQuery.data ?? []) {
      for (const m of p.media) {
        arr.push({ id: m.id, url: m.url, type: m.media_type, post_id: p.id });
      }
    }
    return arr;
  }, [postsQuery.data]);

  const startIndex = Math.min(Math.max(parseInt(start ?? '0', 10) || 0, 0), Math.max(0, items.length - 1));
  const [index, setIndex] = useState(startIndex);
  const listRef = useRef<FlatList<GalleryItem>>(null);

  // Sincroniza o índice (contador do header + link "Ver post") com startIndex
  // uma única vez quando os itens carregam — sem atropelar os swipes do usuário.
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && items.length > 0) {
      didInit.current = true;
      setIndex(startIndex);
    }
  }, [items.length, startIndex]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const current = items[index];
  const title = petQuery.data?.name ?? 'Galeria';

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitle: () => (
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 16, color: '#fff' }}>{title}</Text>
              <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: '#a3a3a3' }}>
                {items.length > 0 ? `${index + 1} de ${items.length}` : ''}
              </Text>
            </View>
          ),
          headerRight: () =>
            current ? (
              <Pressable
                hitSlop={10}
                onPress={() => router.push({ pathname: '/post/[id]', params: { id: current.post_id } })}
                className="pr-1"
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#F97316' }}>
                  Ver post
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }}>
          {postsQuery.isLoading ? (
            <>
              <ActivityIndicator size="small" color="#F97316" />
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#a3a3a3' }}>
                Carregando galeria...
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 56 }}>📷</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: '#fff', textAlign: 'center' }}>
                Galeria vazia
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#a3a3a3', textAlign: 'center' }}>
                Quando você postar fotos do pet, elas aparecem aqui.
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onMomentumScrollEnd={onMomentumEnd}
          renderItem={({ item }) => (
            <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              {item.type === 'video' ? (
                <GalleryVideo uri={item.url} width={width} height={height} />
              ) : (
                <Image
                  source={{ uri: item.url }}
                  style={{ width, height }}
                  contentFit="contain"
                  transition={200}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function GalleryVideo({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
  });
  return <VideoView player={player} style={{ width, height }} contentFit="contain" nativeControls />;
}
