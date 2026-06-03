import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { CenteredColumn } from '@/components/ui/centered-column';
import { Input } from '@/components/ui/input';
import { PressScale } from '@/components/ui/press-scale';
import { FONTS } from '@/lib/fonts';
import {
  fetchPet,
  fetchPetCaretakers,
  inviteCaretaker,
  qk,
  revokeCaretaker,
  updateCaretaker,
} from '@/lib/queries';
import { copyToClipboard, sharePost } from '@/lib/share';
import type { CaretakerRole, PetCaretakerWithProfile } from '@/lib/types';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const ROLE_LABELS: Record<CaretakerRole, { label: string; emoji: string; description: string }> = {
  caregiver: {
    label: 'Cuidador',
    emoji: '🐾',
    description: 'Pode marcar eventos como feito e anexar fotos',
  },
  viewer: {
    label: 'Visualizador',
    emoji: '👀',
    description: 'Apenas vê a agenda, sem editar',
  },
};

/**
 * Lista de pessoas que ajudam a cuidar do pet: família, dog walker, pet sitter.
 * Differential: divisão clara de responsabilidades — cada um vê o que precisa,
 * o dono nunca perde controle.
 */
export default function CaretakersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const userId = session?.user.id;

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });
  const listQuery = useQuery({
    queryKey: qk.petCaretakers(id),
    queryFn: () => fetchPetCaretakers(id),
    enabled: !!id,
  });

  const isOwner = petQuery.data?.owner_id === userId;
  const [inviteOpen, setInviteOpen] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: (cid: string) => revokeCaretaker(cid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.petCaretakers(id) });
      toast.success('Removido');
    },
    onError: (e) => toast.error('Erro', e instanceof Error ? e.message : ''),
  });

  const roleMutation = useMutation({
    mutationFn: ({ cid, role }: { cid: string; role: CaretakerRole }) =>
      updateCaretaker(cid, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.petCaretakers(id) });
      toast.success('Papel atualizado');
    },
    onError: (e) => toast.error('Erro', e instanceof Error ? e.message : ''),
  });

  const handleShareInvite = async (c: PetCaretakerWithProfile) => {
    const url = `https://petsocial.app/invite/${c.invite_token}`;
    await sharePost({
      title: `Convite pra cuidar de ${petQuery.data?.name ?? 'um pet'}`,
      message: `${petQuery.data?.name ?? 'Um pet'} te convidou pra ajudar a cuidar dele 🐾 Toque pra aceitar:`,
      url,
    });
  };

  const handleCopyInvite = async (c: PetCaretakerWithProfile) => {
    const url = `https://petsocial.app/invite/${c.invite_token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success('Link copiado!', 'Cola onde quiser');
  };

  const handleChangeRole = (c: PetCaretakerWithProfile) => {
    if (!isOwner) return;
    Alert.alert(
      'Mudar papel',
      `${c.nickname ?? c.profile?.display_name ?? 'Caretaker'} é hoje ${ROLE_LABELS[c.role].label.toLowerCase()}`,
      [
        {
          text: 'Cuidador (pode editar)',
          onPress: () => roleMutation.mutate({ cid: c.id, role: 'caregiver' }),
        },
        {
          text: 'Visualizador (só lê)',
          onPress: () => roleMutation.mutate({ cid: c.id, role: 'viewer' }),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  };

  const handleRevoke = (c: PetCaretakerWithProfile) => {
    Alert.alert(
      'Remover acesso?',
      `${c.nickname ?? c.profile?.display_name ?? c.invited_email ?? 'Esta pessoa'} não verá mais a agenda nem poderá registrar eventos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => revokeMutation.mutate(c.id),
        },
      ],
    );
  };

  const list = listQuery.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: petQuery.data ? `Cuidadores · ${petQuery.data.name}` : 'Cuidadores',
        }}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 12, paddingBottom: 32 }}>
        {/* Header */}
        <CenteredColumn maxWidth={540}>
          <View
            style={{
              backgroundColor: theme.brandSurface,
              borderRadius: 16,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: theme.brandLight,
            }}
          >
            <Text style={{ fontSize: 32 }}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 14,
                  color: theme.brandDark,
                }}
              >
                Compartilhe os cuidados
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.brandDark,
                  opacity: 0.85,
                  marginTop: 2,
                }}
              >
                Família, dog walker, pet sitter — todos sincronizados
              </Text>
            </View>
          </View>
        </CenteredColumn>

        {/* CTA novo */}
        {isOwner ? (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 12 }}>
              <PressScale
                onPress={() => setInviteOpen(true)}
                style={{
                  backgroundColor: theme.brand,
                  paddingVertical: 12,
                  borderRadius: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="person-add" size={16} color="#fff" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>
                  Convidar pessoa
                </Text>
              </PressScale>
            </View>
          </CenteredColumn>
        ) : null}

        {/* Lista */}
        {list.length === 0 ? (
          <EmptyState
            emoji="🤝"
            title="Ninguém convidado ainda"
            description={
              isOwner
                ? 'Convide quem te ajuda no cuidado pra dividir as tarefas e manter todo mundo no mesmo ritmo 🐾'
                : 'O tutor ainda não compartilhou os cuidados.'
            }
          />
        ) : (
          <CenteredColumn maxWidth={540}>
            <View style={{ marginTop: 14, gap: 8 }}>
              {list.map((c, idx) => (
                <Animated.View
                  key={c.id}
                  entering={FadeIn.delay(idx * 60).duration(280)}
                >
                  <View
                    style={{
                      backgroundColor: theme.surface,
                      borderRadius: 14,
                      padding: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                    }}
                  >
                    {/* Avatar */}
                    {c.profile?.avatar_url ? (
                      <Image
                        source={{ uri: c.profile.avatar_url }}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: theme.borderLight,
                        }}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor:
                            c.status === 'pending' ? theme.borderLight : theme.brandLight,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>
                          {c.status === 'pending' ? '⏳' : '👤'}
                        </Text>
                      </View>
                    )}

                    {/* Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text
                          style={{
                            fontFamily: FONTS.bodyBold,
                            fontSize: 14,
                            color: theme.text,
                          }}
                          numberOfLines={1}
                        >
                          {c.nickname ??
                            c.profile?.display_name ??
                            c.invited_email ??
                            'Convidado'}
                        </Text>
                        {c.status === 'pending' ? (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 999,
                              backgroundColor: '#FEF3C7',
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: FONTS.bodyBold,
                                fontSize: 9,
                                color: '#92400E',
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                              }}
                            >
                              Pendente
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 2,
                        }}
                      >
                        <Text style={{ fontSize: 10 }}>{ROLE_LABELS[c.role].emoji}</Text>
                        <Text
                          style={{
                            fontFamily: FONTS.body,
                            fontSize: 11,
                            color: theme.textDim,
                          }}
                        >
                          {ROLE_LABELS[c.role].label} · {ROLE_LABELS[c.role].description}
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    {isOwner ? (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {c.status === 'pending' ? (
                          <>
                            <PressScale
                              onPress={() => handleCopyInvite(c)}
                              hitSlop={6}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                backgroundColor: theme.borderLight,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="copy-outline" size={14} color={theme.textDim} />
                            </PressScale>
                            <PressScale
                              onPress={() => handleShareInvite(c)}
                              hitSlop={6}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 10,
                                backgroundColor: theme.brand,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Ionicons name="share-outline" size={14} color="#fff" />
                            </PressScale>
                          </>
                        ) : (
                          <PressScale
                            onPress={() => handleChangeRole(c)}
                            hitSlop={6}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 10,
                              backgroundColor: theme.borderLight,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="settings-outline" size={14} color={theme.textDim} />
                          </PressScale>
                        )}
                        <PressScale
                          onPress={() => handleRevoke(c)}
                          hitSlop={6}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 10,
                            backgroundColor: '#FEE2E2',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="#991B1B" />
                        </PressScale>
                      </View>
                    ) : null}
                  </View>
                </Animated.View>
              ))}
            </View>
          </CenteredColumn>
        )}
      </ScrollView>

      {/* Modal de convite */}
      {petQuery.data && userId ? (
        <InviteModal
          visible={inviteOpen}
          petId={id}
          petName={petQuery.data.name}
          invitedBy={userId}
          onClose={() => setInviteOpen(false)}
          onSaved={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: qk.petCaretakers(id) });
          }}
        />
      ) : null}
    </View>
  );
}

