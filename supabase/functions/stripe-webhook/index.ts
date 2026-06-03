// Supabase Edge Function — stripe-webhook
//
// Recebe eventos do Stripe e atualiza public.subscriptions.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// (sem verify-jwt porque Stripe não envia auth header)
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Cliente com service_role (bypass RLS pra atualizar subscriptions de qualquer user)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface StripeSubMeta {
  supabase_user_id?: string;
  plan?: 'monthly' | 'yearly';
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('no signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error('webhook signature failed:', err);
    return new Response('invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const userId = (sub.metadata as StripeSubMeta).supabase_user_id;
        if (!userId) break;
        await supabase
          .from('subscriptions')
          .update({
            status: sub.status,
            plan: (sub.metadata as StripeSubMeta).plan ?? 'monthly',
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer as string,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq('user_id', userId);
        await supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'subscription_created',
          provider: 'stripe',
          amount_cents: session.amount_total ?? null,
          currency: (session.currency ?? 'BRL').toUpperCase(),
          metadata: { session_id: session.id, sub_id: sub.id },
        });
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = (sub.metadata as StripeSubMeta).supabase_user_id;
        if (!userId) break;
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
          .eq('user_id', userId);
        await supabase.from('subscription_events').insert({
          user_id: userId,
          event_type:
            event.type === 'customer.subscription.deleted'
              ? 'subscription_canceled'
              : 'subscription_renewed',
          provider: 'stripe',
          metadata: { sub_id: sub.id, status },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = (sub.metadata as StripeSubMeta).supabase_user_id;
        if (!userId) break;
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('user_id', userId);
        await supabase.from('subscription_events').insert({
          user_id: userId,
          event_type: 'payment_failed',
          provider: 'stripe',
          metadata: { invoice_id: invoice.id },
        });
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('webhook handler error:', err);
    return new Response('handler error', { status: 500 });
  }
});
