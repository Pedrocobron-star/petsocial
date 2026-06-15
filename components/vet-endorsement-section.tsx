import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Platform, Text, View } from 'react-native';

import { PressScale } from '@/components/ui/press-scale';
import {
  createEndorsementRequest,
  fetchPetEndorsements,
  formatEndorsementBadge,
  revokeEndorsement,
  type VetEndorsement,
} from '@/lib/endorsements';
import { FONTS } from '@/lib/fonts';
import { copyToClipboard, sharePost, shareToWhatsApp } from '@/lib/share';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

interface Props {
  petId: string;
  petName: string;
}

function endorseUrl(token: string): string {
  const base =
    Platform.OS === 'web'
      ? globalThis.location?.origin ?? 'https://maestropet.com'
      : 'https://maestropet.com';
  return `${base}/endorse/${token}`;
}

/**
 * Seção de endosso veterinário na carteirinha.
 *
 * - Se há endosso ASSINADO → mostra o selo verde "✓ Endossado por Dra. X · CRMV".
 * - Se há pedido PENDENTE → mostra "aguardando" + reenviar/copiar link.
 * - Sempre permite gerar um novo pedido e mandar pro vet.
 *
 * Framing honesto: é confirmação profissional (CRMV + nome), não assinatura
 * ICP-Brasil.
 */
export function VetEndorsementSection({ petId, petName }: Props) {
  const { theme } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['pet-endorsements', petId],
    queryFn: () => fetchPetEndorsements(petId),
    enabled: !!petId,
  });

  const endorsements = query.data ?? [];
  const signed = endorsements.find((e) => e.status === 'signed') ?? null;
  const pending = endorsements.find((e) => e.status === 'pending') ?? null;

  const createMutation = useMutation({
    mutationFn: () => createEndorsementRequest(petId, 'carteirinha'),
    onSuccess: async (token) => {
      await qc.invalidateQueries({ queryKey: ['pet-endorsements', petId] });
      const url = endorseUrl(token);
      const msg = `🐾 Olá! Pode confirmar a carteirinha de saúde do(a) ${petName} no Maestro Pet? É rápido, sem cadastro:\n\n${url}`;
      const ok = await shareToWhatsApp(msg);
      if (!ok) {
        await sharePost({
          title: `Endosso · ${petName}`,
          message: msg,
          url,
        });
      }
    },
    onError: () => toast.error('Erro', 'Não foi possível gerar o pedido.'),
  });

  const resendPending = async () => {
    if (!pending) return;
    const url = endorseUrl(pending.token);
    const msg = `🐾 Olá! Pode confirmar a carteirinha de saúde do(a) ${petName} no Maestro Pet? É rápido, sem cadastro:\n\n${url}`;
    const ok = await shareToWhatsApp(msg);
    if (!ok) await sharePost({ title: `Endosso · ${petName}`, message: msg, url });
  };

  const copyPending = async () => {
    if (!pending) return;
    const ok = await copyToClipboard(endorseUrl(pending.token));
    if (ok) toast.success('Link copiado!', 'Mande pro seu veterinário');
  };

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeEndorsement(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['pet-endorsements', petId] });
      toast.success('Endosso removido');
    },
  });

  // ---------------------------------------------------------------- SIGNED
  if (signed) {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: '#F0FDF4',
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: '#86EFAC',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#16A34A',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#166534' }}>
              Endossado por veterinário
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: '#15803D', marginTop: 1 }}>
              {formatEndorsementBadge(signed)}
            </Text>
            {signed.signed_at ? (
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#16A34A', marginTop: 1 }}>
                {format(parseISO(signed.signed_at), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </Text>
            ) : null}
          </View>
        </View>
        {signed.vet_notes ? (
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 12,
              color: '#166534',
              fontStyle: 'italic',
              backgroundColor: '#DCFCE7',
              borderRadius: 8,
              padding: 8,
            }}
          >
            “{signed.vet_notes}”
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PressScale
            onPress={() => createMutation.mutate()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingVertical: 6,
              paddingHorizontal: 4,
            }}
          >
            <Ionicons name="refresh" size={13} color="#15803D" />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#15803D' }}>
              Pedir novo endosso
            </Text>
          </PressScale>
          <PressScale
            onPress={() => revokeMutation.mutate(signed.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 4 }}
          >
            <Ionicons name="trash-outline" size={13} color="#9CA3AF" />
            <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 12, color: '#9CA3AF' }}>
              Remover
            </Text>
          </PressScale>
        </View>
      </View>
    );
  }

  // --------------------------------------------------------------- PENDING
  if (pending) {
    return (
      <View
        style={{
          marginTop: 12,
          backgroundColor: '#FFFBEB',
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: '#FDE68A',
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="hourglass-outline" size={20} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#92400E' }}>
              Aguardando o veterinário
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: '#B45309', marginTop: 1, lineHeight: 16 }}>
              Você gerou um link de endosso. Mande pro seu vet — ele abre, confere e confirma sem precisar de cadastro.
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <PressScale
            onPress={resendPending}
            style={{
              flex: 1,
              backgroundColor: '#16A34A',
              paddingVertical: 11,
              borderRadius: 11,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="logo-whatsapp" size={16} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>Reenviar</Text>
          </PressScale>
          <PressScale
            onPress={copyPending}
            style={{
              backgroundColor: '#FEF3C7',
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 11,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="copy-outline" size={15} color="#92400E" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#92400E' }}>Copiar</Text>
          </PressScale>
        </View>
        <PressScale
          onPress={() => revokeMutation.mutate(pending.id)}
          style={{ alignItems: 'center', paddingVertical: 4 }}
        >
          <Text style={{ fontFamily: FONTS.bodyMedium, fontSize: 11, color: '#9CA3AF' }}>
            Cancelar pedido
          </Text>
        </PressScale>
      </View>
    );
  }

  // ------------------------------------------------------------------ EMPTY
  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: theme.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.borderLight,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#DCFCE7',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="ribbon-outline" size={20} color="#16A34A" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.text }}>
            Endosso do veterinário
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 1, lineHeight: 16 }}>
            Seu vet confirma os dados e a carteirinha ganha um selo de confiança com o CRMV dele.
          </Text>
        </View>
      </View>
      <PressScale
        onPress={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        style={{
          backgroundColor: '#16A34A',
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          opacity: createMutation.isPending ? 0.6 : 1,
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={17} color="#fff" />
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#fff' }}>
          {createMutation.isPending ? 'Gerando link...' : 'Pedir endosso do veterinário'}
        </Text>
      </PressScale>
    </View>
  );
}