// ============================================================================
// Modal de convite
// ============================================================================
function InviteModal({
  visible,
  petId,
  petName,
  invitedBy,
  onClose,
  onSaved,
}: {
  visible: boolean;
  petId: string;
  petName: string;
  invitedBy: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [role, setRole] = useState<CaretakerRole>('caregiver');
  const [submitting, setSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() && !nickname.trim()) {
      setError('Informe o email OU um apelido pra identificar a pessoa.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await inviteCaretaker({
        pet_id: petId,
        invited_email: email.trim() || `${nickname.trim()}@invite.local`,
        role,
        nickname: nickname.trim() || null,
        invited_by: invitedBy,
      });
      // Mostra o link gerado pra compartilhar
      setCreatedInvite(`https://petsocial.app/invite/${result.invite_token}`);
    } catch (e) {
      toast.error('Erro ao convidar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdInvite) return;
    const ok = await copyToClipboard(createdInvite);
    if (ok) toast.success('Link copiado!', 'Cola no WhatsApp');
  };

  const handleShare = async () => {
    if (!createdInvite) return;
    await sharePost({
      title: `Convite pra cuidar de ${petName}`,
      message: `${petName} te convidou pra ajudar a cuidar dele 🐾 Toque pra aceitar:`,
      url: createdInvite,
    });
  };

  const close = () => {
    setEmail('');
    setNickname('');
    setRole('caregiver');
    setCreatedInvite(null);
    setError(null);
    onClose();
  };

  const done = () => {
    setEmail('');
    setNickname('');
    setRole('caregiver');
    setCreatedInvite(null);
    setError(null);
    onSaved();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <Animated.View
        entering={FadeIn.duration(150)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable onPress={close} style={{ flex: 1 }} />
        <Animated.View
          entering={SlideInDown.duration(280)}
          exiting={SlideOutDown.duration(220)}
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
          }}
        >
          <View style={{ alignItems: 'center', paddingBottom: 8 }}>
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.border,
              }}
            />
          </View>

          {createdInvite ? (
            // Tela de sucesso com link
            <View style={{ gap: 14, paddingTop: 8 }}>
              <View style={{ alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 48 }}>🎉</Text>
                <Text
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 22,
                    color: theme.text,
                    letterSpacing: -0.4,
                  }}
                >
                  Convite criado!
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    textAlign: 'center',
                  }}
                >
                  Mande esse link pra pessoa aceitar
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: theme.borderLight,
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: theme.text,
                  }}
                  selectable
                  numberOfLines={2}
                >
                  {createdInvite}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Copiar link"
                    variant="secondary"
                    onPress={handleCopy}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Compartilhar" onPress={handleShare} fullWidth />
                </View>
              </View>
              <Pressable onPress={done} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 13,
                    color: theme.textDim,
                  }}
                >
                  Pronto, fechar
                </Text>
              </Pressable>
            </View>
          ) : (
            // Form
            <View style={{ gap: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
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
                  Convidar cuidador
                </Text>
                <Pressable hitSlop={10} onPress={close}>
                  <Ionicons name="close" size={24} color={theme.textDim} />
                </Pressable>
              </View>

              <Input
                label="Apelido (pra você identificar)"
                value={nickname}
                onChangeText={(v) => {
                  setNickname(v);
                  if (error) setError(null);
                }}
                placeholder="Marido, Mãe, Petshop Doggy..."
              />

              <Input
                label="Email (opcional)"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (error) setError(null);
                }}
                placeholder="email@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />

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
                  }}
                >
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={{ flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#991B1B' }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              {/* Role picker */}
              <View>
                <Text
                  style={{
                    fontFamily: FONTS.bodySemibold,
                    fontSize: 13,
                    color: theme.text,
                    marginBottom: 6,
                  }}
                >
                  Papel
                </Text>
                <View style={{ gap: 6 }}>
                  {(Object.keys(ROLE_LABELS) as CaretakerRole[]).map((r) => {
                    const active = role === r;
                    const meta = ROLE_LABELS[r];
                    return (
                      <PressScale
                        key={r}
                        onPress={() => setRole(r)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: active ? theme.brandSurface : theme.borderLight,
                          borderWidth: 1.5,
                          borderColor: active ? theme.brand : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: FONTS.bodyBold,
                              fontSize: 14,
                              color: active ? theme.brandDark : theme.text,
                            }}
                          >
                            {meta.label}
                          </Text>
                          <Text
                            style={{
                              fontFamily: FONTS.body,
                              fontSize: 11,
                              color: active ? theme.brandDark : theme.textDim,
                              opacity: 0.85,
                              marginTop: 1,
                            }}
                          >
                            {meta.description}
                          </Text>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark-circle" size={20} color={theme.brand} />
                        ) : null}
                      </PressScale>
                    );
                  })}
                </View>
              </View>

              <View style={{ marginTop: 4 }}>
                <Button
                  title="Gerar link de convite"
                  onPress={handleSubmit}
                  loading={submitting}
                  fullWidth
                />
              </View>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
