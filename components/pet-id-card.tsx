import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { speciesLabel } from '@/lib/constants';
import { formatEndorsementBadge } from '@/lib/endorsements';
import { FONTS } from '@/lib/fonts';
import { petAgeText } from '@/lib/pet-age';
import type { PublicPetCard } from '@/lib/types';

/** Selo de endosso exibido no card (subconjunto seguro — só nome + CRMV). */
export interface CardEndorsement {
  vet_name: string | null;
  crmv_number: string | null;
  crmv_state: string | null;
}

interface Props {
  /** Aceita Pet completo (uso logado) ou o subconjunto público da carteirinha. */
  pet: PublicPetCard;
  tutorProfile?: { display_name?: string | null; avatar_url?: string | null } | null;
  /** Texto do QR (URL pública). Quando undefined, mostra placeholder. */
  qrUrl?: string;
  /** Selo do vet (CRMV) — aparece na carteirinha privada, pública e no PDF. */
  endorsement?: CardEndorsement | null;
  /** Largura total do card (default: 340). */
  width?: number;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  // Parseia 'YYYY-MM-DD' como data LOCAL (não UTC) — senão o fuso BR mostra 1 dia a menos.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('pt-BR');
}

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
 * Cartão de identificação do pet — frente do "passaporte".
 * Estética híbrida: header tipo documento (com brasão), corpo organizado em
 * dois lados (foto/QR à esquerda, dados à direita), warm cream + patinhas
 * decorativas em opacidade baixa.
 *
 * Reusable: aparece na tela de ID card, na página pública, e como base do PDF.
 */
