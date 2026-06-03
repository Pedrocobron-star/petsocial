# 💰 Monetização — Setup do Pet Pro

## 1. Stripe Account

1. Cria conta em https://dashboard.stripe.com (modo teste primeiro)
2. Em **Products** → cria 2 produtos:
   - **Pet Pro — Mensal** (R$ 14,90, recorrente mensal) → copie o Price ID `price_xxx`
   - **Pet Pro — Anual** (R$ 99,90, recorrente anual) → copie o Price ID
3. Em **Developers → API keys** copia:
   - `STRIPE_SECRET_KEY` (sk_test_...)
   - `STRIPE_PUBLISHABLE_KEY` (pk_test_...)

## 2. Supabase Edge Functions

```bash
# Instalar CLI (uma vez)
npm install -g supabase

# Login
supabase login

# Linkar projeto
cd petsocial
supabase link --project-ref aefrcwysifgniogumxwk

# Configurar secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_PRICE_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_YEARLY=price_yyy
supabase secrets set APP_URL=https://petsocial.app
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx  # vem do passo 3

# Deploy
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 3. Webhook no Stripe

1. Em **Developers → Webhooks → Add endpoint**
2. URL: `https://aefrcwysifgniogumxwk.functions.supabase.co/stripe-webhook`
3. Eventos a enviar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copia o **Signing secret** (whsec_xxx) → cola no `STRIPE_WEBHOOK_SECRET`
5. Redeploy: `supabase functions deploy stripe-webhook --no-verify-jwt`

## 4. Testar localmente

```bash
# Stripe CLI pra encaminhar webhooks pra Edge Function local
stripe listen --forward-to https://aefrcwysifgniogumxwk.functions.supabase.co/stripe-webhook

# Comprar com cartão de teste:
# 4242 4242 4242 4242  (qualquer CVV, qualquer data futura)
```

## 5. Mercado Pago (Pix) — opcional

Pix é forte no Brasil. Tempo de integração: ~6h.

1. https://www.mercadopago.com.br/developers → conta de teste
2. Criar `PreApproval` plan via API (mensal/anual recorrente)
3. Edge Function `create-mp-preference` análoga à Stripe
4. Webhook em `/mp-webhook` que atualiza `mp_subscription_id` e `status`

Vale priorizar Stripe primeiro (já cobre 80% dos pagantes com cartão).

## 6. Métricas a acompanhar

- **MRR** (Monthly Recurring Revenue) — soma de assinaturas ativas / 12
- **ARPU** (Average Revenue Per User) — receita / usuários ativos
- **Churn** — % que cancela por mês
- **Conversion rate Free→Pro** — meta inicial: 2-3%
- **LTV** (Lifetime Value) — ARPU × meses médios assinante

Recomendado: ligar **PostHog** (gratuito até 1M eventos/mês) pra ver funil completo.

## 7. Outros canais de receita (futuros)

- **Anúncios self-serve** — Sprint 17 (cobranças por CPM/CPC)
- **Listing Premium no Pet Map** — Sprint 18 (R$ 49/mês por place)
- **Affiliate Petlove/Amazon** — Sprint 19 (8-12% comissão)
- **Seguro pet affiliate** — Sprint 20 (R$ 80-300 por contrato)

Ver detalhes em conversas anteriores.

---

## ⚠️ Estado atual

A infraestrutura está pronta no código mas:
- ❌ Edge Functions não deployadas (sem secrets do Stripe)
- ❌ Stripe products não criados
- ❌ Webhook não conectado

**Pra rodar em produção** seguir os passos 1-3 acima. Sem isso, o botão "Assinar" mostra placeholder.
