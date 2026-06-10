import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { FONTS } from '@/lib/fonts';

/**
 * Banner discreto que aparece em web quando o browser dispara `beforeinstallprompt`.
 *
 * - Só mostra em web (Chrome/Edge/Samsung Internet — Safari não suporta a API)
 * - Salva dismiss em localStorage pra não voltar a perder espaço
 * - Click no botão dispara o prompt nativo
 *
 * iOS Safari: a API não existe, mas adicionamos um hint "Adicionar à Tela de Início"
 * se o user estiver em iOS Safari E não estiver em standalone mode.
 */

const DISMISS_KEY = 'pet-social.pwa-install.dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Check localStorage dismissal
    try {
      if (window.localStorage?.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
        return;
      }
    } catch {
      // ignora SSR / private mode
    }

    // Standalone check (já instalado)
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;
    if ((window.navigator as { standalone?: boolean }).standalone) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari fallback (sem API)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      dismiss();
    }
  };

  const dismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosHint(false);
    try {
      window.localStorage?.setItem(DISMISS_KEY, '1');
    } catch {
      // ignora
    }
  };

  if (Platform.OS !== 'web') return null;
  if (dismissed) return null;
  if (!deferredPrompt && !showIosHint) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#FED7AA',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: '#F97316',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 20 }}>🐾</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1410' }}>
          Instalar Maestro Pet
        </Text>
        <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: '#737373', marginTop: 2 }}>
          {deferredPrompt
            ? 'Adicione na tela inicial pra abrir mais rápido'
            : 'Toque em Compartilhar → "Adicionar à Tela de Início"'}
        </Text>
      </View>
      {deferredPrompt ? (
        <Pressable
          onPress={handleInstall}
          style={{
            backgroundColor: '#F97316',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#FFFFFF' }}>
            Instalar
          </Text>
        </Pressable>
      ) : null}
      <Pressable onPress={dismiss} hitSlop={8} style={{ padding: 4 }}>
        <Ionicons name="close" size={18} color="#737373" />
      </Pressable>
    </View>
  );
}
