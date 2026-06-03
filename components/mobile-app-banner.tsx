import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { FONTS } from '@/lib/fonts';
import { track } from '@/lib/analytics';

/**
 * Banner sticky no topo que oferece instalar o Pet Social como PWA.
 *
 * Mostra SÓ quando:
 *  - Plataforma é web
 *  - User-Agent é mobile (iOS/Android)
 *  - Browser NÃO está em standalone (já instalado)
 *  - User não fez dismiss antes
 *  - (Chrome/Edge) tem evento beforeinstallprompt disponível, OU
 *  - (iOS Safari) detectamos iOS+Safari e mostramos hint manual
 *
 * Dismiss persiste em localStorage por 14 dias (depois reaparece —
 * usuário pode ter mudado de ideia).
 *
 * Visual: banner laranja no topo full-width, ícone do pet, texto curto,
 * CTA "Instalar". Botão X pra fechar.
 */

const DISMISS_KEY = 'pet-social.mobile-banner-dismissed-until';
const DISMISS_DAYS = 14;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface BannerState {
  visible: boolean;
  /** 'native' = Android/Chrome com beforeinstallprompt; 'ios' = iOS Safari hint manual. */
  mode: 'native' | 'ios' | null;
}

export function MobileAppBanner() {
  const [state, setState] = useState<BannerState>({ visible: false, mode: null });
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Já está em standalone (app instalado) → não mostra
    if (window.matchMedia?.('(display-mode: standalone)').matches) return;
    if ((window.navigator as { standalone?: boolean }).standalone) return;

    // Dismissed recentemente?
    try {
      const dismissedUntil = window.localStorage?.getItem(DISMISS_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) return;
    } catch {
      // localStorage indisponível (modo privado) — segue tentando mostrar
    }

    // Detecta mobile via UA + viewport
    const ua = window.navigator.userAgent.toLowerCase();
    const isMobile = /mobi|android|iphone|ipad|ipod/i.test(ua) || window.innerWidth < 768;
    if (!isMobile) return;

    // Caso 1: Chrome/Edge Android — escuta beforeinstallprompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState({ visible: true, mode: 'native' });
      track('mobile_banner_shown', { mode: 'native' });
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Caso 2: iOS Safari — sem API, mostra hint manual após 2s
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|chrome|edg|firefox|opera/i.test(ua);
    if (isIos && isSafari) {
      const tid = setTimeout(() => {
        setState({ visible: true, mode: 'ios' });
        track('mobile_banner_shown', { mode: 'ios' });
      }, 1500);
      return () => {
        clearTimeout(tid);
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    setState({ visible: false, mode: null });
    setShowIosHint(false);
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
    if (state.mode === 'ios') {
      setShowIosHint(true);
      track('mobile_banner_ios_hint_opened');
      return;
    }
    if (!deferredPrompt) return;
    track('mobile_banner_install_clicked');
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    track('mobile_banner_install_result', { outcome: choice.outcome });
    if (choice.outcome === 'accepted') {
      dismiss();
    }
  };

  if (Platform.OS !== 'web') return null;
  if (!state.visible) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(280)}
        exiting={FadeOutUp.duration(180)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          backgroundColor: '#F97316',
          paddingTop: 14,
          paddingBottom: 14,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
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
            Instale o Pet Social
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
          accessibilityLabel="Instalar Pet Social na tela inicial"
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
          }}
        >
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 12, color: '#F97316' }}>
            {state.mode === 'ios' ? 'Como' : 'Instalar'}
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
      </Animated.View>

      {/* iOS hint modal */}
      <Modal
        visible={showIosHint}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIosHint(false)}
      >
        <Pressable
          onPress={() => setShowIosHint(false)}
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
                Adicionar à Tela de Início
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <Step
                num={1}
                text="Toque no botão Compartilhar do Safari"
                icon="share-outline"
              />
              <Step
                num={2}
                text="Role e escolha 'Adicionar à Tela de Início'"
                icon="add-circle-outline"
              />
              <Step
                num={3}
                text="Toque em 'Adicionar' — pronto, vira ícone na home!"
                icon="checkmark-circle"
              />
            </View>

            <Pressable
              onPress={() => setShowIosHint(false)}
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
