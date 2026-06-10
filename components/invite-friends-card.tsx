import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';

import { track } from '@/lib/analytics';
import { FONTS } from '@/lib/fonts';
import { getMyReferralStats, referralLink } from '@/lib/referral';
import { copyToClipboard, sharePost } from '@/lib/share';
import { useToast } from '@/providers/toast-provider';

/**
 * Card "Convide amigos" — mostra o código/link de indicação e o placar. Ambos
 * (quem convida e quem é convidado) ganham 7 dias de Pet Pro quando o indicado
 * cadastra o 1º pet.
 */
export function InviteFriendsCard() {
  const toast = useToast();

  const statsQuery = useQuery({
    queryKey: ['referral-stats'],
    queryFn: getMyReferralStats,
    staleTime: 60_000,
  });
  const stats = statsQuery.data;
  const code = stats?.code ?? '';
  const link = code ? referralLink(code) : '';

  const onCopyCode = async () => {
    if (!code) return;
    const ok = await copyToClipboard(code);
    if (ok) {
      toast.success('Código copiado!', code);
      track('referral_code_copied');
    }
  };

  const onShare = async () => {
    if (!link) return;
    track('referral_share_clicked');
    const result = await sharePost({
      title: 'Vem pro Maestro Pet 🐾',
      message:
        'Te dou 7 dias de Pet Pro grátis! Crie sua conta pelo meu convite e cadastre seu pet:',
      url: link,
    });
    if (result === 'copied') toast.success('Link copiado!', 'Cole onde quiser convidar.');
  };

  return (
    <View
      style={{
        backgroundColor: '#ECFDF5',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        padding: 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>🎁</Text>
        <Text
          style={{
            fontFamily: FONTS.bodyBold,
            fontSize: 11,
            letterSpacing: 1.2,
            color: '#047857',
            textTransform: 'uppercase',
          }}
        >
          Convide amigos
        </Text>
      </View>

      <Text style={{ fontFamily: FONTS.display, fontSize: 19, color: '#064E3B' }}>
        Ganhe Pet Pro grátis 🚀
      </Text>
      <Text style={{ fontFamily: FONTS.body, fontSize: 13, lineHeight: 19, color: '#065F46' }}>
        Você e quem você convidar ganham{' '}
        <Text style={{ fontFamily: FONTS.bodyBold }}>7 dias de Pet Pro</Text> quando a pessoa cadastrar
        o 1º pet.
      </Text>

      {/* Código */}
      {code ? (
        <Pressable
          onPress={onCopyCode}
          accessibilityRole="button"
          accessibilityLabel="Copiar código de convite"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#A7F3D0',
            borderStyle: 'dashed',
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Ionicons name="gift-outline" size={16} color="#047857" />
          <Text style={{ flex: 1, fontFamily: FONTS.bodyBold, fontSize: 16, color: '#064E3B', letterSpacing: 2 }}>
            {code}
          </Text>
          <Ionicons name="copy-outline" size={16} color="#059669" />
        </Pressable>
      ) : null}

      {/* Placar */}
      {stats && stats.invited > 0 ? (
        <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: '#047857' }}>
          👥 {stats.invited} {stats.invited === 1 ? 'convidado' : 'convidados'}
          {stats.converted > 0 ? ` · ⭐ ${stats.converted} virou Pro` : ''}
        </Text>
      ) : null}

      {/* Compartilhar */}
      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel="Compartilhar convite"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#059669',
          paddingVertical: 12,
          borderRadius: 12,
          opacity: pressed ? 0.9 : 1,
          marginTop: 2,
        })}
      >
        <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
          Compartilhar convite
        </Text>
      </Pressable>
    </View>
  );
}
