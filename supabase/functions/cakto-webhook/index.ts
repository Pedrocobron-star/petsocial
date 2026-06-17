// @ts-nocheck — Deno edge function
/**
 * Edge `cakto-webhook` — recebe os webhooks de venda do Cakto (Pix/cartão BR) e
 * ativa/revoga o Pet Pro pelo EMAIL do comprador.
 *
 * Fluxo:
 *   1. Loga o payload CRU em `cakto_events` (auditoria + calibração do parser).
 *   2. Valida o `secret` (CAKTO_WEBHOOK_SECRET) — body.secret / body.data.secret
 *      ou header. Sem match → 401 (mas o evento já foi logado).
 *   3. Mapeia o evento:
 *        aprovado  (purchase_approved / subscription_created|renewed) → cakto_grant_pro
 *        estornado (refund / chargeback / subscription_canceled)      → cakto_revoke_pro
 *      Plano por valor (>= 50 → anual, senão mensal). Calibrável.
 *   4. Responde rápido (< 5s, exigência do Cakto).
 *
 * Deploy: supabase functions deploy cakto-webhook --no-verify-jwt
 * Secret: CAKTO_WEBHOOK_SECRET (o "secret" do webhook no painel do Cakto).
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CAKTO_SECRET = Deno.env.get('CAKTO_WEBHOOK_SECRET') ?? '';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const APPROVE = new Set([
  'purchase_approved', 'subscription_created', 'subscription_renewed',
  'approved', 'paid', 'completed',
]);
const REVOKE = new Set([
  'refund', 'refunded', 'chargeback', 'subscription_canceled',
  'subscription_renewal_refused', 'canceled', 'cancelled',
]);

/** Acha um valor por uma lista de caminhos possíveis (defensivo ao schema). */
function pick(obj: any, paths: string[]): any {
  for (const p of paths) {
    let cur = obj;
    let ok = true;
    for (const key of p.split('.')) {
      if (cur && typeof cur === 'object' && key in cur) cur = cur[key];
      else { ok = false; break; }
    }
    if (ok && cur != null && cur !== '') return cur;
  }
  return null;
}
/** Busca o 1º email em qualquer lugar do objeto (fallback). */
function deepEmail(obj: any, depth = 0): string | null {
  if (!obj || typeof obj !== 'object' || depth > 5) return null;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') { const e = deepEmail(v, depth + 1); if (e) return e; }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  const event = String(pick(body, ['event', 'data.event', 'status', 'data.status', 'type']) ?? '').toLowerCase();
  const email = pick(body, [
    'data.customer.email', 'customer.email', 'data.buyer.email', 'buyer.email',
    'data.client.email', 'data.email', 'email',
  ]) ?? deepEmail(body);
  const orderId = String(pick(body, [
    'data.id', 'data.order.id', 'data.transaction.id', 'data.transaction_id', 'id', 'order_id',
  ]) ?? '') || null;
  const amount = Number(pick(body, [
    'data.amount', 'data.total', 'data.offer.price', 'data.product.price', 'amount',
  ]) ?? 0);

  // 1) Loga SEMPRE (mesmo se o secret falhar) — auditoria + calibração.
  let logId: string | null = null;
  try {
    const { data } = await supabase
      .from('cakto_events')
      .insert({ event, email, order_id: orderId, amount, raw: body })
      .select('id')
      .single();
    logId = data?.id ?? null;
  } catch { /* best-effort */ }

  // 2) Valida o secret (body OU header).
  const incoming = String(
    pick(body, ['secret', 'data.secret', 'webhook.secret']) ??
    req.headers.get('x-cakto-signature') ??
    req.headers.get('x-webhook-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '',
  );
  if (!CAKTO_SECRET || incoming !== CAKTO_SECRET) {
    if (logId) await supabase.from('cakto_events').update({ result: 'bad_secret' }).eq('id', logId).then(undefined, () => {});
    return json({ error: 'unauthorized' }, 401);
  }

  // 3) Decide ação.
  let result: any = { skipped: event };
  try {
    if (APPROVE.has(event)) {
      const plan = amount >= 50 ? 'yearly' : 'monthly';
      const days = plan === 'yearly' ? 365 : 30;
      const { data } = await supabase.rpc('cakto_grant_pro', {
        p_email: email, p_plan: plan, p_days: days, p_order_id: orderId,
      });
      result = { action: 'grant', plan, ...data };
    } else if (REVOKE.has(event)) {
      const { data } = await supabase.rpc('cakto_revoke_pro', { p_email: email, p_order_id: orderId });
      result = { action: 'revoke', ...data };
    }
  } catch (e) {
    result = { error: String(e?.message ?? e) };
  }

  if (logId) {
    await supabase
      .from('cakto_events')
      .update({ result: JSON.stringify(result).slice(0, 300), matched_user: result?.user_id ?? null })
      .eq('id', logId)
      .then(undefined, () => {});
  }

  return json({ ok: true, event, result });
});
