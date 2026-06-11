/**
 * Kit do mascote Mozart (Maestro Pet). Imagens em `public/mozart/*.png`
 * (servidas em `/mozart/...` no web). Use com `<Image source={{ uri: MOZART.x }} />`.
 *
 * Geradas a partir das ilustrações originais (estilo flat). O selo Pet Pro NÃO
 * é mascote — é o `PremiumBadge` (pata dourada), separado.
 */
export const MOZART = {
  /** Rosto + peito — logo/marca. */
  logo: '/mozart/logo.png',
  /** Cabeça (sticker) — avatar. */
  rosto: '/mozart/rosto.png',
  /** Acenando — boas-vindas/onboarding. */
  oi: '/mozart/oi.png',
  /** Comemorando + confete — conquistas/sucesso. */
  comemorando: '/mozart/comemorando.png',
  /** Dormindo — offline/vazio. */
  dormindo: '/mozart/dormindo.png',
  /** Triste — erro/"nada aqui". */
  triste: '/mozart/triste.png',
  /** Curioso + "?" — carregando/404. */
  curioso: '/mozart/curioso.png',
  /** Olhos de coração — curtidas/favoritos. */
  coracao: '/mozart/coracao.png',
  /** Detetive (lupa) — busca/achados. */
  detetive: '/mozart/detetive.png',
  /** Ideia (lâmpada) — dicas. */
  ideia: '/mozart/ideia.png',
  /** Megafone — novidades. */
  megafone: '/mozart/megafone.png',
  /** Maestro (gravata + batuta) — herói do Pet Pro. */
  maestro: '/mozart/maestro.png',
  /** Corpo inteiro sentado — splash/marketing. */
  corpo: '/mozart/corpo.png',
  /** Espiando pela borda — cantos de UI. */
  espiando: '/mozart/espiando.png',
  /** Segurando placa em branco — banners. */
  placa: '/mozart/placa.png',
  /** Balão de fala vazio — onboarding/dicas. */
  balao: '/mozart/balao.png',
} as const;

export type MozartKey = keyof typeof MOZART;

/**
 * Identidade da conta oficial do Mozart (mascote/anfitrião da plataforma).
 * UUIDs fixos (ver supabase/mozart-profile.sql e mozart-feed.sql).
 */
export const MOZART_USER_ID = 'd0c0ffee-0000-4000-8000-00000000cafe';
export const MOZART_PET_ID = 'd0c0ffee-0000-4000-8000-00000000beef';

/** O perfil/pet é o do Mozart (anfitrião oficial)? Recebe um id de pet. */
export function isMozartPet(petId?: string | null): boolean {
  return petId === MOZART_PET_ID;
}
