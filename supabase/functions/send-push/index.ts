// @ts-nocheck — Deno edge function, types não resolvem em TS node config
/**
 * Edge function `send-push` — dispatch de push notification via Expo API.
 *
 * Disparado pelo trigger `notifications_dispatch_push` em INSERT na tabela
 * `notifications`. Lê o push_token do user destino e manda mensagem via
 * https://exp.host/--/api/v2/push/send (Expo Push API).
 *
 * Body esperado: { notification_id: string }
 *
 * Setup no Supabase:
 * - vault.secrets:
 *   - service_role_key: a service_role key do projeto
 *   - send_push_url: https://<project>.supabase.co/functions/v1/send-push
 *
 * Deploy: `supabase functions deploy send-push --no-verify-jwt`
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface Notif {
  id: string;
  user_id: string;
  kind: 'like' | 'comment' | 'follow' | 'mention' | 'pet_tagged';
  actor_pet_id: string | null;
  target_pet_id: string | null;
  post_id: string | null;
}

interface Pet {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  push_token: string | null;
}

function buildMessage(n: Notif, actorPet: Pet | null, targetPet: Pet | null) {
  const actorName = actorPet?.name ?? 'Alguém';
  const targetName = targetPet?.name ?? 'seu pet';
  switch (n.kind) {
    case 'like':
      return {
        title: `${actorName} curtiu seu post`,
        body: `Post de ${targetName}`,
      };
    case 'comment':
      return {
        title: `${actorName} comentou`,
        body: `Em um post de ${targetName}`,
      };
    case 'follow':
      return {
        title: `${actorName} seguiu ${targetName}`,
        body: 'Seu pet ganhou um novo seguidor 🐾',
      };
    case 'mention':
      return {
        title: `${actorName} te mencionou`,
        body: 'Toque pra ver',
      };
    case 'pet_tagged':
      return {
        title: `${actorName} marcou ${targetName}`,
        body: 'Em um post',
      };
    default:
      return { title: 'Pet Social', body: 'Nova atividade' };
  }
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { notification_id } = await req.json();
    if (!notification_id) {
      return new Response('Missing notification_id', { status: 400 });
    }

    // Busca a notif
    const { data: notifRow } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notification_id)
      .maybeSingle();
    const n = notifRow as Notif | null;
    if (!n) return new Response('Notification not found', { status: 404 });

    // Busca push token do user destino
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, push_token')
      .eq('id', n.user_id)
      .maybeSingle();
    const profile = profileRow as Profile | null;
    if (!profile?.push_token) {
      return new Response(JSON.stringify({ skipped: 'no_token' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Busca actor + target pets pra montar a mensagem
    const [actorRes, targetRes] = await Promise.all([
      n.actor_pet_id
        ? supabase.from('pets').select('id, name').eq('id', n.actor_pet_id).maybeSingle()
        : Promise.resolve({ data: null }),
      n.target_pet_id
        ? supabase.from('pets').select('id, name').eq('id', n.target_pet_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const actor = (actorRes.data ?? null) as Pet | null;
    const target = (targetRes.data ?? null) as Pet | null;

    const { title, body } = buildMessage(n, actor, target);

    // Envia push via Expo Push API
    const expoMessage = {
      to: profile.push_token,
      title,
      body,
      sound: 'default',
      priority: 'high',
      data: {
        notification_id: n.id,
        kind: n.kind,
        post_id: n.post_id,
        actor_pet_id: n.actor_pet_id,
        target_pet_id: n.target_pet_id,
      },
    };

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expoMessage),
    });

    const expoData = await expoRes.json();

    return new Response(JSON.stringify({ ok: true, expo: expoData }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
