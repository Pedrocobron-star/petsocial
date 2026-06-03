import { Image } from 'expo-image';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';

interface Props {
  /** URL da foto do usuário. Se presente, prevalece sobre initial. */
  avatarUrl?: string | null;
  /** Nome do usuário pra extrair a primeira letra. */
  displayName?: string | null;
  /** ID do usuário pra gerar cor determinística do fundo quando não há foto. */
  userId?: string | null;
  size?: number;
}

// 8 cores brand-friendly pra fundo do avatar (geradas determinísticamente pelo userId)
const BG_COLORS = [
  '#F97316', // brand orange
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
];

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Avatar simples pra usuários (tutores). Foto se houver, senão círculo
 * com a inicial do nome em cor brand-friendly determinística (mesmo user =
 * mesma cor sempre).
 *
 * Nota: avatares SVG customizáveis (com partes anatômicas, cores, etc) são
 * EXCLUSIVAMENTE pra pets — humanos usam só foto ou initial.
 */
function UserInitialAvatarInner({ avatarUrl, displayName, userId, size = 40 }: Props) {
  const dims = { width: size, height: size, borderRadius: size / 2 };

  if (avatarUrl) {
    return (
      <View
        style={[dims, { overflow: 'hidden', backgroundColor: '#FFEDD5' }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={displayName ? `Foto de ${displayName}` : 'Foto do tutor'}
      >
        <Image source={{ uri: avatarUrl }} style={dims} contentFit="cover" />
      </View>
    );
  }

  // Fallback: círculo com inicial. Cor determinística baseada no userId/nome.
  const initial = (displayName?.trim()[0] ?? '👤').toUpperCase();
  const colorSeed = userId ?? displayName ?? 'anon';
  const bgColor = BG_COLORS[hashStringToInt(colorSeed) % BG_COLORS.length];

  return (
    <View
      style={[
        dims,
        {
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={displayName ? `Avatar de ${displayName}` : 'Avatar do tutor'}
    >
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: size * 0.42,
          color: '#FFFFFF',
          letterSpacing: -0.5,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

export const UserInitialAvatar = memo(UserInitialAvatarInner);
