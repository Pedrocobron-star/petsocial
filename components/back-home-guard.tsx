import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * "Voltar = tela inicial" no PWA web.
 *
 * Problema: no app instalado, o gesto/botão "voltar" usa o histórico do
 * navegador. Por como as rotas resolvem (o feed e o redirect dividem o "/"),
 * voltar de um app do springboard às vezes cai no FEED em vez da tela inicial
 * (/phone). A tela base do app é o springboard — voltar de qualquer função deve
 * cair nele.
 *
 * Este guard escuta o "voltar" (popstate): se ele caiu no feed ("/") MAS você
 * NÃO veio de uma tela que é filha legítima do feed (post, hashtag, perfil de
 * pet), te redireciona pra tela inicial. Assim "voltar de qualquer app = home",
 * sem quebrar a navegação interna do feed. No native, no-op.
 */

const FEED_PATH = '/';

// Telas que são alcançadas DE DENTRO do feed — voltar delas pro feed é correto.
const FEED_CHILDREN: RegExp[] = [
  /^\/post\//, // detalhe de um post
  /^\/tag\//, // feed de hashtag
  /^\/pet\/[^/]+$/, // perfil do pet (só /pet/ID, sem sub-rota tipo /pet/ID/health)
  /^\/explore$/,
  /^\/saved$/,
];

function isFeedChild(path: string): boolean {
  return FEED_CHILDREN.some((re) => re.test(path));
}

export function BackHomeGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const prevRef = useRef(pathname);

  // Mantém o pathname ANTERIOR (a tela que estávamos antes do "voltar").
  useEffect(() => {
    prevRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPop = () => {
      // próximo tick: window.location já reflete o destino do "voltar"
      window.setTimeout(() => {
        const landed = window.location.pathname;
        const cameFrom = prevRef.current;
        if (landed === FEED_PATH && cameFrom !== FEED_PATH && !isFeedChild(cameFrom)) {
          router.replace('/(app)/phone' as never);
        }
      }, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router]);

  return null;
}
