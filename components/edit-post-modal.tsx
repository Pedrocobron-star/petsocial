import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  visible: boolean;
  initialCaption: string | null;
  onClose: () => void;
  onSave: (caption: string | null) => Promise<void>;
}

const CAPTION_MAX = 500;

/**
 * Modal pra editar a caption de um post. Mostra contador de caracteres,
 * permite limpar a caption (caption=null) e salva via callback async.
 */
export function EditPostModal({ visible, initialCaption, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const [caption, setCaption] = useState(initialCaption ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state quando reabre
  useEffect(() => {
    if (visible) {
      setCaption(initialCaption ?? '');
      setError(null);
      setSaving(false);
    }
  }, [visible, initialCaption]);

  const trimmed = caption.trim();
  const dirty = (trimmed || null) !== (initialCaption?.trim() || null);
  const overLimit = caption.length > CAPTION_MAX;
  const canSave = dirty && !overLimit && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed.length > 0 ? trimmed : null);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tente novamente.');
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable onPress={saving ? undefined : onClose} style={{ flex: 1 }} />
          <Animated.View
            entering={SlideInDown.duration(260)}
            exiting={SlideOutDown.duration(200)}
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingHorizontal: 20,
              paddingBottom: 28,
              maxWidth: 540,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingBottom: 12 }}>
              <View
                style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  color: theme.text,
                  letterSpacing: -0.4,
                }}
              >
                Editar post
              </Text>
              <Pressable hitSlop={10} onPress={onClose} disabled={saving}>
                <Ionicons name="close" size={24} color={theme.textDim} />
              </Pressable>
            </View>

            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 12,
                color: theme.textDim,
                marginBottom: 8,
              }}
            >
              Quem ver o post vai ver a marca de &quot;editado&quot; junto da data.
            </Text>

            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Conta o que rolou..."
              placeholderTextColor={theme.textDim}
              multiline
              autoFocus
              editable={!saving}
              maxLength={CAPTION_MAX + 50}
              style={{
                fontFamily: FONTS.body,
                fontSize: 15,
                color: theme.text,
                backgroundColor: theme.bg,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: overLimit ? '#DC2626' : theme.borderLight,
                padding: 12,
                minHeight: 110,
                textAlignVertical: 'top',
              }}
            />

            {/* Char counter */}
            <Text
              style={{
                fontFamily: FONTS.bodyMedium,
                fontSize: 11,
                color: overLimit
                  ? '#DC2626'
                  : caption.length > CAPTION_MAX - 50
                    ? '#F59E0B'
                    : theme.textDim,
                textAlign: 'right',
                marginTop: 6,
              }}
            >
              {caption.length}/{CAPTION_MAX}
            </Text>

            {error ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  backgroundColor: '#FEE2E2',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  marginTop: 8,
                }}
              >
                <Ionicons name="alert-circle" size={14} color="#DC2626" />
                <Text
                  style={{ flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#991B1B' }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Pressable
                onPress={onClose}
                disabled={saving}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: theme.borderLight,
                  alignItems: 'center',
                  opacity: saving ? 0.5 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={{
                  flex: 1.3,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: canSave ? theme.brand : '#FCA5A5',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name={saving ? 'hourglass-outline' : 'checkmark'} size={16} color="#fff" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
