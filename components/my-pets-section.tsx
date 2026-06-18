import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { speciesLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { petAgeText } from '@/lib/pet-age';
import type { Pet } from '@/lib/types';
import { useDeletePet } from '@/lib/use-delete-pet';
import { useTheme } from '@/providers/theme-provider';

import { PetAvatar } from './pet-avatar';
import { CenteredColumn } from './ui/centered-column';

interface Props {
  pets: Pet[];
  activePetId: string | null | undefined;
  onSelectPet: (id: string) => void;
}

/**
 * Seção "Meus pets" — header com ação de adicionar + lista de cards.
 * Card mostra avatar, nome, espécie/raça, idade e badge "ativo" quando aplicável.
 */
export function MyPetsSection({ pets, activePetId, onSelectPet }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const { confirmAndDelete } = useDeletePet();

  return (
    <CenteredColumn maxWidth={540}>
      <View style={{ marginTop: 18 }}>
        {/* Header de seção */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text }}>
              Meus pets
            </Text>
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 13, color: theme.textDim }}>
              {pets.length}
            </Text>
          </View>
          <Link href="/(app)/pet/new" asChild>
            <Pressable
              hitSlop={6}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: theme.brandSurface,
              }}
            >
              <Ionicons name="add" size={14} color={theme.brandDark} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brandDark }}>
                Adicionar
              </Text>
            </Pressable>
          </Link>
        </View>

        {/* Lista de pets */}
        <View style={{ gap: 8 }}>
          {pets.map((pet, idx) => {
            const active = pet.id === activePetId;
            const age = petAgeText(pet.birthdate);
            return (
              <Animated.View
                key={pet.id}
                entering={FadeInDown.delay(idx * 50).duration(280)}
              >
                {/* Card inteiro é clicável e abre o perfil do pet — ação primária esperada */}
                <Link
                  href={{ pathname: '/pet/[id]', params: { id: pet.id } }}
                  asChild
                >
                  <Pressable
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderRadius: 16,
                      padding: 10,
                      backgroundColor: active ? theme.brandSurface : theme.surface,
                      borderWidth: 1,
                      borderColor: active ? theme.brandLight : theme.borderLight,
                    }}
                  >
                    <PetAvatar
                      pet={pet}
                      size={52}
                      ring={active}
                    />
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
                          {pet.name}
                        </Text>
                        {active ? (
                          <View
                            style={{
                              backgroundColor: theme.brand,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 999,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: FONTS.bodyBold,
                                fontSize: 9,
                                color: '#fff',
                                textTransform: 'uppercase',
                                letterSpacing: 0.6,
                              }}
                            >
                              ativo
                            </Text>
                          </View>
                        ) : null}
                        {pet.memorial_at ? <Text style={{ fontSize: 13 }}>🌈</Text> : null}
                      </View>
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 12,
                          color: theme.textDim,
                          marginTop: 1,
                        }}
                        numberOfLines={1}
                      >
                        {speciesLabel(pet.species)}
                        {pet.breed ? ` · ${pet.breed}` : ''}
                        {age ? ` · ${age}` : ''}
                      </Text>
                    </View>

                    {/* Botão "ativar" — só aparece quando NÃO é o ativo. Stop propagation
                        pra não disparar o link do card. */}
                    {!active ? (
                      <Pressable
                        onPress={(e) => {
                          const ev = e as {
                            stopPropagation?: () => void;
                            preventDefault?: () => void;
                          };
                          ev.preventDefault?.();
                          ev.stopPropagation?.();
                          onSelectPet(pet.id);
                        }}
                        hitSlop={6}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: theme.brandSurface,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        accessibilityLabel={`Tornar ${pet.name} ativo`}
                      >
                        <Ionicons name="checkmark-circle-outline" size={12} color={theme.brandDark} />
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: theme.brandDark }}>
                          ATIVAR
                        </Text>
                      </Pressable>
                    ) : null}

                    {/* Editar — Pressable (não Link) pra evitar <a> dentro de <a>
                        no web (o card já é um Link). */}
                    <Pressable
                      hitSlop={10}
                      onPress={(e) => {
                        const ev = e as {
                          stopPropagation?: () => void;
                          preventDefault?: () => void;
                        };
                        ev.preventDefault?.();
                        ev.stopPropagation?.();
                        router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } });
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={`Editar ${pet.name}`}
                    >
                      <Ionicons name="pencil" size={14} color={theme.textDim} />
                    </Pressable>

                    {/* Excluir — confirma antes de apagar (o diálogo protege de
                        toque acidental). Stop propagation pra não abrir o card. */}
                    <Pressable
                      hitSlop={10}
                      onPress={(e) => {
                        const ev = e as {
                          stopPropagation?: () => void;
                          preventDefault?: () => void;
                        };
                        ev.preventDefault?.();
                        ev.stopPropagation?.();
                        confirmAndDelete(pet);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={`Excluir ${pet.name}`}
                    >
                      <Ionicons name="trash-outline" size={14} color={theme.textDim} />
                    </Pressable>
                  </Pressable>
                </Link>
              </Animated.View>
            );
          })}

          {/* CTA inline quando 0 pets (raro porque onboarding garante 1) */}
          {pets.length === 0 ? (
            <Link href="/(app)/pet/new" asChild>
              <Pressable
                style={{
                  borderRadius: 16,
                  padding: 18,
                  borderWidth: 1,
                  borderColor: theme.brandLight,
                  borderStyle: 'dashed',
                  backgroundColor: theme.brandSurface,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 28 }}>🐾</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.brandDark }}>
                  Adicione seu primeiro pet
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: theme.brandDark,
                    opacity: 0.8,
                  }}
                >
                  Toque pra começar
                </Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>
    </CenteredColumn>
  );
}
