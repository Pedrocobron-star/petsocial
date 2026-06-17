/**
 * Checkout via Cakto (hospedado). O app abre o link de checkout do Cakto com o
 * email do usuário no prefill — assim o webhook (`cakto-webhook`) casa o
 * pagamento aprovado com a conta pelo email e ativa o Pet Pro.
 *
 * Os links abaixo são URLs PÚBLICAS (não são segredo) — o Pedro cria os 2
 * produtos no painel do Cakto (mensal/anual) e cola os links aqui.
 */

const CAKTO_CHECKOUT: Record<'monthly' | 'yearly', string> = {
  monthly: 'https://pay.cakto.com.br/uibye67_931101', // Pet Pro Mensal (R$ 14,90)
  yearly: 'https://pay.cakto.com.br/7vdvnzo_931103', // Pet Pro Anual (R$ 99,90)
};

/** Já tem os links configurados? (enquanto false, a tela mostra "em breve"). */
export function isCaktoConfigured(): boolean {
  return !!CAKTO_CHECKOUT.monthly && !!CAKTO_CHECKOUT.yearly;
}

/**
 * Monta o link de checkout do Cakto pro plano, com o email no prefill.
 * Retorna null se o link ainda não foi configurado.
 */
export function caktoCheckoutUrl(plan: 'monthly' | 'yearly', email?: string | null): string | null {
  const base = CAKTO_CHECKOUT[plan];
  if (!base) return null;
  if (!email) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}email=${encodeURIComponent(email)}`;
}
