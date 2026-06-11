import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * "Voltar = tela inicial" no PWA web.
 *
 * Problema: no app instalado, voltar (gesto/botão) de um app do springboard cai
 * no FEED em vez da tela inicial (/phone). A tela base do app é o springboard;
 * voltar de qualquer função deve cair nele.
 *
 * Detecção por MUDANÇA de rota (não só popstate — o expo-router pode navegar
 * pro feed internamente, sem popstate). Se a rota VIROU o feed ("/") vindo de
 * uma tela que NÃO é da família do feed (as próprias abas + post/hashtag/perfil),
 * foi o "voltar" caindo no feed por engano → manda pra tela inicial. No native,
 * no-op.
 */

const FEED_PATH = '/';

// Telas que convivem com o feed: as ABAS (feed/explorar/criar/encontros/perfil)
// e o que se abre DE DENTRO do feed (post, hashtag, perfil de pet, chat...).
// Voltar dessas pro feed é navegação legítima — NÃO redireciona.
const FEED_FAMILY: RegExp[] = [
  /^\/explore$/,
  /^\/create$/,
  /^\/profile$/,
  /^\/post\//,
  /^\/tag\//,
  /^\/pet\/[^/]+$/, // perfil do pet (sem sub-rota tipo /pet/ID/health)
  /^\/saved$/,
  /^\/messages$/,
  /^\/chat\//,
];

function isFeedFamily(path: string): boolean {
  return FEED_FAMILY.some((re) => re.test(path));
}

export function BackHomeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const prevRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = pathname;
    if (Platform.OS !== 'web') return;
    // Caiu no feed vindo de uma tela que não é o springboard, não é o próprio
    // feed e não é da família do feed → foi um "voltar" caindo no feed por
    // engano. Redireciona pra tela inicial.
    if (
      pathname === FEED_PATH &&
      prev != null &&
      prev !== FEED_PATH &&
      prev !== '/phone' &&
      !isFeedFamily(prev)
    ) {
      router.replace('/(app)/phone' as never);
    }
  }, [pathname, router]);

  return null;
}
