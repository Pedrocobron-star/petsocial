import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { haptic } from '@/lib/haptics';
import { exportHealthRecordPdf } from '@/lib/health-pdf';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Gera o PRONTUÁRIO COMPLETO em PDF (vacinas, antiparasitários, medicações,
 * consultas, sintomas, peso, exames + alergias) com QR pra carteirinha. Funciona
 * no web (abre o PDF → Salvar como PDF) e no nativo (folha de compartilhamento).
 */
export function HealthRecordPdfButton({ pet, tutorName }: { pet: Pet; tutorName?: string | null }) {
  const { theme } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
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
      accessibilityLabel="Gerar prontuário completo em PDF"
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
        <Ionicons name="document-text-outline" size={18} color={theme.accent.onAccent} />
      )}
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: theme.accent.onAccent }}>
        {busy ? 'Gerando prontuário…' : 'Prontuário completo (PDF)'}
      </Text>
    </Pressable>
  );
}
