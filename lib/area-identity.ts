import { type AppThemeKey } from '@/lib/app-themes';

/**
 * IDENTIDADE VISUAL FORTE POR ÁREA — além do accent.
 *
 * Cada "app" do Maestro Pet ganha um HERO próprio: gradiente, padrão de motivos
 * repetidos (textura), e uma SILHUETA de borda inferior diferente (onda,
 * festão, zigue-zague, fita, ticket...). Assim cada seção tem "cara única" de
 * verdade — não só uma cor trocada — mantendo o mesmo design system embaixo.
 */

export type HeroShape = 'wave' | 'scallop' | 'zigzag' | 'notch' | 'ticket';

export interface AreaIdentity {
  title: string;
  tagline: string;
  motif: string; // emoji grande do "selo"
  pattern: string; // emoji repetido na textura de fundo
  shape: HeroShape; // silhueta da borda inferior do hero
  grad: [string, string]; // gradiente do hero (mesmo em claro/escuro — é faixa colorida)
}

export const AREA_IDENTITY: Record<Exclude<AppThemeKey, 'default'>, AreaIdentity> = {
  health: {
    title: 'Saúde',
    tagline: 'Cuide do seu pet de ponta a ponta',
    motif: '🩺',
    pattern: '➕',
    shape: 'scallop',
    grad: ['#2DD4BF', '#0F766E'],
  },
  adoption: {
    title: 'Adoção',
    tagline: 'Um lar pra quem precisa de amor',
    motif: '🏠',
    pattern: '🐾',
    shape: 'wave',
    grad: ['#FB7185', '#BE123C'],
  },
  meetups: {
    title: 'Rolês',
    tagline: 'Encontros pet pela cidade',
    motif: '🎉',
    pattern: '✦',
    shape: 'zigzag',
    grad: ['#A78BFA', '#6D28D9'],
  },
  places: {
    title: 'Lugares',
    tagline: 'Onde ir com seu pet',
    motif: '🗺️',
    pattern: '📍',
    shape: 'wave',
    grad: ['#60A5FA', '#1D4ED8'],
  },
  achievements: {
    title: 'Conquistas',
    tagline: 'Suas medalhas e troféus',
    motif: '🏆',
    pattern: '★',
    shape: 'notch',
    grad: ['#FBBF24', '#B45309'],
  },
  offers: {
    title: 'Vantagens',
    tagline: 'Descontos e mimos pro seu pet',
    motif: '🎁',
    pattern: '🎟️',
    shape: 'ticket',
    grad: ['#F472B6', '#BE185D'],
  },
  messages: {
    title: 'Mensagens',
    tagline: 'Converse com outros tutores',
    motif: '💬',
    pattern: '✉️',
    shape: 'wave',
    grad: ['#34D399', '#047857'],
  },
  lostfound: {
    title: 'Achados',
    tagline: 'Perdeu ou achou? A rede procura junto',
    motif: '🔍',
    pattern: '🐾',
    shape: 'notch',
    grad: ['#22D3EE', '#0E7490'],
  },
};
