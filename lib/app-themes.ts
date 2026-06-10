import { type AccentSet } from '@/lib/theme';

// ============================================================================
// IDENTIDADE POR ÁREA ("sub-marca dentro do sistema")
// Cada "app" do Maestro Pet herda 100% do design system (tipografia, espaçamento,
// primitivos, navegação) e muda APENAS o accent + motif. Isso dá "cara própria"
// sem quebrar a unidade. Regra: o accent pinta no máx ~10% da tela (CTA, header,
// ícone ativo) — fundo/cards/texto continuam neutros.
//
// Cada cor nasce de UMA cor-fonte por área (estilo Material 3): o onAccent é
// escolhido pra passar contraste WCAG ≥4.5:1 sobre `color`.
// ============================================================================

export type AppThemeKey =
  | 'default'
  | 'health'
  | 'adoption'
  | 'meetups'
  | 'places'
  | 'achievements'
  | 'offers'
  | 'messages'
  | 'lostfound';

interface AppAccent {
  light: AccentSet;
  dark: AccentSet;
}

export const APP_THEMES: Record<AppThemeKey, AppAccent> = {
  // Default = brand laranja (idêntico ao tema atual → zero regressão).
  default: {
    light: { color: '#F97316', dark: '#C2410C', surface: '#FFF7ED', onAccent: '#FFFFFF', motif: '🐾' },
    dark: { color: '#FB923C', dark: '#FDBA74', surface: '#1F1813', onAccent: '#1A1410', motif: '🐾' },
  },
  // Saúde: teal clínico, SÓBRIO. Transmite confiança (área que toca saúde não
  // pode parecer lúdica). Nada de neon. teal-700 sobre branco = AA.
  health: {
    light: { color: '#0F766E', dark: '#115E59', surface: '#E6F4F0', onAccent: '#FFFFFF', motif: '🩺' },
    dark: { color: '#2DD4BF', dark: '#5EEAD4', surface: '#11201C', onAccent: '#06231C', motif: '🩺' },
  },
  // Adoção: vermelho quente afetivo — já é a cara da seção hoje, só formaliza.
  adoption: {
    light: { color: '#C2410C', dark: '#9A3412', surface: '#FEF2F2', onAccent: '#FFFFFF', motif: '🏠' },
    dark: { color: '#FB7185', dark: '#FDA4AF', surface: '#2A1316', onAccent: '#2A0A0A', motif: '🏠' },
  },
  // Encontros ("Rolês"): violeta social — animado, mas não infantil.
  meetups: {
    light: { color: '#6D28D9', dark: '#5B21B6', surface: '#F5F3FF', onAccent: '#FFFFFF', motif: '🗓️' },
    dark: { color: '#A78BFA', dark: '#C4B5FD', surface: '#1E1B2E', onAccent: '#1E1233', motif: '🗓️' },
  },
  // Lugares (Pet Map): azul de mapa/descoberta.
  places: {
    light: { color: '#1D4ED8', dark: '#1E40AF', surface: '#EFF6FF', onAccent: '#FFFFFF', motif: '🗺️' },
    dark: { color: '#60A5FA', dark: '#93C5FD', surface: '#11203A', onAccent: '#07182E', motif: '🗺️' },
  },
  // Conquistas: ouro/bronze de medalha (deep amber passa AA como texto e como fundo).
  achievements: {
    light: { color: '#A16207', dark: '#854D0E', surface: '#FEF3C7', onAccent: '#FFFFFF', motif: '🏆' },
    dark: { color: '#FBBF24', dark: '#FCD34D', surface: '#241B07', onAccent: '#2A1F00', motif: '🏆' },
  },
  // Clube de Vantagens: magenta de promoção/oferta.
  offers: {
    light: { color: '#BE185D', dark: '#9D174D', surface: '#FDF2F8', onAccent: '#FFFFFF', motif: '🎁' },
    dark: { color: '#F472B6', dark: '#F9A8D4', surface: '#2A1320', onAccent: '#2A0A18', motif: '🎁' },
  },
  // Mensagens: verde-esmeralda conversa — acolhedor, distinto do teal clínico.
  messages: {
    light: { color: '#047857', dark: '#065F46', surface: '#ECFDF5', onAccent: '#FFFFFF', motif: '💬' },
    dark: { color: '#34D399', dark: '#6EE7B7', surface: '#0C2620', onAccent: '#05241B', motif: '💬' },
  },
  // Achados (Lost & Found): ciano de busca/radar — casa com a geolocalização.
  lostfound: {
    light: { color: '#0E7490', dark: '#155E75', surface: '#ECFEFF', onAccent: '#FFFFFF', motif: '🔍' },
    dark: { color: '#22D3EE', dark: '#67E8F9', surface: '#0A2A33', onAccent: '#04222A', motif: '🔍' },
  },
};
