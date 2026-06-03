import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { Text, View } from 'react-native';

import { speciesEmoji } from '@/lib/constants';
import type { Species } from '@/lib/types';

/**
 * Avatar 3D estilo Microsoft Fluent Emoji — usado como padrão pra pets sem foto
 * nem avatar SVG customizado. Visual muito mais bonito que o emoji texto nativo
 * (que vira "🐶" plano), e gamifica a primeira impressão.
 *
 * Assets do repo open-source da Microsoft (MIT), servidos via jsDelivr.
 * expo-image cacheia agressivamente — só baixa 1× por sessão.
 */

interface Props {
  species: Species;
  size?: number;
  /** Opacity reduzida (uso pra memorial). */
  dimmed?: boolean;
}

// Mapeamento espécie → caminho do asset no repo da Microsoft.
// Cada entrada gera URL: https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/<folder>/3D/<file>.png
const FLUENT_PATHS: Record<Species, { folder: string; file: string }> = {
  dog: { folder: 'Dog face', file: 'dog_face_3d.png' },
  cat: { folder: 'Cat face', file: 'cat_face_3d.png' },
  bird: { folder: 'Parrot', file: 'parrot_3d.png' },
  rabbit: { folder: 'Rabbit face', file: 'rabbit_face_3d.png' },
  rodent: { folder: 'Hamster', file: 'hamster_3d.png' },
  reptile: { folder: 'Lizard', file: 'lizard_3d.png' },
  fish: { folder: 'Tropical fish', file: 'tropical_fish_3d.png' },
  other: { folder: 'Paw prints', file: 'paw_prints_3d.png' },
};

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets';

export function pet3dEmojiUrl(species: Species): string {
  const p = FLUENT_PATHS[species] ?? FLUENT_PATHS.other;
  return `${CDN_BASE}/${encodeURIComponent(p.folder)}/3D/${p.file}`;
}

function Pet3DEmojiInner({ species, size = 48, dimmed = false }: Props) {
  const [errored, setErrored] = useState(false);
  const uri = pet3dEmojiUrl(species);

  // Se a imagem 3D falhar (offline, CDN fora), cai pro emoji nativo do OS.
  if (errored) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.7, opacity: dimmed ? 0.5 : 1 }}>
          {speciesEmoji(species)}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, opacity: dimmed ? 0.5 : 1 }}
      contentFit="contain"
      transition={150}
      onError={() => setErrored(true)}
      // Cache agressivo: mesma imagem em mil lugares = 1 download
      cachePolicy="memory-disk"
      accessibilityLabel={`Avatar 3D de ${species}`}
    />
  );
}

export const Pet3DEmoji = memo(Pet3DEmojiInner);
