import { Platform } from 'react-native';

/**
 * Atualiza a meta `theme-color` em runtime (web only).
 *
 * No PWA instalado (Android), essa cor pinta a barra de status do sistema.
 * Casando ela com o fundo da tela atual, a barra do telefone "se funde" com o
 * app (estilo Instagram) em vez de aparecer um laranja destoante. No native,
 * no-op. Cada tela chama isso com a sua cor de fundo.
 */
export function setThemeColorMeta(color: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const m = document.createElement('meta');
    m.setAttribute('name', 'theme-color');
    document.head.appendChild(m);
    metas = document.querySelectorAll('meta[name="theme-color"]');
  }
  metas.forEach((m) => {
    // Remove variantes por media-query pra uma única cor controlar a barra.
    m.removeAttribute('media');
    m.setAttribute('content', color);
  });
}
