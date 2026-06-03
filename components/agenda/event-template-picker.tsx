import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { PressScale } from '@/components/ui/press-scale';
import {
  describeRecurrence,
  EVENT_KIND_META,
  EVENT_TEMPLATES,
  filterTemplates,
  type EventTemplate,
} from '@/lib/event-templates';
import { FONTS } from '@/lib/fonts';
import type { PetEventKind, Species } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  visible: boolean;
  species: Species;
  onClose: () => void;
  onSelectTemplate: (template: EventTemplate) => void;
  onCustom: () => void;
}

const KIND_FILTERS: { value: PetEventKind | 'all'; label: string; emoji: string }[] = [
  { value: 'all', label: 'Tudo', emoji: '✨' },
  { value: 'bath', label: 'Banho', emoji: '🛁' },
  { value: 'school', label: 'Escolinha', emoji: '🎓' },
  { value: 'walk', label: 'Passeio', emoji: '🚶' },
  { value: 'vet_visit', label: 'Vet', emoji: '🩺' },
  { value: 'training', label: 'Treino', emoji: '🏆' },
  { value: 'feeding', label: 'Comida', emoji: '🍖' },
  { value: 'nail_trim', label: 'Unha', emoji: '💅' },
];

/**
 * Bottom sheet pra escolher uma rotina pronta da agenda do pet.
 * 1 tap → preenche todos os campos com sugestões inteligentes.
 */
export function EventTemplatePicker({
  visible,
  species,
  onClose,
  onSelectTemplate,
  onCustom,
}: Props) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<PetEventKind | 'all'>('all');

  const templates = useMemo(() => {
    const kind = filter === 'all' ? undefined : filter;
    return filterTemplates(species, kind);
  }, [species, filter]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
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
            maxHeight: '88%',
            paddingTop: 12,
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

          {/* Header */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  color: theme.text,
                  letterSpacing: -0.4,
                }}
              >
                Rotinas prontas ✨
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.textDim,
                  marginTop: 2,
                }}
              >
                Já vem com data, hora e recorrência sugerida
              </Text>
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

          {/* Filtros por tipo */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 6,
              paddingBottom: 12,
            }}
          >
            {KIND_FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <PressScale
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? theme.brand : theme.borderLight,
                  }}
                >
                  <Text style={{ fontSize: 12 }}>{f.emoji}</Text>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 12,
                      color: active ? '#fff' : theme.textMuted,
                    }}
                  >
                    {f.label}
                  </Text>
                </PressScale>
              );
            })}
          </ScrollView>

          {/* Lista de templates */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
          >
            {templates.map((t) => {
              const meta = EVENT_KIND_META[t.kind];
              return (
                <PressScale
                  key={t.slug}
                  onPress={() => {
                    onSelectTemplate(t);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.borderLight,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: meta.tint.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 14,
                        color: theme.text,
                      }}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 2,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 999,
                          backgroundColor: meta.tint.bg,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 9,
                            color: meta.tint.text,
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          {describeRecurrence(t.recurrence)}
                        </Text>
                      </View>
                      {t.estimated_cost ? (
                        <Text
                          style={{
                            fontFamily: FONTS.bodyMedium,
                            fontSize: 11,
                            color: theme.textDim,
                          }}
                        >
                          ~R$ {t.estimated_cost}
                        </Text>
                      ) : null}
                    </View>
                    {t.description ? (
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 11,
                          color: theme.textDim,
                          opacity: 0.8,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {t.description}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="add-circle" size={22} color={theme.brand} />
                </PressScale>
              );
            })}

            {/* Custom */}
            <PressScale
              onPress={() => {
                onCustom();
                onClose();
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: theme.brandLight,
                borderStyle: 'dashed',
                backgroundColor: theme.brandSurface,
                marginTop: 4,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: theme.brandLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="create" size={18} color={theme.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 14,
                    color: theme.brandDark,
                  }}
                >
                  Criar do zero
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: theme.brandDark,
                    opacity: 0.8,
                    marginTop: 1,
                  }}
                >
                  Personalize tudo
                </Text>
              </View>
            </PressScale>
            <View style={{ display: 'none' }}>{EVENT_TEMPLATES.length}</View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
