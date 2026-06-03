import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import { trackAvatarShared } from '@/lib/analytics';
import { svgNodeToPng, sharePngDataUrl } from '@/lib/avatar-export';
import { FONTS } from '@/lib/fonts';
import type { PetAvatarConfig } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

import { PetAvatarSvg } from './pet-avatar-svg';

interface Props {
  config: PetAvatarConfig;
  petName?: string;
  /** ID do pet — pra analytics. */
  petId?: string;
  /** Tamanho do PNG exportado (pixels). Default 512. */
  exportSize?: number;
  /** Texto + ícone do botão (override). */
  label?: string;
}

/**
 * Botão que exporta o avatar SVG como PNG e dispara compartilhamento
 * (Web Share API quando suportado, senão download).
 *
 * Renderiza um SVG escondido em alta resolução pra ter qualidade no PNG,
 * sem afetar a UI visível. Web-only por ora — em native precisa instalar
 * react-native-view-shot.
 */
export function AvatarShareButton({
  config,
  petName = 'pet',
  petId,
  exportSize = 512,
  label = 'Compartilhar',
}: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const hiddenRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const slug = petName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'pet';

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      toast.info('Em breve', 'Compartilhar avatar disponível em breve no app mobile.');
      return;
    }
    setBusy(true);
    try {
      const node = hiddenRef.current as unknown as Element | null;
      if (!node) return;
      const svg = node.querySelector('svg');
      if (!svg) return;
      const dataUrl = await svgNodeToPng(svg, exportSize);
      if (!dataUrl) {
        toast.error('Erro', 'Não consegui exportar o avatar.');
        return;
      }
      const shared = await sharePngDataUrl(
        dataUrl,
        `${slug}-avatar.png`,
        `Avatar de ${petName}`,
      );
      trackAvatarShared({ pet_id: petId });
      if (!shared) {
        toast.success('Pronto!', 'Avatar salvo no seu dispositivo.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* SVG escondido em alta resolução pro export */}
      <View
        ref={hiddenRef}
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          width: exportSize,
          height: exportSize,
        }}
        pointerEvents="none"
        aria-hidden
      >
        <PetAvatarSvg
          config={config}
          size={exportSize}
          showBackground
          idleBlink={false}
        />
      </View>

      <PressScale
        onPress={handleShare}
        disabled={busy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: theme.brandLight,
          borderWidth: 1,
          borderColor: theme.brand,
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Ionicons
          name={busy ? 'hourglass-outline' : 'share-outline'}
          size={16}
          color={theme.brand}
        />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
          {busy ? 'Exportando...' : label}
        </Text>
      </PressScale>
    </>
  );
}
