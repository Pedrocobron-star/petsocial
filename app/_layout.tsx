import '../global.css';

import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  ReduceMotion,
  ReducedMotionConfig,
} from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PetAnimationsStyle } from '@/components/avatar/pet-animations-style';
import { DocumentTitleManager } from '@/components/document-title-manager';
import { MobileAppBanner } from '@/components/mobile-app-banner';
import { I18nProvider } from '@/lib/i18n';
import { initSentry } from '@/lib/sentry';
import { MotionProvider } from '@/providers/motion-provider';
import { QueryProvider } from '@/providers/query-provider';
import { SessionProvider } from '@/providers/session-provider';
import { SessionTrackerProvider } from '@/providers/session-tracker-provider';
import { SubscriptionProvider } from '@/providers/subscription-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';

// Init Sentry o mais cedo possível, antes de qualquer render. No-op se sem DSN
// configurada ou em dev.
initSentry();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Sobrescreve global o respeito ao "Reduce Motion" do sistema.
          As animações do Pet Social são suaves e fundamentais pra UX —
          em vez de cada componente declarar ReduceMotion.Never, configuramos
          uma vez aqui. Usuários com sensibilidade extrema podem desativar
          via setting nosso próprio no futuro. */}
      <ReducedMotionConfig mode={ReduceMotion.Never} />
      {/* Injeta os keyframes CSS no DOM (web only) — bypassa Reanimated 4
          que pausa animações em loop quando o sistema tem reduce motion. */}
      <PetAnimationsStyle />
      <SafeAreaProvider>
        <I18nProvider>
          <ThemeProvider>
            <MotionProvider>
              <QueryProvider>
                <SessionProvider>
                  <SessionTrackerProvider>
                  <SubscriptionProvider>
                    <ToastProvider>
                      {/* Atualiza document.title conforme a rota (web only) */}
                      <DocumentTitleManager />
                      {/* Banner pra instalar como PWA quando user em mobile */}
                      <MobileAppBanner />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="welcome" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(app)" />
                        <Stack.Screen name="id/[token]" />
                        <Stack.Screen name="endorse/[token]" />
                      </Stack>
                      <StatusBar style="auto" />
                    </ToastProvider>
                  </SubscriptionProvider>
                  </SessionTrackerProvider>
                </SessionProvider>
              </QueryProvider>
            </MotionProvider>
          </ThemeProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
