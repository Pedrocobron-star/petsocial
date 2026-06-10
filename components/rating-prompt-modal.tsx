import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { submitAppRating } from '@/lib/app-rating';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const MIN_CHARS = 30;
const STAR_GOLD = '#F59E0B';

interface Props {
  visible: boolean;
  /** "Agora não" — adia. */
  onSnooze: () => void;
  /** Avaliou com sucesso — não mostra mais. */
  onSubmitted: () => void;
  trigger?: string;
}

export function RatingPromptModal({ visible, onSnooze, onSubmitted, trigger }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const chars = text.trim().length;
  const canSend = stars >= 1 && chars >= MIN_CHARS && !saving;

  async function handleSend() {
    if (!canSend) return;
    setSaving(true);
    try {
      await submitAppRating(stars, text.trim(), trigger);
      toast.success('Valeu pela avaliação! 🐾', 'O Mozart agradece de coração');
      setStars(0);
      setText('');
      onSubmitted();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tenta de novo em uns minutos';
      toast.error('Não consegui enviar', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSnooze}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', padding: 22 }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 22,
            padding: 22,
            paddingTop: 64,
            alignItems: 'center',
          }}
        >
          {/* Mozart espiando por cima do card */}
          <Image
            source={{ uri: MOZART.coracao }}
            style={{ width: 120, height: 120, position: 'absolute', top: -54 }}
            resizeMode="contain"
          />

          <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
            Tá curtindo o Maestro Pet?
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13.5,
              color: theme.textDim,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 19,
            }}
          >
            O Mozart adoraria saber sua opinião — ela ajuda demais a gente a melhorar 💛
          </Text>

          {/* Estrelas */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 18, marginBottom: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setStars(n)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
              >
                <Ionicons
                  name={n <= stars ? 'star' : 'star-outline'}
                  size={38}
                  color={n <= stars ? STAR_GOLD : theme.borderLight}
                />
              </Pressable>
            ))}
          </View>
          {stars > 0 ? (
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: STAR_GOLD, marginBottom: 4 }}>
              {['', 'Que pena 😔', 'Dá pra melhorar', 'Tá bom', 'Muito bom!', 'Perfeito! 🎉'][stars]}
            </Text>
          ) : null}

          {/* Comentário */}
          <View style={{ width: '100%', marginTop: 12 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Conta pra gente o que você achou (mín. 30 caracteres)…"
              placeholderTextColor={theme.textDim}
              multiline
              editable={!saving}
              style={{
                minHeight: 84,
                maxHeight: 140,
                borderWidth: 1,
                borderColor: theme.borderLight,
                borderRadius: 12,
                padding: 12,
                fontFamily: FONTS.body,
                fontSize: 14,
                color: theme.text,
                backgroundColor: theme.bg,
                textAlignVertical: 'top',
              }}
            />
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: chars >= MIN_CHARS ? '#16A34A' : theme.textDim,
                marginTop: 4,
                textAlign: 'right',
              }}
            >
              {chars < MIN_CHARS ? `${chars}/${MIN_CHARS} caracteres` : `${chars} caracteres ✓`}
            </Text>
          </View>

          <Button
            title={saving ? 'Enviando…' : 'Enviar avaliação'}
            onPress={handleSend}
            loading={saving}
            disabled={!canSend}
            fullWidth
            style={{ marginTop: 8, opacity: canSend ? 1 : 0.55 }}
          />
          <Pressable onPress={onSnooze} disabled={saving} hitSlop={8} style={{ marginTop: 12, padding: 4 }}>
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: theme.textDim }}>Agora não</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
