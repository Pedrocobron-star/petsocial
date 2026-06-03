import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Dimensions, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { FEED_CARD_MARGIN, MAX_FEED_WIDTH } from '@/lib/layout';
import {
  fetchRecallMatchesForPets,
  RECALL_CATEGORY_LABEL,
  RECALL_SEVERITY_LABEL,
  type RecallMatch,
} from '@/lib/recalls';
import { useActivePet } from '@/providers/active-pet-provider';

/**
 * Banner no feed que avisa quando um recall ativo bate com algum produto
 * registrado dos pets do tutor (ração, antiparasitário, medicação).
 *
 * Diferença pro HealthRemindersBanner: este cruza dados de TODOS os pets do
 * tutor (não só o ativo), porque um recall de ração afeta todos que comem.
 */
export function RecallBanner() {
  const { pets } = useActivePet();
  const [openMatch, setOpenMatch] = useState<RecallMatch | null>(null);

  const query = useQuery({
    queryKey: ['recall-matches', pets.map((p) => p.id).join(',')],
    queryFn: () => fetchRecallMatchesForPets(pets),
    enabled: pets.length > 0,
    staleTime: 10 * 60_000, // recalls mudam devagar
  });

  const matches = query.data ?? [];
  if (matches.length === 0) return null;

  // Mostra o mais severo
  const top = matches[0];
  const sev = top.recall.severity;
  const colors =
    sev === 'high'
      ? { bg: '#FEE2E2', border: '#FCA5A5', fg: '#991B1B', sub: '#7F1D1D' }
      : { bg: '#FEF3C7', border: '#FDE68A', fg: '#92400E', sub: '#78350F' };

  const SCREEN_W = Dimensions.get('window').width;
  const width = Math.min(SCREEN_W - FEED_CARD_MARGIN * 2, MAX_FEED_WIDTH);

  const petNames = top.matchedPets.map((p) => p.name).join(', ');

  return (
    <>
      <Pressable
        onPress={() => setOpenMatch(top)}
        style={{
          width,
          alignSelf: 'center',
          marginTop: 12,
          backgroundColor: colors.bg,
          borderRadius: 14,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="warning" size={24} color={colors.fg} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: colors.fg }}>
            Recall: {top.recall.brand} pode afetar {petNames}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: colors.sub, marginTop: 2 }}>
            {matches.length > 1
              ? `${matches.length} alertas · toque pra ver`
              : 'Toque pra ver o que fazer'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.fg} />
      </Pressable>

      <RecallDetailModal match={openMatch} onClose={() => setOpenMatch(null)} />
    </>
  );
}

function RecallDetailModal({
  match,
  onClose,
}: {
  match: RecallMatch | null;
  onClose: () => void;
}) {
  if (!match) return null;
  const { recall, matchedProducts, matchedPets } = match;
  const sev = recall.severity;
  const accent = sev === 'high' ? '#991B1B' : sev === 'medium' ? '#92400E' : '#525252';
  const bg = sev === 'high' ? '#FEE2E2' : sev === 'medium' ? '#FEF3C7' : '#F5F5F4';

  const openSource = async () => {
    if (!recall.source_url) return;
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(recall.source_url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(recall.source_url);
      }
    } catch {
      // ignora
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(26,20,16,0.6)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 20,
            maxWidth: 420,
            width: '100%',
            alignSelf: 'center',
            maxHeight: '85%',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <View style={{ backgroundColor: bg, padding: 18, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="warning" size={22} color={accent} />
              <View
                style={{
                  backgroundColor: accent,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 10,
                    color: '#FFFFFF',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {RECALL_SEVERITY_LABEL[sev]}
                </Text>
              </View>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: accent }}>
                {RECALL_CATEGORY_LABEL[recall.category]} · {recall.source}
              </Text>
            </View>
            <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#1A1410' }}>
              {recall.title}
            </Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
            {/* Pets afetados */}
            <View
              style={{
                backgroundColor: '#FFF7ED',
                borderRadius: 12,
                padding: 12,
                gap: 4,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#9A3412' }}>
                Pode afetar: {matchedPets.map((p) => p.name).join(', ')}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#9A3412' }}>
                Produto registrado: {matchedProducts.join(', ')}
              </Text>
            </View>

            {/* Descrição */}
            <Text style={{ fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: '#1A1410' }}>
              {recall.description}
            </Text>

            {/* Lotes */}
            {recall.affected_lots ? (
              <View style={{ gap: 4 }}>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    color: '#525252',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  Lotes afetados
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: '#1A1410',
                    backgroundColor: '#F5F5F4',
                    padding: 10,
                    borderRadius: 8,
                  }}
                >
                  {recall.affected_lots}
                </Text>
              </View>
            ) : null}

            {/* Fonte oficial */}
            {recall.source_url ? (
              <Pressable
                onPress={openSource}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: '#1A1410',
                  paddingVertical: 12,
                  borderRadius: 12,
                }}
              >
                <Ionicons name="open-outline" size={16} color="#FFFFFF" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#FFFFFF' }}>
                  Ver comunicado oficial
                </Text>
              </Pressable>
            ) : null}

            {/* Disclaimer */}
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 11,
                color: '#737373',
                textAlign: 'center',
                lineHeight: 16,
              }}
            >
              Alerta informativo cruzado com os produtos que você registrou. Na dúvida sobre a saúde
              do seu pet, procure seu veterinário.
            </Text>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={{
              padding: 14,
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: '#F1ECE5',
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#525252' }}>
              Fechar
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
