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
 * Secrets necessárias (supabase secrets set ...):
 *   - VAPID_PUBLIC_KEY   (a chave pública VAPID)
 *   - VAPID_PRIVATE_KEY  (a chave privada VAPID — NUNCA commitar)
 *   - VAPID_SUBJECT      (opcional, default mailto:pedrocobron@gmail.com)
 *   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente)
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

serve(async (req) => {
  try {
    const { user_id, user_ids, title, body, url, tag } = await req.json();
    const ids: string[] = user_ids ?? (user_id ? [user_id] : []);
    if (!ids.length || !title) {
      return new Response(JSON.stringify({ error: 'user_id(s) e title obrigatórios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
