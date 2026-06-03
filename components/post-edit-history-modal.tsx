import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { fetchPostEditHistory } from '@/lib/queries';
import { useTheme } from '@/providers/theme-provider';

import { PremiumBadge } from './premium-badge';

interface Props {
  visible: boolean;
  postId: string;
  isPro: boolean;
  /** Caption atual (mostrada como "Versão atual" no topo) */
  currentCaption: string | null;
  onClose: () => void;
}

/**
 * Modal pra ver histórico de edições de um post. Pro feature: free vê só
 * upsell. Pro vê todas as versões anteriores com timestamps.
 */
export function PostEditHistoryModal({
  visible,
  postId,
  isPro,
  currentCaption,
  onClose,
}: Props) {
  const { theme } = useTheme();

  const historyQuery = useQuery({
    queryKey: ['post-edit-history', postId],
    queryFn: () => fetchPostEditHistory(postId),
    enabled: visible && isPro,
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
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
          <View style={{ alignItems: 'center', paddingBottom: 12 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="time-outline" size={20} color={theme.text} />
              <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text }}>
                Histórico de edições
              </Text>
              <PremiumBadge size={14} />
            </View>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textDim} />
            </Pressable>
          </View>

          {!isPro ? (
            // Upsell pra free users
            <View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 16 }}>
              <Text style={{ fontSize: 56 }}>📜</Text>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 18,
                  color: theme.text,
                  textAlign: 'center',
                  marginTop: 12,
                }}
              >
                Veja todas as versões anteriores
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: theme.textDim,
                  textAlign: 'center',
                  marginTop: 6,
                  lineHeight: 19,
                }}
              >
                Transparência total: cada edição é registrada com data e hora.
                Disponível pra usuários <Text style={{ fontFamily: FONTS.bodyBold }}>Pet Pro</Text>.
              </Text>
              <Link href={'/(app)/pro' as never} asChild>
                <Pressable
                  onPress={onClose}
                  style={{
                    marginTop: 18,
                    backgroundColor: theme.brand,
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                    Conhecer Pet Pro
                  </Text>
                </Pressable>
              </Link>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 400 }}>
              {/* Versão atual */}
              <View
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  backgroundColor: theme.brandSurface,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    color: theme.brandDark,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Versão atual
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.text, lineHeight: 19 }}>
                  {currentCaption || <Text style={{ fontStyle: 'italic', color: theme.textDim }}>(sem legenda)</Text>}
                </Text>
              </View>

              {/* Versões anteriores */}
              {historyQuery.isLoading ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 12,
                    color: theme.textDim,
                    textAlign: 'center',
                    paddingVertical: 20,
                  }}
                >
                  Carregando...
                </Text>
              ) : (historyQuery.data?.length ?? 0) === 0 ? (
                <Text
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: 13,
                    color: theme.textDim,
                    textAlign: 'center',
                    paddingVertical: 20,
                  }}
                >
                  Nenhuma edição anterior — esse é o post original.
                </Text>
              ) : (
                (historyQuery.data ?? []).map((entry) => (
                  <View
                    key={entry.id}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: theme.bg,
                      borderWidth: 1,
                      borderColor: theme.borderLight,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: FONTS.bodyMedium,
                        fontSize: 11,
                        color: theme.textDim,
                        marginBottom: 4,
                      }}
                    >
                      Editado em {format(parseISO(entry.edited_at), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.text, lineHeight: 19 }}>
                      {entry.previous_caption || (
                        <Text style={{ fontStyle: 'italic', color: theme.textDim }}>(sem legenda)</Text>
                      )}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
