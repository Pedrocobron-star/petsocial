import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FONTS } from '@/lib/fonts';
import { MOZART } from '@/lib/mozart';
import {
  isPushSubscribed,
  isPushSupported,
  pushPermission,
  refreshPushSubscription,
  subscribeToPush,
} from '@/lib/web-push';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

/**
 * Pede permissão de notificações no primeiro acesso (web/PWA).
 *
 * Mostra um modal do Mozart pedindo pra ativar enquanto a permissão estiver
 * em 'default' (ainda não decidida). Se o usuário tocar "Agora não", adia só
 * pela sessão — então **reaparece a cada vez que o app abre, até ele aceitar**.
 * Depois de granted/denied, some pra sempre. No native, no-op.
 */

const SNOOZE_KEY = 'petsocial.notif-prompt.snoozed-session';

export function NotificationPrompt() {
  const { session } = useSession();
  const { theme } = useTheme();
  const toast = useToast();
  const userId = session?.user.id;
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-sincroniza a inscrição no launch quando a permissão já foi concedida —
  // conserta o device que reinstalou/atualizou o PWA e ficou com endpoint morto
  // (o prompt abaixo só roda em permission==='default', então nunca repararia).
  useEffect(() => {
    if (Platform.OS !== 'web' || !userId) return;
    if (pushPermission() !== 'granted') return;
    void refreshPushSubscription(userId);
  }, [userId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !userId) return;
    if (!isPushSupported() || pushPermission() !== 'default') return;
    let snoozed = false;
    try {
      snoozed = window.sessionStorage?.getItem(SNOOZE_KEY) === '1';
    } catch {
      // sessionStorage indisponível — segue mostrando
    }
    if (snoozed) return;

    let cancelled = false;
    let tid: ReturnType<typeof setTimeout> | undefined;
    isPushSubscribed().then((sub) => {
      if (cancelled || sub) return;
      // pequeno respiro pra não brigar com o carregamento inicial
      tid = setTimeout(() => {
        if (!cancelled) setVisible(true);
      }, 1400);
    });
    return () => {
      cancelled = true;
      if (tid) clearTimeout(tid);
    };
  }, [userId]);

  const enable = async () => {
    if (!userId) return;
    setBusy(true);
    const res = await subscribeToPush(userId);
    setBusy(false);
    setVisible(false);
    if (res === 'subscribed') {
      toast.success('Notificações ativadas! 🔔', 'Você vai receber a foto do dia, lembretes e novidades.');
    } else if (res === 'denied') {
      toast.info('Tudo bem', 'Dá pra ativar depois em Ajustes › Notificações.');
    } else if (res === 'error') {
      toast.error('Não consegui ativar', 'Tenta de novo em Ajustes › Notificações.');
    }
  };

  const later = () => {
    try {
      window.sessionStorage?.setItem(SNOOZE_KEY, '1');
    } catch {
      // ignora
    }
    setVisible(false);
  };

  if (Platform.OS !== 'web') return null;
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={later}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 22,
            padding: 24,
            gap: 14,
            maxWidth: 360,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Image source={{ uri: MOZART.megafone }} style={{ width: 78, height: 78 }} contentFit="contain" />
            <Text style={{ fontFamily: FONTS.display, fontSize: 20, color: theme.text, textAlign: 'center' }}>
              Posso te avisar das novidades?
            </Text>
            <Text style={{ fontFamily: FONTS.body, fontSize: 13.5, color: theme.textDim, textAlign: 'center', lineHeight: 20 }}>
              Ative as notificações pra não perder a foto do dia, lembrete de vacina, mensagens e o desafio dos jogos. 🐾
            </Text>
          </View>
          <Button title="🔔 Ativar notificações" onPress={enable} loading={busy} disabled={busy} fullWidth />
          <Pressable onPress={later} disabled={busy} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: theme.textDim }}>Agora não</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
