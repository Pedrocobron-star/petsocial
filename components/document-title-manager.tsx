import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { resetMetaTags } from '@/lib/meta-tags';
import { setThemeColorMeta } from '@/lib/theme-color';
import { useTheme } from '@/providers/theme-provider';

const SITE_NAME = 'Maestro Pet';

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
  { match: '/legal/animais', title: 'Regras de anúncios de animais' },

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
  { match: /^\/pet\/[^/]+\/ai-assistant/, title: 'Tira-dúvidas de Saúde' },
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
  { match: '/places', title: 'Lugares' },
  { match: '/offers', title: 'Vantagens' },
  { match: '/adoption', title: 'Adoção' },
  { match: /^\/ler\//, title: 'Notícia' },
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

// Favicon = a cara do Mozart (mascote oficial) na aba do navegador.
// `?v=` força o navegador a rebuscar e furar o ícone antigo (pata) em cache.
const FAVICON_HREF = '/mozart/rosto.png?v=mozart3';

function injectBrandedFavicon() {
  if (typeof document === 'undefined') return;
  // Remove favicons antigos (o default do Expo + qualquer pata anterior)
  document.querySelectorAll('link[rel*="icon"]').forEach((link) => link.remove());
  // Favicon da aba — Mozart
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = FAVICON_HREF;
  document.head.appendChild(link);
  // Apple touch icon (instalar em iOS) — ícone opaco dedicado do Mozart
  const apple = document.createElement('link');
  apple.rel = 'apple-touch-icon';
  apple.href = '/apple-touch-icon.png';
  document.head.appendChild(apple);
}

/**
 * Atualiza `document.title` (texto da aba) conforme a rota atual + injeta
 * favicon brand laranja. No web. No native, no-op.
 */
export function DocumentTitleManager() {
  const pathname = usePathname();
  const { theme } = useTheme();

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

    // Casa a barra de status do telefone (PWA) com o fundo da tela. O
    // springboard (/phone) cuida da própria cor (combina com o wallpaper).
    if (pathname !== '/phone') {
      setThemeColorMeta(theme.bg);
    }
  }, [pathname, theme.bg]);

  return null;
}
