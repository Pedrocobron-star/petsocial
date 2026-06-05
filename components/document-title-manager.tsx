import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { resetMetaTags } from '@/lib/meta-tags';

const SITE_NAME = 'Pet Social';

// Mapeamento de rota → título amigável. Rotas com [param] usam matching por prefixo.
const ROUTE_TITLES: { match: RegExp | string; title: string }[] = [
  { match: '/welcome', title: 'Saúde do pet + comunidade · App grátis' },
  { match: '/sign-in', title: 'Entrar' },
  { match: '/sign-up', title: 'Criar conta' },
  { match: '/reset-password', title: 'Nova senha' },
  { match: '/legal/terms', title: 'Termos de uso' },
  { match: '/legal/privacy', title: 'Privacidade' },
  { match: '/legal/about', title: 'Sobre' },
  { match: '/legal/faq', title: 'FAQ' },

  // App
  { match: /^\/$/, title: 'Feed' },
  { match: /^\/\(tabs\)$/, title: 'Feed' },
  { match: '/explore', title: 'Descobrir' },
  { match: '/create', title: 'Postar' },
  { match: '/meetups', title: 'Encontros' },
  { match: '/profile', title: 'Perfil' },

  // Pet sub-pages
  { match: /^\/pet\/[^/]+\/avatar/, title: 'Avatar' },
  { match: /^\/pet\/[^/]+\/id-card/, title: 'Carteirinha' },
  { match: /^\/pet\/[^/]+\/caretakers/, title: 'Cuidadores' },
  { match: /^\/pet\/[^/]+\/agenda/, title: 'Agenda' },
  { match: /^\/pet\/[^/]+\/health-alerts/, title: 'Alertas' },
  { match: /^\/pet\/[^/]+\/health-calendar/, title: 'Calendário' },
  { match: /^\/pet\/[^/]+\/health/, title: 'Saúde' },
  { match: /^\/pet\/[^/]+\/symptoms/, title: 'Sintomas' },
  { match: /^\/pet\/[^/]+\/diet/, title: 'Dieta' },
  { match: /^\/pet\/[^/]+\/vaccinations/, title: 'Vacinas' },
  { match: /^\/pet\/[^/]+\/medications/, title: 'Remédios' },
  { match: /^\/pet\/[^/]+\/weight/, title: 'Peso' },
  { match: /^\/pet\/[^/]+\/parasites/, title: 'Parasitas' },
  { match: /^\/pet\/[^/]+\/vet-visits/, title: 'Consultas' },
  { match: /^\/pet\/[^/]+\/documents/, title: 'Exames & Laudos' },
  { match: /^\/pet\/[^/]+\/expenses/, title: 'Gastos' },
  { match: /^\/pet\/[^/]+\/recap/, title: 'Retrospectiva' },
  { match: /^\/pet\/[^/]+\/diary/, title: 'Diário' },
  { match: /^\/pet\/[^/]+\/gallery/, title: 'Galeria' },
  { match: /^\/pet\/[^/]+\/followers/, title: 'Seguidores' },
  { match: /^\/pet\/[^/]+\/following/, title: 'Seguindo' },
  { match: /^\/pet\/[^/]+\/quiz/, title: 'Quiz' },
  { match: /^\/pet\/[^/]+\/memorial/, title: 'Memorial' },
  { match: /^\/pet\/[^/]+\/birthday/, title: 'Aniversário' },
  { match: /^\/pet\/[^/]+\/time-capsule/, title: 'Cápsula do tempo' },
  { match: /^\/pet\/[^/]+\/ai-assistant/, title: 'Assistente IA' },
  { match: /^\/pet\/[^/]+\/edit/, title: 'Editar pet' },
  { match: /^\/pet\/new/, title: 'Novo pet' },
  { match: /^\/pet\/[^/]+$/, title: 'Pet' },

  // Outras
  { match: /^\/post\//, title: 'Post' },
  { match: /^\/chat\//, title: 'Conversa' },
  { match: '/messages', title: 'Mensagens' },
  { match: '/notifications', title: 'Notificações' },
  { match: '/saved', title: 'Posts salvos' },
  { match: '/account', title: 'Minha conta' },
  { match: '/notification-settings', title: 'Notificações' },
  { match: '/pets-overview', title: 'Meus pets · Saúde' },
  { match: '/pro', title: 'Pet Pro' },
  { match: '/edit-profile', title: 'Editar perfil' },
  { match: '/wall-of-fame', title: 'Wall of Fame' },
  { match: '/achievements', title: 'Conquistas' },
  { match: '/lost-found', title: 'Lost & Found' },
  { match: '/places', title: 'Pet Map' },
  { match: '/offers', title: 'Vantagens' },
  { match: '/adoption', title: 'Adoção' },
  { match: '/reminders', title: 'Lembretes' },
  { match: '/shared-pets', title: 'Pets que cuido' },
  { match: '/language', title: 'Idioma' },
  { match: /^\/tag\//, title: 'Hashtag' },
  { match: /^\/meetup\//, title: 'Encontro' },
  { match: /^\/id\//, title: 'Carteirinha' },
  { match: /^\/invite\//, title: 'Convite' },
  { match: '/onboarding', title: 'Bem-vindo' },
];

function titleFor(pathname: string): string {
  for (const r of ROUTE_TITLES) {
    if (typeof r.match === 'string' ? pathname === r.match || pathname.startsWith(r.match) : r.match.test(pathname)) {
      return `${r.title} · ${SITE_NAME}`;
    }
  }
  return SITE_NAME;
}

// Favicon SVG inline (paw print laranja). Substitui o ícone default do Expo.
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" ry="14" fill="#F97316"/>
  <ellipse cx="32" cy="40" rx="11" ry="9" fill="#FFFFFF"/>
  <ellipse cx="20" cy="26" rx="4.5" ry="6" fill="#FFFFFF"/>
  <ellipse cx="28" cy="20" rx="4.5" ry="6.5" fill="#FFFFFF"/>
  <ellipse cx="36" cy="20" rx="4.5" ry="6.5" fill="#FFFFFF"/>
  <ellipse cx="44" cy="26" rx="4.5" ry="6" fill="#FFFFFF"/>
</svg>`;

function injectBrandedFavicon() {
  if (typeof document === 'undefined') return;
  const dataUri = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`;
  // Remove favicons antigos (Expo bota o default)
  document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
  // Adiciona o nosso
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = dataUri;
  document.head.appendChild(link);
  // Apple touch fallback
  const apple = document.createElement('link');
  apple.rel = 'apple-touch-icon';
  apple.href = dataUri;
  document.head.appendChild(apple);
}

/**
 * Atualiza `document.title` (texto da aba) conforme a rota atual + injeta
 * favicon brand laranja. No web. No native, no-op.
 */
export function DocumentTitleManager() {
  const pathname = usePathname();

  // Injeta favicon uma vez no mount
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    injectBrandedFavicon();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    // Aplica defaults brand (título + OG genérico). Rotas específicas
    // sobrescrevem via <MetaTags ... /> próprio do componente.
    const title = titleFor(pathname);
    document.title = title;
    // Reseta meta tags pros defaults — `<MetaTags>` em telas específicas
    // sobrescreve depois (effect order: cleanup → next mount).
    const fragment = title.replace(` · ${SITE_NAME}`, '');
    resetMetaTags(fragment === SITE_NAME ? undefined : fragment);
  }, [pathname]);

  return null;
}
