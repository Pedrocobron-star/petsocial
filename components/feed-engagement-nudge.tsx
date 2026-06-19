import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';
import { isPushSupported, pushPermission, subscribeToPush } from '@/lib/web-push';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { useToast } from '@/providers/toast-provider';

const DISMISS_KEY = 'mp.engage-nudge.until';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // 14 dias

/**
 * Card no topo do feed que incentiva os 2 maiores ganchos de retenção:
 *  - Ativar notificações (Web Push — chega no celular mesmo com app fechado).
 *  - Instalar o app (PWA).
 * Só aparece na WEB quando há algo a oferecer (push pendente ou install disponível),
 * e some por 14 dias se o usuário dispensar.
 */
export function FeedEngagementNudge() {
  const { theme } = useTheme();
  const { session } = useSession();
  const toast = useToast();
  const userId = session?.user.id;

  const [needPush, setNeedPush] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
      if (until > Date.now()) return;
    } catch {
      // localStorage indisponível (incógnito): segue mostrando
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    const pushPending = isPushSupported() && pushPermission() === 'default';
    const installReady =
      !standalone && !!(window as unknown as { __deferredInstallPrompt?: unknown }).__deferredInstallPrompt;

    setNeedPush(pushPending);
    setCanInstall(installReady);
    if (pushPending || installReady) setVisible(true);

    // beforeinstallprompt pode disparar depois do mount
    const onBip = () => {
      if (!standalone) {
        setCanInstall(true);
        setVisible(true);
      }
    };
    window.addEventListener('beforeinstallprompt', onBip as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', onBip as EventListener);
  }, []);

  if (!visible || (!needPush && !canInstall)) return null;

  const snooze = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      // ignora
    }
    setVisible(false);
  };

  const enablePush = async () => {
    if (!userId) return;
    setBusy(true);
    const r = await subscribeToPush(userId);
    setBusy(false);
    if (r === 'subscribed') {
      toast.success('Notificações ativadas 🔔', 'Você será avisado mesmo com o app fechado.');
      setNeedPush(false);
      if (!canInstall) snooze();
    } else if (r === 'denied') {
      toast.error('Permissão negada', 'Você pode reativar nas configurações do navegador.');
      setNeedPush(false);
      if (!canInstall) setVisible(false);
    } else {
      toast.error('Não rolou agora', 'Tenta de novo daqui a pouco.');
    }
  };

  const install = async () => {
    const dp = (window as unknown as { __deferredInstallPrompt?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } })
      .__deferredInstallPrompt;
    if (!dp) return;
    try {
      dp.prompt();
      const choice = await dp.userChoice;
      (window as unknown as { __deferredInstallPrompt?: unknown }).__deferredInstallPrompt = undefined;
      setCanInstall(false);
      if (choice.outcome === 'accepted') {
        toast.success('Instalando o app 📲', 'O Maestro Pet vai aparecer na sua tela inicial.');
        if (!needPush) setVisible(false);
      }
    } catch {
      // ignora
    }
  };

  return (
    <View
      style={{
        marginHorizontal: 12,
        marginTop: 10,
        marginBottom: 2,
        backgroundColor: theme.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.brandLight,
        padding: 14,
        shadowColor: '#F97316',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: theme.brandLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: theme.text }}>
            {needPush ? 'Não perca nada do seu pet' : 'Tenha o Maestro Pet sempre à mão'}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: theme.textDim, marginTop: 2, lineHeight: 17 }}>
            {needPush
              ? 'Ative as notificações pra receber lembretes de vacina, novidades e interações, mesmo com o app fechado.'
              : 'Instale o app na tela inicial pra abrir num toque, como um app de verdade.'}
          </Text>
        </View>
        <Pressable onPress={snooze} hitSlop={8} accessibilityLabel="Dispensar">
          <Ionicons name="close" size={18} color={theme.textDim} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {needPush ? (
          <Pressable
            onPress={enablePush}
            disabled={busy}
            style={{
              flex: 1,
              backgroundColor: theme.brand,
              borderRadius: 12,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              opacity: busy ? 0.6 : 1,
            }}
          >
            <Ionicons name="notifications" size={15} color="#fff" />
            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#fff' }}>
              {busy ? 'Ativando…' : 'Ativar notificações'}
            </Text>
          </Pressable>
        ) : null}
        {canInstall ? (
          <Pressable
            onPress={install}
            style={{
              flex: needPush ? 0 : 1,
              backgroundColor: needPush ? theme.borderLight : theme.brand,
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Ionicons name="download-outline" size={15} color={needPush ? theme.text : '#fff'} />
            <Text
              style={{
                fontFamily: FONTS.bodyBold,
                fontSize: 13,
                color: needPush ? theme.text : '#fff',
              }}
            >
              {needPush ? 'Instalar' : 'Instalar app'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
