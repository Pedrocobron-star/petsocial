import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { sharePngDataUrl, svgNodeToPng } from '@/lib/avatar-export';
import { FONTS } from '@/lib/fonts';
import type { ParasiteSummary } from '@/lib/queries';
import type { HealthSummary, Pet } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

import { HealthSummaryPosterSvg } from './health-summary-poster-svg';

interface Props {
  pet: Pet;
  summary: HealthSummary;
  parasiteSummary: ParasiteSummary | undefined;
}

/**
 * Botão "Compartilhar com vet" — gera PNG do prontuário resumido.
 * Reaproveita pipeline svgNodeToPng + sharePngDataUrl (Web Share API ou
 * download). Native: toast "em breve" até instalar view-shot.
 */
export function HealthShareButton({ pet, summary, parasiteSummary }: Props) {
  const toast = useToast();
  const hiddenRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const slug =
    pet.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pet';

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      toast.info('Em breve', 'Compartilhar prontuário disponível em breve no app mobile.');
      return;
    }
    setBusy(true);
    try {
      const node = hiddenRef.current as unknown as Element | null;
      if (!node) return;
      const svg = node.querySelector('svg');
      if (!svg) return;
      // Poster é 800x1100 — exportar 800 mantém proporção; aspect 1:1.375
      const dataUrl = await svgNodeToPng(svg, 800);
      if (!dataUrl) {
        toast.error('Erro', 'Não consegui gerar o prontuário.');
        return;
      }
      const shared = await sharePngDataUrl(
        dataUrl,
        `${slug}-prontuario.png`,
        `Prontuário de ${pet.name}`,
      );
      if (!shared) {
        toast.success('Prontuário salvo!', 'Compartilhe com o veterinário ou guarde como referência.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View
        ref={hiddenRef}
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          width: 800,
        }}
        pointerEvents="none"
        aria-hidden
      >
        <HealthSummaryPosterSvg
          pet={pet}
          summary={summary}
          parasiteSummary={parasiteSummary}
          size={800}
        />
      </View>

      <Pressable
        onPress={handleShare}
        disabled={busy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: '#1E40AF',
          shadowColor: '#1E3A8A',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          opacity: busy ? 0.7 : 1,
        }}
      >
        <Ionicons
          name={busy ? 'hourglass-outline' : 'document-text-outline'}
          size={18}
          color="#FFFFFF"
        />
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 14,
            color: '#FFFFFF',
            letterSpacing: 0.3,
          }}
        >
          {busy ? 'Gerando prontuário...' : 'Compartilhar com veterinário'}
        </Text>
      </Pressable>
    </>
  );
}
