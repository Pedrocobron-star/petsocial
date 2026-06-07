import { type AccentSet } from '@/lib/theme';

// ============================================================================
// IDENTIDADE POR ÁREA ("sub-marca dentro do sistema")
// Cada "app" do Pet Social herda 100% do design system (tipografia, espaçamento,
// primitivos, navegação) e muda APENAS o accent + motif. Isso dá "cara própria"
// sem quebrar a unidade. Regra: o accent pinta no máx ~10% da tela (CTA, header,
// ícone ativo) — fundo/cards/texto continuam neutros.
//
// Cada cor nasce de UMA cor-fonte por área (estilo Material 3): o onAccent é
// escolhido pra passar contraste WCAG ≥4.5:1 sobre `color`.
// ============================================================================

export type AppThemeKey = 'default' | 'health' | 'adoption';

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
};
