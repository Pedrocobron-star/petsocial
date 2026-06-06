import { Ionicons } from '@expo/vector-icons';
import { Image, type ImageLoadEventData } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import { formatVideoTime, setVideoMuted, toggleVideoMuted, useVideoMuted } from '@/lib/video-mute';
import type { PostMedia } from '@/lib/types';

interface Props {
  media: PostMedia[];
  width: number;
  showIndicators?: boolean;
  /** Aspect ratio mínimo (mais quadrado). Default 0.8. */
  minAspect?: number;
  /** Aspect ratio máximo (mais portrait). Default 1.3. */
  maxAspect?: number;
  /** Post visível no feed → vídeo dá autoplay. Default true (telas de 1 post). */
  isActive?: boolean;
}

export function MediaCarousel({
  media,
  width,
  showIndicators = true,
  minAspect = 0.8,
  maxAspect = 1.3,
  isActive = true,
}: Props) {
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<PostMedia>>(null);
  // Vídeo no feed = 4:5 retrato (1080×1350, igual Instagram). Imagem detecta o aspect no onLoad.
  const [aspect, setAspect] = useState(() => (media[0]?.media_type === 'video' ? 0.8 : 1));

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
        <MediaItem
          media={validMedia[0]}
          width={width}
          height={height}
          onAspect={setAspect}
          active={isActive}
        />
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
        extraData={index}
        renderItem={({ item, index: i }) => (
          <MediaItem
            media={item}
            width={width}
            height={height}
            onAspect={i === 0 ? setAspect : undefined}
            active={isActive && i === index}
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
  active = true,
}: {
  media: PostMedia;
  width: number;
  height: number;
  onAspect?: (a: number) => void;
  active?: boolean;
}) {
  if (media.media_type === 'video') {
    return <VideoItem uri={media.url} width={width} height={height} active={active} />;
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

function VideoItem({
  uri,
  width,
  height,
  active,
}: {
  uri: string;
  width: number;
  height: number;
  active: boolean;
}) {
  const muted = useVideoMuted();
  const viewRef = useRef<VideoView>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.timeUpdateEventInterval = 0.25;
  });

  // Sincroniza com o mute GLOBAL (toca em um, todos respeitam)
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  // Autoplay só quando o post está visível no feed; pausa fora de vista (estilo Instagram).
  // Em tela cheia continua tocando mesmo se a viewability marcar inativo.
  useEffect(() => {
    if (active || isFullscreen) {
      player.play();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [active, isFullscreen, player]);

  // Status (carregando → pronto) + duração total
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status }) => {
      const isReady = status === 'readyToPlay';
      setReady(isReady);
      if (isReady && player.duration) setDuration(player.duration);
    });
    return () => sub.remove();
  }, [player]);

  // Progresso pra barrinha
  useEffect(() => {
    const sub = player.addListener('timeUpdate', ({ currentTime }) => {
      const dur = player.duration || 0;
      setProgress(dur > 0 ? Math.min(1, currentTime / dur) : 0);
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <VideoView
        ref={viewRef}
        player={player}
        style={{ width, height }}
        contentFit="cover"
        nativeControls={isFullscreen}
        allowsFullscreen
        onFullscreenEnter={() => setIsFullscreen(true)}
        onFullscreenExit={() => {
          setIsFullscreen(false);
          setVideoMuted(true);
        }}
      />

      {/* Loading spinner enquanto o vídeo carrega */}
      {!ready ? (
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
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      {/* Duração (canto superior esquerdo) */}
      {ready && duration > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.55)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Ionicons name="play" size={9} color="#fff" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>
            {formatVideoTime(duration)}
          </Text>
        </View>
      ) : null}

      {/* Tela cheia (canto superior direito) — o vídeo ocupa a tela toda */}
      <Pressable
        onPress={(e) => {
          (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
          setVideoMuted(false);
          viewRef.current?.enterFullscreen();
        }}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel="Tela cheia"
      >
        <Ionicons name="expand" size={15} color="#fff" />
      </Pressable>

      {/* Botão de som (canto inferior direito) — IG-style, mute global */}
      <Pressable
        onPress={(e) => {
          (e as unknown as { stopPropagation?: () => void }).stopPropagation?.();
          toggleVideoMuted();
        }}
        hitSlop={8}
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={muted ? 'Ativar som' : 'Desativar som'}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
      </Pressable>

      {/* Barra de progresso (rodapé) */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2.5,
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      >
        <View
          style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#fff' }}
        />
      </View>
    </View>
  );
}
