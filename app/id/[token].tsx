import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MetaTags } from '@/components/meta-tags';
import { PetIdCard } from '@/components/pet-id-card';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import { fetchPetByIdToken } from '@/lib/queries';
import { copyToClipboard, sharePost } from '@/lib/share';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Página pública da carteirinha — acessada via QR code colado na coleira.
 * Sem auth obrigatória. Mostra apenas dados declarados pelo tutor + CTAs
 * de contato rápido (WhatsApp, ligar).
 */
export default function PublicPetIdScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const petQuery = useQuery({
    queryKey: ['pet-by-token', token],
    queryFn: () => fetchPetByIdToken(token),
    enabled: !!token,
  });

  // pet + tutor vêm juntos do RPC público (gated por token), sem expor owner_id/PII.
  const pet = petQuery.data?.pet ?? null;
  const tutor = petQuery.data?.tutor ?? null;

  // Analytics: log que alguém visualizou a carteirinha pública
  useEffect(() => {
    if (pet?.id) {
      track('pet_id_public_view', { pet_id: pet.id });
    }
  }, [pet?.id]);

  // URL atual (pra QR mostrar e ser idempotente)
  const baseUrl =
    Platform.OS === 'web'
      ? globalThis.location?.origin ?? 'https://petsocial.app'
      : 'https://petsocial.app';
  const publicUrl = pet ? `${baseUrl}/id/${pet.id_card_token ?? pet.id}` : '';

  const handleCall = (phone: string | null | undefined) => {
    if (!phone) return;
    track('pet_id_public_contact', { method: 'call' });
    const cleaned = phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${cleaned}`).catch(() => {});
  };

  const handleWhatsApp = (phone: string | null | undefined, petName: string) => {
    if (!phone) return;
    track('pet_id_public_contact', { method: 'whatsapp' });
    const cleaned = phone.replace(/[^\d+]/g, '');
    const text = encodeURIComponent(`Oi! Achei o ${petName} 🐾 Vi sua carteirinha digital do Pet Social.`);
    Linking.openURL(`https://wa.me/${cleaned}?text=${text}`).catch(() => {});
  };

  const handleShareLink = async () => {
    if (!pet) return;
    track('pet_id_public_share');
    const baseShare = `${baseUrl}/id/${pet.id_card_token ?? pet.id}`;
    try {
      await sharePost({
        title: `Carteirinha do ${pet.name}`,
        message: `🐾 Achei o ${pet.name}! Veja a carteirinha digital pra ajudar a achar o tutor:`,
        url: baseShare,
      });
    } catch {
      const ok = await copyToClipboard(baseShare);
      if (ok) toast.success('Link copiado!', 'Cola pra mandar pra alguém.');
    }
  };

  if (petQuery.isLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.brand} />
        <Text style={{ fontFamily: FONTS.body, color: theme.textDim }}>Buscando carteirinha...</Text>
      </SafeAreaView>
    );
  }

  if (!pet) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 }}>
          <Text style={{ fontSize: 60 }}>🐾</Text>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 22,
              color: theme.text,
              textAlign: 'center',
            }}
          >
            Carteirinha não encontrada
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 13,
              color: theme.textDim,
              textAlign: 'center',
              lineHeight: 19,
            }}
          >
            Esse link pode estar quebrado ou o tutor desativou a carteirinha.
          </Text>
          <Pressable
            onPress={() => router.replace('/welcome' as never)}
            style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 18 }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
              Ir pra Pet Social
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const hasContact = !!(pet.emergency_contact_phone || pet.preferred_vet_phone);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <MetaTags
        title={`Carteirinha de ${pet.name} · Pet Social`}
        description={`Carteirinha digital de ${pet.name} (${pet.breed ?? pet.species}). Toque pra contato em caso de emergência.`}
        image={pet.avatar_url}
        type="profile"
      />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ paddingVertical: 16, paddingBottom: 40 }}>
        <CenteredColumn maxWidth={420}>
          {/* Header de boas-vindas */}
          <View
            style={{
              backgroundColor: '#1A1410',
              borderRadius: 20,
              padding: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              overflow: 'hidden',
            }}
          >
            <Text style={{ fontSize: 38 }}>🤝</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 18,
                  color: '#fff',
                  letterSpacing: -0.3,
                }}
              >
                Você achou {pet.name}!
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: '#D4D4D4',
                  marginTop: 2,
                }}
              >
                Use os botões abaixo pra avisar o tutor 🐾
              </Text>
            </View>
          </View>

          {/* CTA Buttons */}
          {hasContact ? (
            <View style={{ gap: 8, marginBottom: 16 }}>
              {pet.emergency_contact_phone ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PressScale
                    onPress={() => handleCall(pet.emergency_contact_phone)}
                    style={{
                      flex: 1,
                      backgroundColor: '#EF4444',
                      paddingVertical: 14,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                      Ligar pra emergência
                    </Text>
                  </PressScale>
                  <PressScale
                    onPress={() =>
                      handleWhatsApp(pet.emergency_contact_phone, pet.name)
                    }
                    style={{
                      width: 56,
                      backgroundColor: '#25D366',
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="logo-whatsapp" size={22} color="#fff" />
                  </PressScale>
                </View>
              ) : null}

              {pet.preferred_vet_phone ? (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <PressScale
                    onPress={() => handleCall(pet.preferred_vet_phone)}
                    style={{
                      flex: 1,
                      backgroundColor: theme.borderLight,
                      paddingVertical: 12,
                      borderRadius: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <Ionicons name="medical" size={16} color={theme.text} />
                    <Text
                      style={{
                        fontFamily: FONTS.bodyBold,
                        fontSize: 13,
                        color: theme.text,
                      }}
                    >
                      Ligar pro vet de confiança
                    </Text>
                  </PressScale>
                </View>
              ) : null}

              {/* Compartilhar link — útil pra avisar outros */}
              <PressScale
                onPress={handleShareLink}
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: theme.borderLight,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="share-social-outline" size={16} color={theme.text} />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                  Compartilhar essa carteirinha
                </Text>
              </PressScale>
            </View>
          ) : (
            // Fallback quando o tutor não cadastrou contato direto
            <View
              style={{
                marginBottom: 16,
                padding: 14,
                backgroundColor: '#FEF3C7',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#FCD34D',
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="information-circle" size={18} color="#92400E" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#78350F' }}>
                  Sem contato direto registrado
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: '#78350F',
                  lineHeight: 17,
                }}
              >
                Compartilhe essa carteirinha em redes sociais ou grupos de bairro pra
                aumentar as chances do tutor de {pet.name} ver.
              </Text>
              <PressScale
                onPress={handleShareLink}
                style={{
                  marginTop: 4,
                  paddingVertical: 10,
                  backgroundColor: '#92400E',
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="share-social" size={14} color="#fff" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#fff' }}>
                  Compartilhar carteirinha
                </Text>
              </PressScale>
            </View>
          )}

          {/* Carteirinha completa */}
          <View style={{ alignItems: 'center' }}>
            <PetIdCard pet={pet} tutorProfile={tutor} qrUrl={publicUrl} width={340} />
          </View>

          {/* Aviso */}
          <View
            style={{
              marginTop: 16,
              backgroundColor: theme.brandSurface,
              borderRadius: 14,
              padding: 12,
              flexDirection: 'row',
              gap: 8,
              borderWidth: 1,
              borderColor: theme.brandLight,
            }}
          >
            <Text style={{ fontSize: 16 }}>💚</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: theme.brandDark,
                }}
              >
                Obrigado por ajudar!
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 11,
                  color: theme.brandDark,
                  opacity: 0.85,
                  marginTop: 2,
                  lineHeight: 16,
                }}
              >
                Os dados aqui foram registrados pelo tutor de {pet.name}. Pet Social não substitui um veterinário — em emergências médicas, procure ajuda profissional.
              </Text>
            </View>
          </View>

          {/* CTA pra criar conta */}
          <PressScale
            onPress={() => router.push('/welcome' as never)}
            style={{
              marginTop: 14,
              paddingVertical: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <Text style={{ fontSize: 14 }}>🐾</Text>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 12,
                color: theme.brand,
              }}
            >
              Criar carteirinha pro seu pet também
            </Text>
          </PressScale>
        </CenteredColumn>
      </ScrollView>
    </SafeAreaView>
  );
}