export function PetIdCard({ pet, tutorProfile, qrUrl, endorsement, width = 340 }: Props) {
  const ageText = petAgeText(pet.birthdate);
  // Número de série formatado a partir do token (primeiros 8 chars em caps)
  const serial = (pet.id_card_token ?? pet.id)
    .replace(/-/g, '')
    .toUpperCase()
    .slice(0, 12);
  // QR via API pública (não precisa de lib local)
  const qrSrc = qrUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrUrl)}&size=180x180&margin=4&color=1A1410&bgcolor=ffffff`
    : null;

  return (
    <View
      style={{
        width,
        backgroundColor: '#FFFBF5',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#1A1410',
        shadowColor: '#7C2D12',
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      {/* ============================================================
          HEADER — listras tipo passaporte + brasão
          ============================================================ */}
      <View style={{ backgroundColor: '#1A1410', paddingVertical: 8 }}>
        {/* Listras laranja decorativas */}
        <View
          style={{
            flexDirection: 'row',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <View style={{ height: 3, flex: 1, backgroundColor: '#F97316' }} />
          <View style={{ height: 3, flex: 1, backgroundColor: '#FBBF24' }} />
          <View style={{ height: 3, flex: 1, backgroundColor: '#F97316' }} />
        </View>

        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16 }}>🐾</Text>
            <View>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 12,
                  color: '#FBBF24',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                Maestro Pet
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 8,
                  color: '#D4D4D4',
                  letterSpacing: 0.5,
                  marginTop: -2,
                }}
              >
                CARTEIRINHA DIGITAL DO PET
              </Text>
            </View>
          </View>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#FBBF24',
              borderRadius: 4,
              paddingHorizontal: 5,
              paddingVertical: 1,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 8,
                color: '#FBBF24',
                letterSpacing: 0.8,
              }}
            >
              REPÚBLICA PET · BR
            </Text>
          </View>
        </View>
      </View>

      {/* ============================================================
          CORPO — foto + QR à esquerda, dados à direita
          ============================================================ */}
      <View
        style={{
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          position: 'relative',
        }}
      >
        {/* Patinhas decorativas */}
        <Text
          style={{
            position: 'absolute',
            top: 10,
            right: 8,
            fontSize: 48,
            opacity: 0.05,
            transform: [{ rotate: '15deg' }],
          }}
        >
          🐾
        </Text>
        <Text
          style={{
            position: 'absolute',
            bottom: 4,
            left: 90,
            fontSize: 32,
            opacity: 0.04,
            transform: [{ rotate: '-20deg' }],
          }}
        >
          🐾
        </Text>

        {/* Lado esquerdo: foto + QR */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          {/* Foto formal estilo doc */}
          <View
            style={{
              width: 86,
              height: 100,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: '#1A1410',
              overflow: 'hidden',
              backgroundColor: '#FFEDD5',
            }}
          >
            {pet.avatar_url ? (
              <Image
                source={{ uri: pet.avatar_url }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 44 }}>{speciesEmoji(pet.species)}</Text>
              </View>
            )}
          </View>

          {/* QR code */}
          {qrSrc ? (
            <View
              style={{
                padding: 4,
                backgroundColor: '#fff',
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#1A1410',
              }}
            >
              <Image
                source={{ uri: qrSrc }}
                style={{ width: 72, height: 72 }}
                contentFit="cover"
              />
            </View>
          ) : (
            <View
              style={{
                width: 80,
                height: 80,
                borderWidth: 1,
                borderColor: '#1A1410',
                borderStyle: 'dashed',
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 8, color: '#737373', textAlign: 'center', paddingHorizontal: 4 }}>
                QR{'\n'}placeholder
              </Text>
            </View>
          )}
        </View>

        {/* Lado direito: dados */}
        <View style={{ flex: 1, gap: 6 }}>
          <Field label="Nome" value={pet.name} large />
          <Field
            label="Espécie · Raça"
            value={`${speciesLabel(pet.species)}${pet.breed ? ` · ${pet.breed}` : ''}`}
          />
          <Field
            label="Nascimento"
            value={pet.birthdate ? `${fmtDate(pet.birthdate)}${ageText ? ` (${ageText})` : ''}` : '—'}
          />
          {pet.microchip_number ? (
            <Field label="Microchip" value={pet.microchip_number} mono />
          ) : null}
          {pet.rga_number ? <Field label="RGA" value={pet.rga_number} mono /> : null}
          {pet.sinpatinhas_id ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 8,
                    color: '#065F46',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  SinPatinhas · RG Federal
                </Text>
                <Text style={{ fontSize: 9 }}>🇧🇷</Text>
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#1A1410' }}>
                {pet.sinpatinhas_id}
              </Text>
            </View>
          ) : null}
          {pet.blood_type ? <Field label="Tipo sanguíneo" value={pet.blood_type} /> : null}
        </View>
      </View>

      {/* ============================================================
          MID — alergias + condições (se preenchidos)
          ============================================================ */}
      {pet.allergies || pet.known_conditions ? (
        <View
          style={{
            backgroundColor: '#FEE2E2',
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 4,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: '#FCA5A5',
          }}
        >
          {pet.allergies ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 12 }}>⚠️</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 8,
                    color: '#991B1B',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  Alergias
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
                  {pet.allergies}
                </Text>
              </View>
            </View>
          ) : null}
          {pet.known_conditions ? (
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-start' }}>
              <Text style={{ fontSize: 12 }}>💊</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 8,
                    color: '#991B1B',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  Condições registradas
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#7F1D1D' }}>
                  {pet.known_conditions}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ============================================================
          CONTATOS — tutor + emergência + vet
          ============================================================ */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: '#FFF7ED',
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {tutorProfile?.avatar_url ? (
            <Image
              source={{ uri: tutorProfile.avatar_url }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FED7AA',
              }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FED7AA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11 }}>👤</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 7,
                color: '#9A3412',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Tutor(a)
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#1A1410' }}>
              {tutorProfile?.display_name ?? '—'}
            </Text>
          </View>
        </View>

        {pet.emergency_contact_phone ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#FECACA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11 }}>🚨</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 7,
                  color: '#991B1B',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Emergência {pet.emergency_contact_name ? `· ${pet.emergency_contact_name}` : ''}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#1A1410' }}>
                {pet.emergency_contact_phone}
              </Text>
            </View>
          </View>
        ) : null}

        {pet.preferred_vet_name ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: '#DCFCE7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 11 }}>🩺</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  fontSize: 7,
                  color: '#166534',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                Vet de confiança
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#1A1410' }}>
                {pet.preferred_vet_name}
                {pet.preferred_vet_phone ? ` · ${pet.preferred_vet_phone}` : ''}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* ============================================================
          SELO DE ENDOSSO — vet com CRMV (quando assinado)
          ============================================================ */}
      {endorsement?.vet_name ? (
        <View
          style={{
            backgroundColor: '#DCFCE7',
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderTopWidth: 1,
            borderColor: '#86EFAC',
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: '#16A34A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 12, color: '#fff' }}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 7,
                color: '#166534',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Endossado por veterinário
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 11, color: '#14532D' }}>
              {formatEndorsementBadge(endorsement)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ============================================================
          FOOTER — serial + watermark
          ============================================================ */}
      <View
        style={{
          backgroundColor: '#1A1410',
          paddingHorizontal: 14,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 8,
            color: '#A3A3A3',
            letterSpacing: 0.6,
          }}
        >
          Nº {serial}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 7,
            color: '#737373',
            letterSpacing: 0.5,
          }}
        >
          maestropet.com · não substitui RGA oficial
        </Text>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  large = false,
  mono = false,
}: {
  label: string;
  value: string;
  large?: boolean;
  mono?: boolean;
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: FONTS.bodyBold,
          fontSize: 7,
          color: '#737373',
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: large ? FONTS.display : FONTS.bodyBold,
          fontSize: large ? 18 : 13,
          color: '#1A1410',
          letterSpacing: large ? -0.4 : 0,
          ...(mono ? { letterSpacing: 1.2 } : null),
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
