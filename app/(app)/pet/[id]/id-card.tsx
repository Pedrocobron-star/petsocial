import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { PetIdCard } from '@/components/pet-id-card';
import { PetIdStoryCard } from '@/components/pet-id-story-card';
import { VetEndorsementSection } from '@/components/vet-endorsement-section';
import { CenteredColumn } from '@/components/ui/centered-column';
import { PressScale } from '@/components/ui/press-scale';
import { track } from '@/lib/analytics';
import { fetchLatestSignedEndorsement } from '@/lib/endorsements';
import { FONTS } from '@/lib/fonts';
import {
  exportPetIdPdf,
  exportPetIdStoryPdf,
} from '@/lib/pet-id-pdf';
import { fetchPet, fetchProfile, qk } from '@/lib/queries';
import {
  copyToClipboard,
  sharePost,
  shareToInstagramStory,
  shareToWhatsApp,
} from '@/lib/share';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

type CardFormat = 'card' | 'story';

export default function PetIdCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const toast = useToast();
  const router = useRouter();

  const petQuery = useQuery({
    queryKey: qk.pet(id),
    queryFn: () => fetchPet(id),
    enabled: !!id,
  });

  const tutorQuery = useQuery({
    queryKey: petQuery.data ? qk.profile(petQuery.data.owner_id) : ['profile', 'none'],
    queryFn: () => fetchProfile(petQuery.data!.owner_id),
    enabled: !!petQuery.data,
  });

  // Selo de endosso (CRMV) pra mostrar no card + no PDF gerado.
  const endorsementQuery = useQuery({
    queryKey: ['pet-endorsement-signed', id],
    queryFn: () => fetchLatestSignedEndorsement(id),
    enabled: !!petQuery.data,
  });

  const [format, setFormat] = useState<CardFormat>('card');
  const [shareOpen, setShareOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const pet = petQuery.data;
  const tutor = tutorQuery.data ?? null;
  const endorsement = endorsementQuery.data ?? null;

  // fetchPet usa maybeSingle() → null sem throw quando o pet não existe / foi
  // deletado / não é do usuário. Separar "carregando" de "não encontrado" pra
  // não prender o usuário num "Carregando..." eterno (deep-link quebrado).
  if (petQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Stack.Screen options={{ title: 'Carteirinha' }} />
        <ActivityIndicator size="large" color={theme.brand} />
        <Text style={{ fontFamily: FONTS.body, color: theme.textDim }}>Carregando...</Text>
      </View>
    );
  }

  if (!pet) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          gap: 12,
        }}
      >
        <Stack.Screen options={{ title: 'Carteirinha' }} />
        <Text style={{ fontSize: 56 }}>🐾</Text>
        <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
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
          Esse pet não existe mais ou você não tem acesso a ele.
        </Text>
        <PressScale
          onPress={() => router.replace('/(app)/phone' as never)}
          style={{ marginTop: 8, paddingVertical: 10, paddingHorizontal: 18 }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.brand }}>
            Voltar pro início
          </Text>
        </PressScale>
      </View>
    );
  }

  // URL pública pra QR + share
  const baseUrl =
    Platform.OS === 'web'
      ? globalThis.location?.origin ?? 'https://maestropet.com'
      : 'https://maestropet.com';
  // SEMPRE o token (nunca o pet.id) — link por id furava a revogação.
  const publicUrl = pet.id_card_token ? `${baseUrl}/id/${pet.id_card_token}` : '';

  // ============ ACTIONS ============
  const handleDownloadPdf = async () => {
    setExporting(true);
    track('pet_id_share', { channel: 'pdf', format });
    try {
      if (format === 'card') {
        await exportPetIdPdf(pet, tutor, publicUrl);
      } else {
        await exportPetIdStoryPdf(pet, tutor, publicUrl);
      }
      toast.success('PDF gerado!', 'Imprima e cole na coleira do pet 🐾');
      setShareOpen(false);
    } catch (e) {
      toast.error('Erro ao gerar PDF', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    track('pet_id_share', { channel: 'whatsapp', format });
    const text = `🐾 Olha a carteirinha digital do ${pet.name}!\n\n${publicUrl}`;
    const ok = await shareToWhatsApp(text);
    if (ok) {
      toast.success('Abrindo WhatsApp...');
      setShareOpen(false);
    } else {
      toast.error('Não foi possível abrir o WhatsApp');
    }
  };

  const handleShareStory = async () => {
    track('pet_id_share', { channel: 'instagram_story', format });
    setExporting(true);
    try {
      // Tenta abrir Instagram Stories direto
      const ok = await shareToInstagramStory(publicUrl);
      if (ok) {
        toast.success('Abrindo Instagram...', 'Cole o link no Story 📸');
        setShareOpen(false);
      } else {
        // Fallback: gera PDF da story e abre share sheet pra usuário salvar
        await exportPetIdStoryPdf(pet, tutor, publicUrl);
        toast.success('Story salva!', 'Abra o Instagram e poste como Story 📸');
        setShareOpen(false);
      }
    } catch (e) {
      toast.error('Erro ao compartilhar', e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setExporting(false);
    }
  };

  const handleNativeShare = async () => {
    track('pet_id_share', { channel: 'native', format });
    await sharePost({
      title: `Carteirinha do ${pet.name}`,
      message: `🐾 Olha a carteirinha digital do ${pet.name}!`,
      url: publicUrl,
    });
    setShareOpen(false);
  };

  const handleCopyLink = async () => {
    track('pet_id_share', { channel: 'copy_link', format });
    const ok = await copyToClipboard(publicUrl);
    if (ok) {
      toast.success('Link copiado!', 'Cola onde quiser');
      setShareOpen(false);
    } else {
      toast.info('Link', publicUrl);
    }
  };

  const handleOpenPublic = async () => {
    track('pet_id_preview_public');
    try {
      await Linking.openURL(publicUrl);
    } catch {
      toast.error('Não foi possível abrir', 'Tente copiar o link.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen
        options={{
          title: `Carteirinha · ${pet.name}`,
          headerRight: () => (
            <Pressable
              hitSlop={10}
              onPress={() => router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })}
            >
              <Ionicons name="pencil" size={20} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 16, paddingBottom: 32 }}>
        <CenteredColumn maxWidth={540}>
          {/* Toggle Card / Story */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: theme.borderLight,
              borderRadius: 12,
              padding: 3,
              gap: 2,
              marginBottom: 16,
            }}
          >
            <PressScale
              onPress={() => setFormat('card')}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 9,
                backgroundColor: format === 'card' ? theme.surface : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Ionicons
                name="card"
                size={14}
                color={format === 'card' ? theme.brand : theme.textDim}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: format === 'card' ? theme.brand : theme.textDim,
                }}
              >
                Carteirinha
              </Text>
            </PressScale>
            <PressScale
              onPress={() => setFormat('story')}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 9,
                backgroundColor: format === 'story' ? theme.surface : 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <Ionicons
                name="phone-portrait"
                size={14}
                color={format === 'story' ? theme.brand : theme.textDim}
              />
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 12,
                  color: format === 'story' ? theme.brand : theme.textDim,
                }}
              >
                Story 9:16
              </Text>
            </PressScale>
          </View>

          {/* Preview */}
          <Animated.View
            entering={FadeIn.duration(220)}
            key={format}
            style={{ alignItems: 'center', marginBottom: 16 }}
          >
            {format === 'card' ? (
              <PetIdCard
                pet={pet}
                tutorProfile={tutor}
                qrUrl={publicUrl}
                endorsement={endorsement}
                width={340}
              />
            ) : (
              <PetIdStoryCard pet={pet} tutorProfile={tutor} qrUrl={publicUrl} width={280} />
            )}
          </Animated.View>

          {/* CTA principal */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <PressScale
              onPress={() => setShareOpen(true)}
              style={{
                flex: 2,
                backgroundColor: theme.brand,
                paddingVertical: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="share-social" size={18} color="#fff" />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                Compartilhar
              </Text>
            </PressScale>
            <PressScale
              onPress={handleDownloadPdf}
              style={{
                flex: 1,
                backgroundColor: theme.borderLight,
                paddingVertical: 14,
                borderRadius: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="download-outline" size={16} color={theme.text} />
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
                PDF
              </Text>
            </PressScale>
          </View>

          {/* Helper texto */}
          <View
            style={{
              backgroundColor: theme.brandSurface,
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: theme.brandLight,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ fontSize: 16 }}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.brandDark }}>
                  Que tal colar o QR na coleira?
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
                  Imprima e cole numa plaquinha. Quem achar {pet.name} aponta a câmera e te encontra na hora.
                </Text>
              </View>
            </View>
          </View>

          {/* Endosso veterinário — selo de confiança com CRMV (só na carteirinha) */}
          {format === 'card' ? (
            <VetEndorsementSection petId={pet.id} petName={pet.name} />
          ) : null}

          {/* Preview pública — botão discreto pra ver como aparece pra quem escaneia */}
          <PressScale
            onPress={handleOpenPublic}
            style={{
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="eye-outline" size={14} color={theme.textDim} />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: theme.textDim }}>
              Ver como aparece pra quem escaneia o QR
            </Text>
          </PressScale>

          {/* Missing fields warning */}
          {missingFields(pet).length > 0 ? (
            <PressScale
              onPress={() => router.push({ pathname: '/pet/[id]/edit', params: { id: pet.id } })}
              style={{
                marginTop: 8,
                backgroundColor: '#FEF3C7',
                borderRadius: 14,
                padding: 12,
                borderWidth: 1,
                borderColor: '#FCD34D',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 18 }}>📝</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#92400E' }}>
                  Complete a carteirinha
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 11,
                    color: '#92400E',
                    opacity: 0.85,
                    marginTop: 1,
                  }}
                >
                  Faltam: {missingFields(pet).join(' · ')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#92400E" />
            </PressScale>
          ) : null}
        </CenteredColumn>
      </ScrollView>

      {/* ============================================================
          Bottom sheet de compartilhamento
          ============================================================ */}
      <Modal
        visible={shareOpen}
        transparent
        animationType="none"
        onRequestClose={() => setShareOpen(false)}
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable onPress={() => setShareOpen(false)} style={{ flex: 1 }} />
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

            <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  color: theme.text,
                  letterSpacing: -0.4,
                }}
              >
                Compartilhar
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 12,
                  color: theme.textDim,
                  marginTop: 2,
                }}
              >
                Escolha como mandar a carteirinha de {pet.name}
              </Text>
            </View>

            <View style={{ paddingHorizontal: 16, gap: 8 }}>
              <ShareOption
                emoji="💬"
                label="WhatsApp"
                description="Manda direto pro contato"
                tint="#DCFCE7"
                tintText="#166534"
                onPress={handleShareWhatsApp}
              />
              <ShareOption
                emoji="📸"
                label="Instagram Stories"
                description={format === 'story' ? 'Story 9:16 pronta' : 'Vamos gerar a story automaticamente'}
                tint="#FCE7F3"
                tintText="#9D174D"
                onPress={handleShareStory}
                loading={exporting}
              />
              <ShareOption
                emoji="📤"
                label="Outras opções"
                description="Email, mensagens, AirDrop..."
                tint="#DBEAFE"
                tintText="#1E40AF"
                onPress={handleNativeShare}
              />
              <ShareOption
                emoji="🔗"
                label="Copiar link"
                description="Cola onde quiser"
                tint="#F5F5F5"
                tintText="#404040"
                onPress={handleCopyLink}
              />
              <ShareOption
                emoji="📄"
                label="Baixar PDF"
                description={format === 'card' ? 'Tamanho carteirinha' : 'Tamanho story'}
                tint="#FEF3C7"
                tintText="#92400E"
                onPress={handleDownloadPdf}
                loading={exporting}
              />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

function ShareOption({
  emoji,
  label,
  description,
  tint,
  tintText,
  onPress,
  loading = false,
}: {
  emoji: string;
  label: string;
  description: string;
  tint: string;
  tintText: string;
  onPress: () => void;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      disabled={loading}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.borderLight,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: tint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
          {label}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: theme.textDim,
            marginTop: 1,
          }}
        >
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tintText} />
    </PressScale>
  );
}

function missingFields(pet: import('@/lib/types').Pet): string[] {
  const missing: string[] = [];
  if (!pet.microchip_number) missing.push('microchip');
  if (!pet.emergency_contact_phone) missing.push('contato de emergência');
  if (!pet.preferred_vet_name) missing.push('vet preferido');
  return missing;
}
