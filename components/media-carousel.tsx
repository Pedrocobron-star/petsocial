import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageLoadEventData } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import type { PostMedia } from '@/lib/types';

interface Props {
  media: PostMedia[];
  width: number;
  showIndicators?: boolean;
  /** Aspect ratio mínimo (mais quadrado). Default 0.8. */
  minAspect?: number;
  /** Aspect ratio máximo (mais portrait). Default 1.3. */
  maxAspect?: number;
}

export function MediaCarousel({
  media,
  width,
  showIndicators = true,
  minAspect = 0.8,
  maxAspect = 1.3,
}: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<PostMedia>>(null);
  const [aspect, setAspect] = useState(1);

  // Filtra medias com URL inválida (placeholder de dev sem imagem real)
  const validMedia = useMemo(
    () => media.filter((m) => m.url && !m.url.includes('PLACEHOLDER') && !m.url.endsWith('/sample.jpg')),
    [media],
  );

  if (validMedia.length === 0) return null;

  const clamped = Math.max(minAspect, Math.min(maxAspect, aspect));
  const height = width / clamped;

  if (validMedia.length === 1) {
    return (
      <View style={{ width, height }}>
        <MediaItem media={validMedia[0]} width={width} height={height} onAspect={setAspect} />
      </View>
    );
  }

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= validMedia.length) return;
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  // No desktop, mostra setas pra navegar
  const showArrows = Platform.OS === 'web';

  return (
    <View style={{ width, height }}>
      <FlatList
        ref={listRef}
        data={validMedia}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item, index: i }) => (
          <MediaItem
            media={item}
            width={width}
            height={height}
            onAspect={i === 0 ? setAspect : undefined}
          />
        )}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      />

      {/* Counter pill */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: 12,
          top: 12,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: 'rgba(0,0,0,0.6)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Ionicons name="albums" size={11} color="#fff" />
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
          {index + 1}/{validMedia.length}
        </Text>
      </View>

      {/* Setas desktop */}
      {showArrows && index > 0 ? (
        <Pressable
          onPress={() => goTo(index - 1)}
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            marginTop: -16,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <Ionicons name="chevron-back" size={20} color="#1A1410" />
        </Pressable>
      ) : null}
      {showArrows && index < validMedia.length - 1 ? (
        <Pressable
          onPress={() => goTo(index + 1)}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            marginTop: -16,
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.9)',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}
        >
          <Ionicons name="chevron-forward" size={20} color="#1A1410" />
        </Pressable>
      ) : null}

      {/* Dots indicator */}
      {showIndicators ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {validMedia.map((m, i) => (
            <View
              key={m.id}
              style={{
                width: i === index ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function MediaItem({
  media,
  width,
  height,
  onAspect,
}: {
  media: PostMedia;
  width: number;
  height: number;
  onAspect?: (a: number) => void;
}) {
  if (media.media_type === 'video') {
    return <VideoItem uri={media.url} width={width} height={height} />;
  }
  return (
    <View style={{ width, height, backgroundColor: '#F5F3F0' }}>
      <Image
        source={{ uri: media.url }}
        style={{ width, height }}
        contentFit="cover"
        transition={250}
        placeholder={{ blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj' }}
        onLoad={(e: ImageLoadEventData) => {
          if (onAspect && e.source?.width && e.source?.height) {
            onAspect(e.source.width / e.source.height);
          }
        }}
      />
    </View>
  );
}

function VideoItem({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return <VideoView player={player} style={{ width, height }} contentFit="cover" nativeControls />;
}
