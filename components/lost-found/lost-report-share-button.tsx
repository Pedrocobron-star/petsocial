import { Ionicons } from '@expo/vector-icons';
import { differenceInDays, parseISO } from 'date-fns';
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { trackLostReportShared } from '@/lib/analytics';
import { sharePngDataUrl, svgNodeToPng } from '@/lib/avatar-export';
import { FONTS } from '@/lib/fonts';
import type { LostReportWithPet } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

import { LostPosterSvg } from './lost-poster-svg';

interface Props {
  report: LostReportWithPet;
}

/**
 * Botão principal pra compartilhar o reporte. Gera PNG do cartaz e dispara
 * Web Share API (mobile web) ou download. Em native mostra toast "em breve"
 * até instalarmos react-native-view-shot.
 */
export function LostReportShareButton({ report }: Props) {
  const toast = useToast();
  const hiddenRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const slug =
    (report.pet?.name ?? report.pet_name ?? 'pet')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'pet';

  const handleShare = async () => {
    if (Platform.OS !== 'web') {
      toast.info('Em breve', 'Compartilhar cartaz disponível em breve no app mobile.');
      return;
    }
    setBusy(true);
    try {
      const node = hiddenRef.current as unknown as Element | null;
      if (!node) return;
      const svg = node.querySelector('svg');
      if (!svg) return;
      // Cartaz é 800x1000 → exportar em 800 mantém proporção
      const dataUrl = await svgNodeToPng(svg, 800);
      if (!dataUrl) {
        toast.error('Erro', 'Não consegui gerar o cartaz.');
        return;
      }
      const petName = report.pet?.name ?? report.pet_name ?? 'pet';
      const title =
        report.kind === 'lost'
          ? `🆘 ${petName} está perdido — ajude a achar`
          : `🐾 Achei um pet — alguém perdeu?`;
      const shared = await sharePngDataUrl(dataUrl, `${slug}-cartaz.png`, title);
      const days = differenceInDays(new Date(), parseISO(report.created_at));
      trackLostReportShared({
        report_id: report.id,
        kind: report.kind,
        days_searching: Math.max(0, days),
        shared_via_intent: shared,
      });
      if (!shared) {
        toast.success('Cartaz salvo!', 'Compartilhe nas suas redes pra espalhar.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Cartaz escondido em alta resolução pro export */}
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
        <LostPosterSvg report={report} size={800} />
      </View>

      <Pressable
        onPress={handleShare}
        disabled={busy}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          paddingHorizontal: 18,
          borderRadius: 14,
          backgroundColor: report.kind === 'lost' ? '#DC2626' : '#16A34A',
          shadowColor: report.kind === 'lost' ? '#7F1D1D' : '#14532D',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          opacity: busy ? 0.7 : 1,
        }}
      >
        <Ionicons
          name={busy ? 'hourglass-outline' : 'share-social'}
          size={20}
          color="#FFFFFF"
        />
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 16,
            color: '#FFFFFF',
            letterSpacing: 0.3,
          }}
        >
          {busy
            ? 'Gerando cartaz...'
            : report.kind === 'lost'
              ? 'Compartilhar — ajude a achar'
              : 'Compartilhar — alguém pode reconhecer'}
        </Text>
      </Pressable>
    </>
  );
}
