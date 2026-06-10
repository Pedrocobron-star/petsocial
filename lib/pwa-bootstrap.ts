import { Platform } from 'react-native';

/**
 * Bootstrap da PWA em runtime (web only).
 *
 * Por quê: com `web.output: "single"` (SPA), o Expo Router NÃO aplica o
 * `app/+html.tsx`. Resultado: o HTML servido não tem `<link rel="manifest">`,
 * nem registro de service worker, nem a captura do `beforeinstallprompt`.
 * Sem manifest linkado + SW registrado, o Chrome não considera o site
 * instalável e o evento `beforeinstallprompt` nunca dispara — então o botão
 * "Instalar" (banner no mobile, ícone na barra no desktop) nunca aparece.
 *
 * Aqui injetamos tudo isso no <head> em runtime (idempotente) e registramos
 * o SW. Também forçamos o favicon a ser a cara do Mozart com um cache-bust,
 * pra furar o ícone antigo (pata) que ficou guardado no navegador.
 *
 * Roda no carregamento do bundle (cedo o suficiente pra o beforeinstallprompt
 * ser capturado antes do React montar).
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type PwaWindow = Window & {
  __deferredInstallPrompt?: BeforeInstallPromptEvent | null;
  __pwaInstallHooked?: boolean;
};

// Bump quando quiser forçar o navegador a rebuscar o favicon.
const FAVICON_HREF = '/mozart/rosto.png?v=mozart3';

export function bootstrapPwaWeb(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
    return;
  }
  const head = document.head;
  if (!head) return;

  const ensureLink = (selector: string, attrs: Record<string, string>) => {
    if (document.querySelector(selector)) return;
    const el = document.createElement('link');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    head.appendChild(el);
  };

  const ensureMeta = (name: string, content: string) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const el = document.createElement('meta');
    el.setAttribute('name', name);
    el.setAttribute('content', content);
    head.appendChild(el);
  };

  // 1) Manifest — destrava a instalação da PWA (faz o beforeinstallprompt disparar)
  ensureLink('link[rel="manifest"]', { rel: 'manifest', href: '/manifest.json' });

  // 2) Apple touch icon (instalar em iOS)
  ensureLink('link[rel="apple-touch-icon"]', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });

  // 3) Favicon — força a cara do Mozart e fura o cache da pata antiga.
  if (!document.querySelector(`link[rel="icon"][href="${FAVICON_HREF}"]`)) {
    document
      .querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
      .forEach((n) => n.parentNode?.removeChild(n));
    const fav = document.createElement('link');
    fav.setAttribute('rel', 'icon');
    fav.setAttribute('type', 'image/png');
    fav.setAttribute('href', FAVICON_HREF);
    head.appendChild(fav);
  }

  // 4) Metas de PWA (iOS standalone + nome)
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-title', 'Maestro Pet');
  ensureMeta('mobile-web-app-capable', 'yes');

  // 5) Captura o beforeinstallprompt cedo (o banner usa window.__deferredInstallPrompt)
  const w = window as PwaWindow;
  if (!w.__pwaInstallHooked) {
    w.__pwaInstallHooked = true;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      w.__deferredInstallPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event('pwa-installable'));
    });
    window.addEventListener('appinstalled', () => {
      w.__deferredInstallPrompt = null;
    });
  }

  // 6) Service worker — necessário pra installability (e offline-first).
  //    Auto-update: quando um SW NOVO assume o controle (deploy novo), recarrega
  //    uma vez pra puxar o bundle atual. Assim o PWA instalado não fica preso numa
  //    versão velha. Só recarrega em ATUALIZAÇÃO (já havia controller), não na 1a vez.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}
