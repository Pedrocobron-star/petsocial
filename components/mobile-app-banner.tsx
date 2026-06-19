import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONTS } from '@/lib/fonts';
import { track } from '@/lib/analytics';

/**
 * Banner sticky no topo que oferece instalar o Maestro Pet como PWA.
 *
 * Mostra em QUALQUER celular (web), a não ser que:
 *  - já esteja instalado (standalone), ou
 *  - o user tenha dispensado recentemente.
 *
 * Modo:
 *  - 'native'  → navegador disparou `beforeinstallprompt` (Android Chrome/Edge/Brave…):
 *                botão "Instalar" abre o prompt nativo (1 toque).
 *  - 'android' → mobile sem a API: botão "Como instalar" → passo a passo do menu.
 *  - 'ios'     → iPhone: botão "Como instalar" → passo a passo do Safari.
 *
 * Antes dependia 100% do `beforeinstallprompt` (caprichoso) — agora há fallback
 * por timer (2,5s) que mostra instruções manuais se o evento não vier.
 */

const DISMISS_KEY = 'pet-social.install-banner-dismissed-until.v2';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'native' | 'android' | 'ios';

export function MobileAppBanner() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<Mode>('android');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showHint, setShowHint] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Já está em standalone (app instalado) → não mostra
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;
    if ((window.navigator as { standalone?: boolean }).standalone) return;

    // Dispensado recentemente?
    try {
      const until = window.localStorage?.getItem(DISMISS_KEY);
      if (until && Number(until) > Date.now()) return;
    } catch {
      // localStorage indisponível (modo privado) — segue tentando mostrar
    }

    // A instalação nativa (beforeinstallprompt) vale pra desktop e mobile.
    // Só o fallback de instruções manuais é exclusivo do mobile.
    const ua = window.navigator.userAgent.toLowerCase();
    const isMobile = /mobi|android|iphone|ipad|ipod/i.test(ua) || window.innerWidth < 768;
    const isIos = /iphone|ipad|ipod/i.test(ua);

    const win = window as typeof window & { __deferredInstallPrompt?: BeforeInstallPromptEvent };

    const goNative = (e: BeforeInstallPromptEvent) => {
      setDeferredPrompt(e);
      setMode('native');
      setVisible(true);
      shownRef.current = true;
      track('mobile_banner_shown', { mode: 'native' });
    };

    // 1) Evento JÁ capturado cedo pelo script do +html.tsx → instalação nativa na hora
    if (win.__deferredInstallPrompt) {
      goNative(win.__deferredInstallPrompt);
    }

    // 2) Capturado depois (script do head dispara 'pwa-installable')
    const onInstallable = () => {
      if (win.__deferredInstallPrompt) goNative(win.__deferredInstallPrompt);
    };
    window.addEventListener('pwa-installable', onInstallable);

    // 3) Listener direto (fallback caso o script do head não exista, ex: dev)
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      goNative(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // 4) Fallback manual: SÓ no mobile. Depois de 2,5s, se o nativo não veio,
    // mostra o passo a passo. No desktop o Chrome já mostra o ícone de instalar
    // na barra de endereço quando instalável, então não forçamos instruções.
    let tid: ReturnType<typeof setTimeout> | undefined;
    if (isMobile) {
      tid = setTimeout(() => {
        if (shownRef.current) return;
        setMode(isIos ? 'ios' : 'android');
        setVisible(true);
        shownRef.current = true;
        track('mobile_banner_shown', { mode: isIos ? 'ios' : 'android' });
      }, 2500);
    }

    return () => {
      if (tid) clearTimeout(tid);
      window.removeEventListener('pwa-installable', onInstallable);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowHint(false);
    setDeferredPrompt(null);
    try {
      const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage?.setItem(DISMISS_KEY, String(until));
    } catch {
      // ignora
    }
    track('mobile_banner_dismissed');
  };

  const handleInstall = async () => {
    // Instalação nativa disponível → dispara o prompt do navegador
    if (mode === 'native' && deferredPrompt) {
      track('mobile_banner_install_clicked');
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        track('mobile_banner_install_result', { outcome: choice.outcome });
        if (choice.outcome === 'accepted') dismiss();
      } catch {
        setShowHint(true);
      }
      return;
    }
    // Sem API → abre instruções manuais
    setShowHint(true);
    track('mobile_banner_hint_opened', { mode });
  };

  if (Platform.OS !== 'web') return null;
  if (!visible) return null;

  const ctaLabel = mode === 'native' ? 'Instalar' : 'Como instalar';

  return (
    <>
      <View
        style={{
          position: 'absolute',
          bottom: 84 + insets.bottom,
          left: 12,
          right: 12,
          zIndex: 9999,
          backgroundColor: '#F97316',
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 4,
          }}
        >
          <Text style={{ fontSize: 22 }}>🐾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: FONTS.bodyBold,
              fontSize: 13,
              color: '#FFFFFF',
              lineHeight: 17,
            }}
          >
            Instale o Maestro Pet
          </Text>
          <Text
            style={{
              fontFamily: FONTS.body,
              fontSize: 11,
              color: '#FFFFFF',
              opacity: 0.9,
              lineHeight: 15,
              marginTop: 1,
            }}
          >
            Acesso rápido na tela inicial — sem app store
          </Text>
        </View>
        <Pressable
          onPress={handleInstall}
          accessibilityLabel="Instalar Maestro Pet na tela inicial"
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#F97316' }}>
            {ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          onPress={dismiss}
          accessibilityLabel="Dispensar banner"
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Modal de instruções manuais (iOS ou Android) */}
      <Modal
        visible={showHint}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHint(false)}
      >
        <Pressable
          onPress={() => setShowHint(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(26, 20, 16, 0.6)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 20,
              padding: 24,
              gap: 16,
              maxWidth: 340,
              alignSelf: 'center',
              width: '100%',
            }}
          >
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  backgroundColor: '#F97316',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 36 }}>🐾</Text>
              </View>
              <Text style={{ fontFamily: FONTS.display, fontSize: 18, color: '#1A1410' }}>
                Adicionar à tela inicial
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {mode === 'ios' ? (
                <>
                  <Step num={1} text="Toque no botão Compartilhar do Safari (quadrado com seta ↑)" icon="share-outline" />
                  <Step num={2} text="Role e escolha 'Adicionar à Tela de Início'" icon="add-circle-outline" />
                  <Step num={3} text="Toque em 'Adicionar' e pronto: vira ícone na home!" icon="checkmark-circle" />
                </>
              ) : (
                <>
                  <Step num={1} text="Toque no menu do navegador (os 3 pontinhos ⋮, no canto)" icon="ellipsis-vertical" />
                  <Step num={2} text="Escolha 'Instalar app' ou 'Adicionar à tela inicial'" icon="add-circle-outline" />
                  <Step num={3} text="Confirme e pronto: vira ícone na sua tela!" icon="checkmark-circle" />
                </>
              )}
            </View>

            <Pressable
              onPress={() => setShowHint(false)}
              accessibilityLabel="Fechar"
              style={{
                backgroundColor: '#F97316',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 4,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: '#FFFFFF' }}>
                Entendi
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Step({
  num,
  text,
  icon,
}: {
  num: number;
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#FFF7ED',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 13, color: '#9A3412' }}>{num}</Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: FONTS.body,
          fontSize: 13,
          color: '#1A1410',
          lineHeight: 18,
        }}
      >
        {text}
      </Text>
      <Ionicons name={icon} size={20} color="#9A3412" />
    </View>
  );
}
