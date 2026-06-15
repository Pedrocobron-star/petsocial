// Supabase Edge Function — create-checkout-session
//
// Cria uma Stripe Checkout Session pro user autenticado.
// Deploy: supabase functions deploy create-checkout-session
// Secrets necessários: STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, APP_URL
//
// IMPORTANTE: ainda não está deployado. Por enquanto o app usa um placeholder.
// Pra produção, criar os Prices no Stripe Dashboard e configurar os secrets.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=denonext';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_IDS: Record<'monthly' | 'yearly', string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY')!,
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY')!,
};

const APP_URL = Deno.env.get('APP_URL') ?? 'https://maestropet.com';

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // 1) Autenticar o user a partir do token
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Validar payload
    const { plan } = await req.json();
    if (plan !== 'monthly' && plan !== 'yearly') {
      return new Response(JSON.stringify({ error: 'invalid plan' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Buscar / criar Stripe customer
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from('subscriptions')
        .upsert({ user_id: user.id, stripe_customer_id: customerId, status: 'free' });
    }

    // 4) Log evento
    await supabase.from('subscription_events').insert({
      user_id: user.id,
      event_type: 'checkout_started',
      provider: 'stripe',
      metadata: { plan },
    });

    // 5) Criar Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: PRICE_IDS[plan as 'monthly' | 'yearly'], quantity: 1 }],
      success_url: `${APP_URL}/account?status=success`,
      cancel_url: `${APP_URL}/pro?status=canceled`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
