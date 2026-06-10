import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ReduceMotion,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PressScale } from '@/components/ui/press-scale';
import { TextArea } from '@/components/ui/text-area';
import { EVENT_KIND_META } from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import { fetchPet, logEventOccurrence, qk } from '@/lib/queries';
import { guessExtension, uploadToBucket } from '@/lib/storage';
import type { PetEventKind } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

interface Props {
  visible: boolean;
  eventId: string;
  petId: string;
  occurrenceDate: string; // ISO date 'YYYY-MM-DD'
  eventKind: PetEventKind;
  eventTitle: string;
  estimatedCost?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

const MOODS = [
  { value: 1, emoji: '😢', label: 'Detestou' },
  { value: 2, emoji: '😟', label: 'Não curtiu' },
  { value: 3, emoji: '😐', label: 'Tranquilo' },
  { value: 4, emoji: '🙂', label: 'Curtiu' },
  { value: 5, emoji: '🤩', label: 'Amou!' },
];

/**
 * Modal pós-evento: "Como foi?".
 * Pet owner registra mood (1-5) + notas + custo real opcional.
 * Esse log vira histórico — fundamento do diário visual.
 */
export function EventMoodLog({
  visible,
  eventId,
  petId,
  occurrenceDate,
  eventKind,
  eventTitle,
  estimatedCost,
  onClose,
  onSaved,
}: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const { session } = useSession();
  const meta = EVENT_KIND_META[eventKind];
  const userId = session?.user.id;

  // Busca dados do pet pra mostrar o avatar customizado no header
  const petQuery = useQuery({
    queryKey: qk.pet(petId),
    queryFn: () => fetchPet(petId),
    enabled: !!petId && visible,
  });
  const pet = petQuery.data;

  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState<string>(estimatedCost?.toString() ?? '');

  // Reseta estado quando o modal abre — evita aparecer mood/notas antigos
  useEffect(() => {
    if (visible) {
      setMood(null);
      setNotes('');
      setCost(estimatedCost?.toString() ?? '');
      setPhotoUri(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, eventId, occurrenceDate]);

  // Animação do avatar — bounce quando mood muda
  // Spring na ida (sensação tátil), timing no retorno (settle determinístico)
  const avatarScale = useSharedValue(1);
  const handleSetMood = (value: number) => {
    setMood(value);
    const peak = value >= 4 ? 1.18 : value <= 2 ? 0.92 : 1.06;
    avatarScale.value = withSequence(
      withSpring(peak, {
        damping: 8,
        stiffness: 220,
        mass: 0.6,
        reduceMotion: ReduceMotion.Never,
      }),
      withTiming(1, {
        duration: 280,
        easing: Easing.out(Easing.back(1.4)),
        reduceMotion: ReduceMotion.Never,
      }),
    );
  };
  const avatarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sem permissão', 'Precisamos do acesso à galeria pra anexar foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const handleSave = async (status: 'done' | 'skipped') => {
    const costNum = cost ? parseFloat(cost.replace(',', '.')) : null;
    setSubmitting(true);
    try {
      // Upload da foto primeiro, se houver
      let photoUrl: string | null = null;
      if (photoUri && userId && status === 'done') {
        setUploadingPhoto(true);
        try {
          const ext = guessExtension(photoUri, 'jpg');
          photoUrl = await uploadToBucket('posts', userId, photoUri, ext);
        } catch (e) {
          // Falha no upload não deve bloquear o log
          toast.error('Foto não foi salva', 'Tente de novo depois');
        } finally {
          setUploadingPhoto(false);
        }
      }

      await logEventOccurrence({
        event_id: eventId,
        pet_id: petId,
        occurrence_date: occurrenceDate,
        status,
        mood: status === 'done' ? mood : null,
        notes: notes.trim() || null,
        photo_url: photoUrl,
        actual_cost: costNum && !Number.isNaN(costNum) ? costNum : null,
      });
      if (status === 'done') {
        toast.success('Anotado! 🐾', mood && mood >= 4 ? 'Que delícia ver isso ✨' : '');
      } else {
        toast.success('Pulado');
      }
      onSaved();
    } catch (e) {
      Alert.alert('Erro ao salvar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}
      >
        <PressScale onPress={onClose} style={{ flex: 1 }}>
          <View style={{ flex: 1 }} />
        </PressScale>
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(220)}
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: 28,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingBottom: 4 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.border,
              }}
            />
          </View>

          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Avatar do pet com micro-animação reativa ao mood */}
              <Animated.View style={avatarAnimStyle}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    backgroundColor: meta.tint.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28 }}>{meta.emoji}</Text>
                </View>
              </Animated.View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 20,
                    color: theme.text,
                    letterSpacing: -0.4,
                  }}
                  numberOfLines={1}
                >
                  Como foi?
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: theme.textDim,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {eventTitle}
                </Text>
              </View>
            </View>
            <PressScale onPress={onClose} hitSlop={10}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: theme.borderLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={18} color={theme.textDim} />
              </View>
            </PressScale>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 16,
              gap: 14,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Mood picker grandão */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 8,
                }}
              >
                Como ele(a) reagiu?
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 4 }}>
                {MOODS.map((m) => {
                  const active = mood === m.value;
                  return (
                    <PressScale
                      key={m.value}
                      onPress={() => handleSetMood(m.value)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 12,
                        borderRadius: 14,
                        backgroundColor: active ? theme.brandSurface : theme.borderLight,
                        borderWidth: 1.5,
                        borderColor: active ? theme.brand : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 9,
                          color: active ? theme.brandDark : theme.textDim,
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                          textAlign: 'center',
                        }}
                      >
                        {m.label}
                      </Text>
                    </PressScale>
                  );
                })}
              </View>
            </View>

            {/* Foto pós-evento */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 13,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Foto fofa do momento (opcional)
              </Text>
              {photoUri ? (
                <View
                  style={{
                    position: 'relative',
                    alignSelf: 'flex-start',
                  }}
                >
                  <Image
                    source={{ uri: photoUri }}
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 14,
                      backgroundColor: theme.borderLight,
                    }}
                    contentFit="cover"
                  />
                  <PressScale
                    onPress={() => setPhotoUri(null)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: '#1A1410',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: theme.surface,
                    }}
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </PressScale>
                </View>
              ) : (
                <PressScale
                  onPress={pickPhoto}
                  style={{
                    width: 110,
                    height: 110,
                    borderRadius: 14,
                    backgroundColor: theme.borderLight,
                    borderWidth: 1.5,
                    borderColor: theme.brandLight,
                    borderStyle: 'dashed',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Ionicons name="camera-outline" size={28} color={theme.brand} />
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 11,
                      color: theme.brand,
                    }}
                  >
                    Adicionar
                  </Text>
                </PressScale>
              )}
            </View>

            <Input
              label="Custo real (R$, opcional)"
              value={cost}
              onChangeText={setCost}
              keyboardType="decimal-pad"
              placeholder={estimatedCost ? estimatedCost.toString() : '0,00'}
            />

            <TextArea
              label="Quer registrar algo? (opcional)"
              value={notes}
              onChangeText={setNotes}
              rows={2}
              placeholder="Detalhes da experiência, observações..."
            />

            <View style={{ marginTop: 4, gap: 8 }}>
              <Button
                title={uploadingPhoto ? 'Enviando foto...' : 'Salvar como feito ✓'}
                onPress={() => handleSave('done')}
                loading={submitting}
                fullWidth
              />
              <Pressable
                onPress={() => handleSave('skipped')}
                disabled={submitting}
                style={{
                  paddingVertical: 10,
                  alignItems: 'center',
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 13,
                    color: theme.textDim,
                  }}
                >
                  Pular essa ocorrência
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
