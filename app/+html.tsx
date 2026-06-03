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

        {/* Brand */}
        <meta name="theme-color" content="#F97316" />
        <meta name="msapplication-TileColor" content="#F97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Pet Social" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Pet Social" />

        {/* Pre-connect pra perf (Supabase + Google Fonts) */}
        <link rel="preconnect" href="https://aefrcwysifgniogumxwk.supabase.co" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* Apple touch icon (PWA install em iOS) */}
        <link rel="apple-touch-icon" href="/assets/assets/images/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/assets/images/apple-touch-icon.png" />

        {/* Default OG tags (override em cada rota via MetaTags) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Pet Social" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:title" content="Pet Social — Saúde do pet + comunidade · App grátis" />
        <meta
          property="og:description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu pet."
        />
        <meta property="og:image" content="/assets/assets/images/icon-512.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Pet Social — Saúde do pet + comunidade · App grátis" />
        <meta
          name="twitter:description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu pet."
        />
        <meta name="twitter:image" content="/assets/assets/images/icon-512.png" />

        <meta
          name="description"
          content="Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu cachorro, gato, coelho e mais."
        />

        {/* iOS scroll bounce fix do Expo */}
        <ScrollViewStyleReset />

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
