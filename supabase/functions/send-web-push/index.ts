// @ts-nocheck — Deno edge function, types não resolvem em TS node config
/**
 * Edge function `send-web-push` — dispara Web Push (PWA) via VAPID.
 *
 * Diferente do `send-push` (Expo, push nativo), este manda pra subscriptions de
 * NAVEGADOR salvas em `push_subscriptions`, usando o protocolo Web Push.
 *
 * Body (JSON):
 *   { user_id?: string, user_ids?: string[], title: string, body?: string,
 *     url?: string, tag?: string }
 *
 * AUTORIZAÇÃO (a função é --no-verify-jwt, então validamos manualmente):
 *   - Header `x-petsocial-secret` == app_secrets.push_secret  → chamada do
 *     servidor/cron, pode mirar QUALQUER user (user_ids livre).
 *   - OU `Authorization: Bearer <JWT válido>` → self-push: só envia pro próprio
 *     user (ignora user_ids arbitrários). É o caso do botão "enviar teste".
 *   - Sem nenhum dos dois → 401. Fecha o abuso anônimo da URL pública.
 *
 * Secrets necessárias (supabase secrets set ...):
 *   - VAPID_PUBLIC_KEY   (a chave pública VAPID)
 *   - VAPID_PRIVATE_KEY  (a chave privada VAPID — NUNCA commitar)
 *   - VAPID_SUBJECT      (opcional, default mailto:pedrocobron@gmail.com)
 *   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente)
 *   O push_secret vive na tabela app_secrets (gerado no banco, nunca digitado).
 *
 * Deploy: `supabase functions deploy send-web-push --no-verify-jwt`
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:pedrocobron@gmail.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// CORS — necessário pra o app (outro domínio) chamar via fetch/supabase.functions.invoke
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-petsocial-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

serve(async (req) => {
  // Preflight do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    // ---- AuthZ: segredo interno (cron) OU JWT válido (self-push) ----
    const incomingSecret = req.headers.get('x-petsocial-secret');
    let expectedSecret: string | null = null;
    {
      const { data } = await supabase
        .from('app_secrets')
        .select('value')
        .eq('key', 'push_secret')
        .maybeSingle();
      expectedSecret = data?.value ?? null;
    }

    let authorized = false;
    let restrictToSelf: string | null = null;

    if (expectedSecret && incomingSecret && incomingSecret === expectedSecret) {
      authorized = true; // servidor/cron — pode mirar qualquer user
    } else {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          authorized = true;
          restrictToSelf = user.id; // self-push: só pra si mesmo
        }
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { user_id, user_ids, title, body, url, tag } = await req.json();
    let ids: string[] = user_ids ?? (user_id ? [user_id] : []);
    if (restrictToSelf) ids = [restrictToSelf]; // ignora alvos arbitrários
    if (!ids.length || !title) {
      return new Response(JSON.stringify({ error: 'user_id(s) e title obrigatórios' }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', ids);
    if (error) throw error;

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/', tag });
    let sent = 0;
    let removed = 0;

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        // 404/410 = subscription expirou → limpa
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
          removed++;
        }
      }
    }

    return new Response(JSON.stringify({ sent, removed, total: subs?.length ?? 0 }), {
      headers: jsonHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
