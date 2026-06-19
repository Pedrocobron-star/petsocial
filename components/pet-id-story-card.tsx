import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { speciesLabel, temperamentEmoji, temperamentLabel } from '@/lib/constants';
import { FONTS } from '@/lib/fonts';
import { petAgeText } from '@/lib/pet-age';
import type { Pet, Profile } from '@/lib/types';

interface Props {
  pet: Pet;
  tutorProfile?: Profile | null;
  qrUrl?: string;
  /** Largura visual (story tem proporção 9:16 → height = width * 16/9). Default 360. */
  width?: number;
}

const PERSONALITY_INFO: Record<string, { emoji: string; label: string }> = {
  adventurer: { emoji: '🌄', label: 'Aventureiro' },
  cuddler: { emoji: '🤗', label: 'Mimoso' },
  playful: { emoji: '🎾', label: 'Brincalhão' },
  shy: { emoji: '🌸', label: 'Tímido' },
  independent: { emoji: '🦅', label: 'Independente' },
  royal: { emoji: '👑', label: 'Realeza' },
};

function speciesEmoji(species: string): string {
  const m: Record<string, string> = {
    dog: '🐶',
    cat: '🐱',
    bird: '🐦',
    rabbit: '🐰',
    reptile: '🦎',
    rodent: '🐹',
    fish: '🐟',
    other: '🐾',
  };
  return m[species] ?? '🐾';
}

/**
 * Versão 9:16 do Pet ID Card — pensada pra compartilhar em Instagram Stories.
 * Layout vertical com hero da foto grande + dados em cards empilhados.
 * Cores warm e patinhas decorativas em toda a tela.
 */
