import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import {
  filterProducts,
  formatInterval,
  KIND_EMOJI,
  KIND_LABEL,
  PARASITE_PRODUCTS,
  type ParasiteKind,
  type ParasiteProduct,
} from '@/lib/parasite-products';
import type { Species } from '@/lib/types';
import { useTheme } from '@/providers/theme-provider';

import { PressScale } from './ui/press-scale';

interface Props {
  visible: boolean;
  species: Species;
  onClose: () => void;
  onSelect: (product: ParasiteProduct) => void;
  /** Callback pra cadastrar um produto custom que não está no catálogo. */
  onCustom: () => void;
}

const KIND_FILTERS: { value: ParasiteKind | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'internal', label: 'Vermífugo' },
  { value: 'external', label: 'Pulga & Carrapato' },
  { value: 'heartworm', label: 'Coração' },
  { value: 'combined', label: 'Tudo em um' },
];

/**
 * Bottom sheet modal pra escolher um produto antiparasitário do catálogo.
 * Mostra produtos filtrados por espécie + opção de filtrar por kind.
 * Botão pra cadastrar produto custom se não achar.
 */
export function ParasiteProductPicker({
  visible,
  species,
  onClose,
  onSelect,
  onCustom,
}: Props) {
  const { theme } = useTheme();
  const [filter, setFilter] = useState<ParasiteKind | 'all'>('all');

  const products = useMemo(() => {
    const kind = filter === 'all' ? undefined : filter;
    return filterProducts(species, kind);
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
            maxHeight: '85%',
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
                Escolha o produto 💊
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.textDim,
                  marginTop: 2,
                }}
              >
                Os intervalos já vêm prontos
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

          {/* Filtros */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              gap: 8,
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
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: active ? theme.brand : theme.borderLight,
                  }}
                >
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

          {/* Lista de produtos */}
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}
          >
            {products.map((p) => (
              <PressScale
                key={p.slug}
                onPress={() => {
                  onSelect(p);
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
                    backgroundColor: p.tint.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{p.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 15,
                        color: theme.text,
                      }}
                      numberOfLines={1}
                    >
                      {p.brand}
                    </Text>
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 999,
                        backgroundColor: p.tint.bg,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 9,
                          color: p.tint.text,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}
                      >
                        {KIND_EMOJI[p.kind]} {KIND_LABEL[p.kind]}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 11,
                      color: theme.textDim,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {p.covers.join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyBold,
                      fontSize: 13,
                      color: theme.brand,
                    }}
                  >
                    {formatInterval(p.interval_days)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.bodyMedium,
                      fontSize: 9,
                      color: theme.textDim,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    intervalo
                  </Text>
                </View>
              </PressScale>
            ))}

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
                <Ionicons name="add" size={20} color={theme.brandDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 14,
                    color: theme.brandDark,
                  }}
                >
                  Não achei meu produto
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
                  Cadastrar com intervalo manual
                </Text>
              </View>
            </PressScale>

            {/* Helper text */}
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: theme.textDim,
                textAlign: 'center',
                marginTop: 16,
                paddingHorizontal: 8,
                lineHeight: 16,
              }}
            >
              Intervalos baseados em bula oficial. Sempre confirme com seu vet —
              filhotes e pets debilitados podem precisar de outro esquema.
            </Text>
            {/* Suppress unused warning for PARASITE_PRODUCTS export */}
            <View style={{ display: 'none' }}>{PARASITE_PRODUCTS.length}</View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
