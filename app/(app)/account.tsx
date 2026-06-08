import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { InviteFriendsCard } from '@/components/invite-friends-card';
import { PremiumBadge } from '@/components/premium-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FONTS } from '@/lib/fonts';
import { cancelSubscription, qk } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import { useSubscription } from '@/providers/subscription-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const DELETE_CONFIRM_WORD = 'DELETAR';

export default function AccountScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { session, signOut } = useSession();
  const { subscription, isPro, isLoading } = useSubscription();
  const userId = session?.user.id;

  const [showDelete, setShowDelete] = useState(false);

  const cancelMut = useMutation({
    mutationFn: () => cancelSubscription(userId!),
    onSuccess: () => {
      toast.success('Cancelamento agendado', 'Você continua Pro até o fim do período');
      if (userId) qc.invalidateQueries({ queryKey: qk.subscription(userId) });
    },
    onError: () => toast.error('Erro ao cancelar', 'Tenta de novo em uns minutos'),
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('export_my_data');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `petsocial-meus-dados-${stamp}.json`;
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Dados exportados!', `Arquivo ${filename} baixado.`);
      } else {
        toast.info('Disponível na web', 'Exportação em arquivo só funciona no navegador por enquanto.');
      }
    },
    onError: (e) =>
      toast.error('Erro ao exportar', e instanceof Error ? e.message : 'Tente novamente.'),
  });

  const onCancel = () => {
    if (!subscription?.current_period_end) return;
    Alert.alert(
      'Cancelar assinatura?',
      `Você continua Pro até ${format(parseISO(subscription.current_period_end), "d 'de' MMM", { locale: ptBR })}. Depois disso volta pro plano gratuito (seus dados ficam intactos).`,
      [
        { text: 'Manter Pro', style: 'cancel' },
        { text: 'Cancelar', style: 'destructive', onPress: () => cancelMut.mutate() },
      ],
    );
  };

  if (isLoading) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Screen options={{ title: 'Minha conta', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View
          style={{
            backgroundColor: isPro ? '#1A1410' : theme.surface,
            borderRadius: 16,
            padding: 18,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 11,
                letterSpacing: 1.2,
                color: isPro ? '#F59E0B' : theme.textDim,
                textTransform: 'uppercase',
              }}
            >
              Plano atual
            </Text>
            {isPro ? <PremiumBadge size={12} /> : null}
          </View>
          <Text
            style={{
              fontFamily: FONTS.display,
              fontSize: 28,
              color: isPro ? '#fff' : theme.text,
            }}
          >
            {isPro ? 'Pet Pro' : 'Gratuito'}
          </Text>
          {isPro && subscription ? (
            <>
              <Text
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  color: '#E5E5E5',
                }}
              >
                Plano {subscription.plan === 'yearly' ? 'anual' : 'mensal'} •{' '}
                {subscription.status === 'active' ? '✅ ativo' : `⏸ ${subscription.status}`}
              </Text>
              {subscription.current_period_end ? (
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3' }}>
                  {subscription.cancel_at_period_end
                    ? `Termina em ${format(parseISO(subscription.current_period_end), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`
                    : `Renova em ${format(parseISO(subscription.current_period_end), "d 'de' MMM 'de' yyyy", { locale: ptBR })}`}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim }}>
              Limitado a 3 pets, 1 post/dia e carteirinha com marca d&apos;água
            </Text>
          )}
        </View>

        <InviteFriendsCard />

        {!isPro ? (
          <Button
            title="⭐ Conhecer Pet Pro"
            onPress={() => router.push('/(app)/pro' as never)}
            fullWidth
          />
        ) : (
          <>
            {!subscription?.cancel_at_period_end ? (
              <Pressable
                onPress={onCancel}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: 12,
                  padding: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#DC2626' }}>
                  Cancelar assinatura
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  backgroundColor: '#FEF3C7',
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <Ionicons name="information-circle" size={20} color="#92400E" />
                <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: '#78350F' }}>
                  Cancelamento agendado. Você continua Pro até o fim do período.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Conta
          </Text>
          <View style={{ backgroundColor: theme.surface, borderRadius: 12, padding: 14 }}>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: theme.textDim, marginBottom: 4 }}>
              Email
            </Text>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
              {session?.user.email}
            </Text>
          </View>
        </View>

        {/* Preferências do app */}
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Preferências
          </Text>

          <Link href={'/(app)/notification-settings' as never} asChild>
            <Pressable
              style={{
                backgroundColor: theme.surface,
                borderRadius: 12,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#FED7AA',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="notifications-outline" size={18} color="#9A3412" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  Notificações
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
                  Lembretes de vacinas, parasitas e consultas
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
            </Pressable>
          </Link>

          {session?.user.email === 'pedrocobron@gmail.com' ? (
            <Link href={'/(app)/admin' as never} asChild>
              <Pressable
                style={{
                  backgroundColor: '#1A1410',
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: '#F59E0B',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="shield-checkmark" size={18} color="#1A1410" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
                    Admin Dashboard
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#A3A3A3', marginTop: 2 }}>
                    Stats, users, posts, errors
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#A3A3A3" />
              </Pressable>
            </Link>
          ) : null}

          <Link href={'/(app)/language' as never} asChild>
            <Pressable
              style={{
                backgroundColor: theme.surface,
                borderRadius: 12,
                padding: 14,
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: '#DBEAFE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 16 }}>🌐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  Idioma · Language · Idioma
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
                  Português, English, Español
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
            </Pressable>
          </Link>
        </View>

        {/* LGPD — Privacidade & Dados */}
        <View style={{ marginTop: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 11,
              letterSpacing: 1.2,
              color: theme.brand,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Privacidade & dados (LGPD)
          </Text>

          {/* Exportar dados */}
          <Pressable
            onPress={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: exportMut.isPending ? 0.6 : 1,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#DBEAFE',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="download-outline" size={18} color="#1D4ED8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                {exportMut.isPending ? 'Preparando exportação...' : 'Exportar meus dados'}
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
                Baixa um JSON com perfil, pets, posts, reportes e reviews
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>

          {/* Excluir conta */}
          <Pressable
            onPress={() => setShowDelete(true)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              marginTop: 8,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#DC2626' }}>
                Excluir minha conta
              </Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2 }}>
                Remove permanentemente seus dados pessoais. Sem volta.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
        </View>

        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: theme.textDim,
            textAlign: 'center',
            marginTop: 12,
            lineHeight: 16,
            paddingHorizontal: 8,
          }}
        >
          Os dados são protegidos conforme a LGPD (Lei 13.709/2018).{'\n'}
          Dúvidas: contato@petsocial.app
        </Text>
      </ScrollView>

      <DeleteAccountModal
        visible={showDelete}
        onClose={() => setShowDelete(false)}
        onDeleted={async () => {
          setShowDelete(false);
          try {
            await signOut();
          } catch {
            // se signOut falhar (sessão já invalidada pelo delete), segue pro welcome
          }
          router.replace('/welcome' as never);
        }}
      />
    </View>
  );
}

// ============================================================================
// DeleteAccountModal — confirmação dupla (checkbox + typing "DELETAR")
// ============================================================================

interface DeleteModalProps {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

interface DeleteResult {
  success: boolean;
  pets_deleted?: number;
  posts_deleted?: number;
  lost_reports_deleted?: number;
  place_reviews_deleted?: number;
  note?: string;
}

function DeleteAccountModal({ visible, onClose, onDeleted }: DeleteModalProps) {
  const { theme } = useTheme();
  const toast = useToast();

  const [confirmText, setConfirmText] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reset = () => {
    setConfirmText('');
    setAcknowledged(false);
    setDeleting(false);
  };

  const canDelete = confirmText.trim().toUpperCase() === DELETE_CONFIRM_WORD && acknowledged && !deleting;

  const onConfirm = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      const r = (data || {}) as DeleteResult;
      const parts: string[] = [];
      if (r.pets_deleted) parts.push(`${r.pets_deleted} pet${r.pets_deleted === 1 ? '' : 's'}`);
      if (r.posts_deleted) parts.push(`${r.posts_deleted} post${r.posts_deleted === 1 ? '' : 's'}`);
      if (r.lost_reports_deleted) parts.push(`${r.lost_reports_deleted} reporte${r.lost_reports_deleted === 1 ? '' : 's'}`);
      if (r.place_reviews_deleted) parts.push(`${r.place_reviews_deleted} review${r.place_reviews_deleted === 1 ? '' : 's'}`);
      const summary = parts.length ? `Apagamos ${parts.join(', ')}.` : 'Seus dados foram apagados.';
      toast.success('Conta excluída', summary);
      reset();
      onDeleted();
    } catch (e) {
      setDeleting(false);
      toast.error('Erro ao excluir', e instanceof Error ? e.message : 'Tente novamente.');
    }
  };

  const handleClose = () => {
    if (deleting) return;
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.55)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={() => {
              /* swallow */
            }}
            style={{
              backgroundColor: theme.bg,
              borderRadius: 20,
              padding: 22,
              maxWidth: 480,
              width: '100%',
              alignSelf: 'center',
              gap: 14,
            }}
          >
            {/* Header com ícone de alerta */}
            <View style={{ alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: '#FEE2E2',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="warning" size={28} color="#DC2626" />
              </View>
              <Text
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 22,
                  color: theme.text,
                  textAlign: 'center',
                }}
              >
                Excluir conta permanentemente
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
                Essa ação apaga todos os seus dados pessoais: perfil, pets, posts,
                fotos, reportes, reviews e conversas. Não tem como voltar atrás.
              </Text>
            </View>

            {/* O que vai ser apagado */}
            <View
              style={{
                backgroundColor: theme.surface,
                borderRadius: 12,
                padding: 12,
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: theme.text }}>
                O que vai ser removido:
              </Text>
              {[
                'Seu perfil e foto',
                'Todos os pets cadastrados',
                'Posts, comentários e curtidas',
                'Reportes de pets perdidos',
                'Reviews de lugares',
                'Conversas e mensagens',
                'Assinatura Pet Pro (se houver)',
              ].map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="close-circle" size={14} color="#DC2626" />
                  <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 12, color: theme.textDim }}>
                    {item}
                  </Text>
                </View>
              ))}
            </View>

            {/* Recomendação export */}
            <View
              style={{
                backgroundColor: '#FEF3C7',
                borderRadius: 10,
                padding: 10,
                flexDirection: 'row',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="bulb-outline" size={16} color="#92400E" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 11, color: '#78350F', lineHeight: 16 }}>
                <Text style={{ fontFamily: FONTS.bodyBold }}>Dica:</Text> antes de excluir, considere
                exportar seus dados. É grátis e leva 1 clique.
              </Text>
            </View>

            {/* Checkbox de reconhecimento */}
            <Pressable
              onPress={() => setAcknowledged((v) => !v)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: acknowledged ? '#DC2626' : theme.borderLight,
                  backgroundColor: acknowledged ? '#DC2626' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {acknowledged ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={{ flex: 1, fontFamily: FONTS.body, fontSize: 13, color: theme.text }}>
                Entendo que essa ação é irreversível.
              </Text>
            </Pressable>

            {/* Confirm typing */}
            <View>
              <Text
                style={{
                  fontFamily: FONTS.bodySemibold,
                  fontSize: 12,
                  color: theme.text,
                  marginBottom: 6,
                }}
              >
                Digite{' '}
                <Text style={{ fontFamily: FONTS.bodyBold, color: '#DC2626' }}>
                  {DELETE_CONFIRM_WORD}
                </Text>{' '}
                pra confirmar:
              </Text>
              <Input
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={DELETE_CONFIRM_WORD}
                editable={!deleting}
              />
            </View>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={handleClose}
                disabled={deleting}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: theme.surface,
                  alignItems: 'center',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                disabled={!canDelete}
                style={{
                  flex: 1.4,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: canDelete ? '#DC2626' : '#FCA5A5',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {deleting ? (
                  <>
                    <Ionicons name="hourglass-outline" size={16} color="#fff" />
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                      Excluindo...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
                      Excluir conta
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