export function PetIdStoryCard({ pet, tutorProfile, qrUrl, width = 360 }: Props) {
  const height = width * (16 / 9);
  const ageText = petAgeText(pet.birthdate);
  const personality = pet.personality_type ? PERSONALITY_INFO[pet.personality_type] : null;
  const serial = (pet.id_card_token ?? pet.id)
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, 12);
  const qrSrc = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=180x180&margin=4&color=1A1410&bgcolor=ffffff`
    : null;

  // No máximo 3 cards (prioridade pra quem achou o pet: emergência, microchip, vet).
  const infoRows = [
    pet.emergency_contact_phone ? (
      <InfoRow key="e" icon="🚨" label="EMERGÊNCIA" value={pet.emergency_contact_phone} tint="#FEE2E2" tintText="#991B1B" />
    ) : null,
    pet.microchip_number ? (
      <InfoRow key="m" icon="🔖" label="MICROCHIP" value={pet.microchip_number} mono />
    ) : null,
    pet.preferred_vet_name ? (
      <InfoRow key="v" icon="🩺" label="VET" value={pet.preferred_vet_name} />
    ) : null,
    pet.rga_number ? <InfoRow key="r" icon="📋" label="RGA" value={pet.rga_number} mono /> : null,
  ]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: '#FFEDD5',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Patinhas decorativas espalhadas */}
      <Text style={{ position: 'absolute', top: 40, left: -10, fontSize: 110, opacity: 0.08, transform: [{ rotate: '-10deg' }] }}>🐾</Text>
      <Text style={{ position: 'absolute', top: 200, right: -20, fontSize: 100, opacity: 0.08, transform: [{ rotate: '25deg' }] }}>🐾</Text>
      <Text style={{ position: 'absolute', bottom: 200, left: 30, fontSize: 80, opacity: 0.07, transform: [{ rotate: '15deg' }] }}>🐾</Text>
      <Text style={{ position: 'absolute', bottom: 60, right: 20, fontSize: 90, opacity: 0.08, transform: [{ rotate: '-20deg' }] }}>🐾</Text>

      {/* ============================================================
          HEADER — banner watermark
          ============================================================ */}
      <View
        style={{
          backgroundColor: '#1A1410',
          paddingTop: 18,
          paddingBottom: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
        }}
      >
        {/* Listras de passaporte */}
        <View style={{ flexDirection: 'row', position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View style={{ height: 4, flex: 1, backgroundColor: '#F97316' }} />
          <View style={{ height: 4, flex: 1, backgroundColor: '#FBBF24' }} />
          <View style={{ height: 4, flex: 1, backgroundColor: '#F97316' }} />
        </View>
        <Text style={{ fontSize: 22 }}>🐾</Text>
        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 14,
            color: '#FBBF24',
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          Maestro Pet
        </Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 9,
            color: '#D4D4D4',
            letterSpacing: 0.8,
          }}
        >
          CARTEIRINHA DIGITAL OFICIAL
        </Text>
      </View>

      {/* Conteúdo do meio em flex:1 (com overflow) pra o rodapé nunca sobrepor. */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
      {/* ============================================================
          HERO — foto grande + nome
          ============================================================ */}
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <View
          style={{
            width: 160,
            height: 160,
            borderRadius: 80,
            borderWidth: 4,
            borderColor: '#1A1410',
            overflow: 'hidden',
            backgroundColor: '#FED7AA',
            shadowColor: '#7C2D12',
            shadowOpacity: 0.3,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
          }}
        >
          {pet.avatar_url ? (
            <Image
              source={{ uri: pet.avatar_url }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 80 }}>{speciesEmoji(pet.species)}</Text>
            </View>
          )}
        </View>

        <Text
          style={{
            fontFamily: FONTS.display,
            fontSize: 34,
            color: '#1A1410',
            letterSpacing: -0.8,
            marginTop: 14,
          }}
          numberOfLines={1}
        >
          {pet.name}
        </Text>

        {/* Chips espécie + idade */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: '#1A1410',
            }}
          >
            <Text style={{ fontSize: 12 }}>{speciesEmoji(pet.species)}</Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#FBBF24' }}>
              {speciesLabel(pet.species)}
            </Text>
          </View>
          {pet.breed ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: '#FBBF24',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#1A1410' }}>
                {pet.breed}
              </Text>
            </View>
          ) : null}
          {ageText ? (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#1A1410',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#1A1410' }}>
                {ageText}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Personalidade */}
        {personality || pet.social_temperament ? (
          <View
            style={{
              flexDirection: 'row',
              gap: 6,
              marginTop: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              paddingHorizontal: 20,
            }}
          >
            {personality ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: '#F3E8FF',
                }}
              >
                <Text style={{ fontSize: 12 }}>{personality.emoji}</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#7C3AED' }}>
                  {personality.label}
                </Text>
              </View>
            ) : null}
            {pet.social_temperament ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: '#fff',
                }}
              >
                <Text style={{ fontSize: 12 }}>{temperamentEmoji(pet.social_temperament)}</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 10, color: '#404040' }}>
                  {temperamentLabel(pet.social_temperament)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* ============================================================
          INFO CARDS — minimalista
          ============================================================ */}
      <View style={{ paddingHorizontal: 20, marginTop: 16, gap: 6 }}>
        {infoRows}
      </View>
      </View>

      {/* ============================================================
          FOOTER — QR + tutor + serial (flex:none, fica no rodapé sem sobrepor)
          ============================================================ */}
      <View
        style={{
          backgroundColor: '#1A1410',
          paddingTop: 16,
          paddingBottom: 22,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* QR */}
          {qrSrc ? (
            <View
              style={{
                padding: 6,
                backgroundColor: '#fff',
                borderRadius: 8,
              }}
            >
              <Image source={{ uri: qrSrc }} style={{ width: 64, height: 64 }} contentFit="cover" />
            </View>
          ) : (
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 8,
                backgroundColor: '#3D352D',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 28 }}>📱</Text>
            </View>
          )}

          {/* Texto */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 9,
                color: '#FBBF24',
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              Achou esse pet?
            </Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 14,
                color: '#fff',
                letterSpacing: -0.2,
                marginTop: 2,
              }}
            >
              Aponte a câmera no QR
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 10,
                color: '#A3A3A3',
                marginTop: 2,
              }}
            >
              Te conecta com o tutor de {pet.name} 🐾
            </Text>
          </View>
        </View>

        {/* Serial bem discreto */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 8, color: '#525252', letterSpacing: 0.5 }}>
            Nº {serial}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 8, color: '#525252', letterSpacing: 0.4 }}>
            maestropet.com
          </Text>
        </View>

        {/* Listras finais */}
        <View style={{ flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <View style={{ height: 4, flex: 1, backgroundColor: '#F97316' }} />
          <View style={{ height: 4, flex: 1, backgroundColor: '#FBBF24' }} />
          <View style={{ height: 4, flex: 1, backgroundColor: '#F97316' }} />
        </View>
      </View>

      {/* Suppress unused warning */}
      <View style={{ display: 'none' }}>{tutorProfile?.id ?? ''}</View>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
  tint = '#fff',
  tintText = '#1A1410',
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
  tint?: string;
  tintText?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: tint,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(26,20,16,0.12)',
      }}
    >
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 8,
            color: tintText,
            letterSpacing: 0.7,
            opacity: 0.65,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            color: tintText,
            letterSpacing: mono ? 1.1 : 0,
            marginTop: -1,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}
