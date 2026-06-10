import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { exportHealthRecordPdf } from '@/lib/health-pdf';
import type { Pet } from '@/lib/types';
import { useIsPro } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Gera o PRONTUÁRIO COMPLETO em PDF (vacinas, antiparasitários, medicações,
 * consultas, sintomas, peso, exames + alergias) com QR pra carteirinha. Funciona
 * no web (abre o PDF → Salvar como PDF) e no nativo (folha de compartilhamento).
 *
 * Exclusivo do Pet Pro (Cofre da Saúde): pro free, o toque leva pra tela de
 * assinatura com o lock visível — sem tap morto. Nunca bloqueia registrar dados
 * ou ver alertas; só a exportação completa é premium.
 */
export function HealthRecordPdfButton({ pet, tutorName }: { pet: Pet; tutorName?: string | null }) {
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();
  const isPro = useIsPro();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    if (!isPro) {
      haptic.light();
      track('paywall_click', { intent: 'health-record' });
      router.push('/pro?from=health-record' as never);
      return;
    }
    setBusy(true);
    haptic.light();
    try {
      await exportHealthRecordPdf(pet, tutorName);
    } catch {
      toast.error('Não foi possível gerar o prontuário');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isPro ? 'Gerar prontuário completo em PDF' : 'Prontuário completo em PDF — exclusivo Pet Pro'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: theme.accent.color,
        paddingVertical: 13,
        borderRadius: 14,
        opacity: pressed || busy ? 0.85 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={theme.accent.onAccent} size="small" />
      ) : (
        <Ionicons
          name={isPro ? 'document-text-outline' : 'lock-closed'}
          size={18}
          color={theme.accent.onAccent}
        />
      )}
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.accent.onAccent }}>
        {busy ? 'Gerando prontuário…' : isPro ? 'Prontuário completo (PDF)' : 'Prontuário completo (PDF) · Pet Pro'}
      </Text>
    </Pressable>
  );
}
