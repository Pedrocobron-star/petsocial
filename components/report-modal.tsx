import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { createReport } from '@/lib/queries';
import type { ReportReason, ReportTargetKind } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

interface Props {
  visible: boolean;
  onClose: () => void;
  targetKind: ReportTargetKind;
  targetId: string;
}

const REASONS: { value: ReportReason; label: string; emoji: string }[] = [
  { value: 'spam', label: 'Spam', emoji: '🚫' },
  { value: 'harassment', label: 'Assédio ou bullying', emoji: '😠' },
  { value: 'inappropriate', label: 'Conteúdo inapropriado', emoji: '⚠️' },
  { value: 'animal_abuse', label: 'Maus-tratos animais', emoji: '🐾' },
  { value: 'impersonation', label: 'Se passando por outra pessoa', emoji: '🎭' },
  { value: 'misinformation', label: 'Desinformação', emoji: '❌' },
  { value: 'other', label: 'Outro motivo', emoji: '🔎' },
];

export function ReportModal({ visible, onClose, targetKind, targetId }: Props) {
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [notes, setNotes] = useState('');

  const reportMut = useMutation({
    mutationFn: () =>
      createReport({
        reporter_user_id: session!.user.id,
        target_kind: targetKind,
        target_id: targetId,
        reason: reason!,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Denúncia enviada', 'Obrigado por ajudar a manter o Maestro Pet seguro 🐾');
      setReason(null);
      setNotes('');
      onClose();
    },
    onError: () => toast.error('Não foi possível enviar'),
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            gap: 14,
            maxHeight: '85%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, flex: 1 }}>
              Reportar conteúdo
            </Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
            Sua denúncia é anônima. Vamos revisar e tomar providências.
          </Text>

          <View style={{ gap: 6 }}>
            {REASONS.map((r) => {
              const selected = reason === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: selected ? '#FED7AA' : theme.borderLight,
                    borderWidth: 1,
                    borderColor: selected ? theme.brand : 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{r.emoji}</Text>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: selected ? FONTS.bodyBold : FONTS.body,
                      fontSize: 14,
                      color: selected ? '#9A3412' : theme.text,
                    }}
                  >
                    {r.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={theme.brand} /> : null}
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Algo a mais que possa ajudar? (opcional)"
            placeholderTextColor={theme.textDim}
            multiline
            maxLength={500}
            style={{
              backgroundColor: theme.borderLight,
              borderRadius: 12,
              padding: 12,
              fontFamily: FONTS.body,
              fontSize: 14,
              color: theme.text,
              minHeight: 60,
              textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" variant="secondary" onPress={onClose} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Enviar denúncia"
                onPress={() => reportMut.mutate()}
                disabled={!reason}
                loading={reportMut.isPending}
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
