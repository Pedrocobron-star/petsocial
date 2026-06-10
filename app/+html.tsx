import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML wrapper para web (static export).
 *
 * Faz:
 *  - Meta tags de PWA, theme, viewport e mobile
 *  - OG defaults pra share
 *  - Pré-conexão com Supabase e Google Fonts (perf)
 *  - Registra service worker via inline script (offline-first cache)
 *  - Apple touch icon
 *
 * Cada rota pode sobrescrever <title>, og:title, og:image via `MetaTags` runtime
 * (components/meta-tags.tsx).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"
        />

        {/* Brand — theme-color por esquema (status bar iOS legível no dark) */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F97316" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1A1410" />
        <meta name="msapplication-TileColor" content="#F97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Maestro Pet" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Maestro Pet" />

        {/* Pre-connect pra perf (Supabase + Google Fonts) */}
        <link rel="preconnect" href="https://aefrcwysifgniogumxwk.supabase.co" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* Web App Manifest — installability da PWA (faz o beforeinstallprompt disparar) */}
        <link rel="manifest" href="/manifest.json" />

        {/* Apple touch icon (PWA install em iOS) */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Default OG tags (override em cada rota via MetaTags) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Maestro Pet" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:title" content="Maestro Pet — Saúde do pet + comunidade · App grátis" />
        <meta
          property="og:description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu pet."
        />
        <meta property="og:image" content="/assets/assets/images/icon-512.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Maestro Pet — Saúde do pet + comunidade · App grátis" />
        <meta
          name="twitter:description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu pet."
        />
        <meta name="twitter:image" content="/assets/assets/images/icon-512.png" />

        <meta
          name="description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu cachorro, gato, coelho e mais."
        />

        {/* Impede o navegador mobile de "inflar" as fontes (causa o 'tudo muito grande' no celular) */}
        <style
          dangerouslySetInnerHTML={{
            __html: `html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%;}`,
          }}
        />

        {/* iOS scroll bounce fix do Expo */}
        <ScrollViewStyleReset />

        {/* Captura o evento de instalação da PWA o mais cedo possível (antes do React montar),
            pra o banner conseguir oferecer o "1 toque = instala" nativo. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', function (e) {
                e.preventDefault();
                window.__deferredInstallPrompt = e;
                window.dispatchEvent(new Event('pwa-installable'));
              });
              window.addEventListener('appinstalled', function () {
                window.__deferredInstallPrompt = null;
              });
            `,
          }}
        />

        {/* Service worker registration (offline-first) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && location.protocol === 'https:') {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
