import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';

import { PremiumBadge } from '@/components/premium-badge';
import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { useTheme } from '@/providers/theme-provider';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Razão contextual pro upgrade */
  reason:
    | 'maxPets'
    | 'maxPostsPerDay'
    | 'pdfWatermark'
    | 'analytics'
    | 'avatarCustom'
    | 'caretakers'
    | 'healthReports'
    | 'generic';
}

const REASONS: Record<Props['reason'], { emoji: string; title: string; desc: string }> = {
  maxPets: {
    emoji: '🐾',
    title: 'Adicione mais pets',
    desc: 'No plano gratuito você cadastra 1 pet. Vire Pet Pro pra ter até 6 pets: a família toda num lugar só.',
  },
  maxPostsPerDay: {
    emoji: '📸',
    title: 'Você já postou hoje',
    desc: 'Plano gratuito permite 1 post por dia. Pet Pro = poste à vontade, sem limites.',
  },
  caretakers: {
    emoji: '👨‍👩‍👧',
    title: 'Compartilhe a saúde do pet',
    desc: 'Convide co-tutores (família, cuidador, vet) pra acompanhar a saúde do seu pet. Exclusivo do Pet Pro.',
  },
  healthReports: {
    emoji: '📈',
    title: 'Relatórios e gráficos de saúde',
    desc: 'Evolução de peso, custos com o pet e o resumo mensal completo. Exclusivo do Pet Pro.',
  },
  pdfWatermark: {
    emoji: '📤',
    title: 'Carteirinha sem marca d\'água',
    desc: 'Pet Pro gera PDFs limpos, personalizados, prontos pra mostrar no vet.',
  },
  analytics: {
    emoji: '📈',
    title: 'Analytics avançado',
    desc: 'Veja crescimento de seguidores, posts mais curtidos e horários ideais pra postar.',
  },
  avatarCustom: {
    emoji: '🎨',
    title: 'Customize o avatar do seu pet',
    desc: 'No plano gratuito você escolhe entre 37+ raças prontas. Com Pet Pro você muda cor da pelagem, dos olhos, acessórios e até decora a coleira com sininho, plaquinha, estrela e mais.',
  },
  generic: {
    emoji: '⭐',
    title: 'Desbloqueie tudo no Pet Pro',
    desc: 'Até 6 pets, posts à vontade, badge dourada e muito mais.',
  },
};

export function UpgradeModal({ visible, onClose, reason }: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const info = REASONS[reason];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: theme.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            padding: 22,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text }}>
                Pet Pro
              </Text>
              <PremiumBadge size={16} />
            </View>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={{ fontSize: 56, marginBottom: 8 }}>{info.emoji}</Text>
            <Text
              style={{
                fontFamily: FONTS.display,
                fontSize: 22,
                color: theme.text,
                textAlign: 'center',
                marginBottom: 6,
              }}
            >
              {info.title}
            </Text>
            <Text
              style={{
                fontFamily: FONTS.body,
                fontSize: 14,
                color: theme.textDim,
                textAlign: 'center',
                lineHeight: 20,
              }}
            >
              {info.desc}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Agora não" variant="secondary" onPress={onClose} fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Conhecer Pro ⭐"
                onPress={() => {
                  onClose();
                  router.push('/(app)/pro' as never);
                }}
                fullWidth
              />
            </View>
          </View>

          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: theme.textDim,
              textAlign: 'center',
            }}
          >
            A partir de R$ 8,32/mês no plano anual
          </Text>
        </View>
      </View>
    </Modal>
  );
}
