import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { speciesEmoji } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { qk, searchPets } from '@/lib/queries';
import type { Pet } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';

interface Props {
  visible: boolean;
  /** Pets já selecionados (lista controlada pelo parent) */
  selected: Pet[];
  /** Pet do autor do post — exclui da busca pra não marcar a si mesmo */
  authorPetId?: string;
  onClose: () => void;
  onChange: (pets: Pet[]) => void;
}

const MAX_TAGS = 10;

/**
 * Modal pra marcar (taggear) outros pets num post. Busca por nome em tempo
 * real (debounced via TanStack Query). Mostra os já selecionados como chips
 * removíveis no topo.
 */
export function PetTagsPicker({ visible, selected, authorPetId, onClose, onChange }: Props) {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const trimmed = query.trim();

  const searchQuery = useQuery({
    queryKey: qk.search(trimmed),
    queryFn: () => searchPets(trimmed),
    enabled: trimmed.length > 0,
  });

  const results = (searchQuery.data ?? []).filter(
    (p) => p.id !== authorPetId && !selected.find((s) => s.id === p.id),
  );

  const toggle = (pet: Pet) => {
    if (selected.find((s) => s.id === pet.id)) {
      onChange(selected.filter((s) => s.id !== pet.id));
    } else if (selected.length < MAX_TAGS) {
      onChange([...selected, pet]);
    }
  };

  const remove = (id: string) => onChange(selected.filter((s) => s.id !== id));

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
          <Pressable onPress={onClose} style={{ flex: 1 }} />
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
              maxHeight: '85%',
              maxWidth: 540,
              width: '100%',
              alignSelf: 'center',
            }}
          >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingBottom: 10 }}>
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
              <View>
                <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text }}>
                  Marcar pets
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim, marginTop: 2 }}>
                  {selected.length}/{MAX_TAGS} marcados
                </Text>
              </View>
              <Pressable hitSlop={10} onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.textDim} />
              </Pressable>
            </View>

            {/* Chips dos selecionados */}
            {selected.length > 0 ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {selected.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => remove(p.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: theme.brand,
                    }}
                  >
                    <Text style={{ fontSize: 10 }}>{speciesEmoji(p.species)}</Text>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' }}>
                      {p.name}
                    </Text>
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Search input */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.borderLight,
                backgroundColor: theme.bg,
                marginBottom: 12,
              }}
            >
              <Ionicons name="search" size={16} color={theme.textDim} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar pet pelo nome..."
                placeholderTextColor={theme.textDim}
                autoFocus
                style={{
                  flex: 1,
                  fontFamily: FONTS.body,
                  fontSize: 14,
                  color: theme.text,
                  paddingVertical: 2,
                }}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={theme.textDim} />
                </Pressable>
              ) : null}
            </View>

            {/* Results */}
            {trimmed.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 32 }}>🔍</Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    marginTop: 8,
                    textAlign: 'center',
                  }}
                >
                  Digita o nome do pet pra começar
                </Text>
              </View>
            ) : results.length === 0 && !searchQuery.isLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                <Text style={{ fontSize: 32 }}>😢</Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    marginTop: 8,
                  }}
                >
                  Nenhum pet com &quot;{trimmed}&quot;
                </Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(p) => p.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => toggle(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 12,
                    }}
                  >
                    <PetAvatar pet={item} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: theme.textDim }}>
                        {speciesEmoji(item.species)} {item.breed ?? ''}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={theme.brand} />
                  </Pressable>
                )}
              />
            )}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
