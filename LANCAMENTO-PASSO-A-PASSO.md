# Lançamento — passo a passo (sua parte)

Tudo que dá pra fazer em código já está feito e no ar (v185). O que sobra são
ações nas **suas contas** (Supabase, Cakto, Vercel, gov.br), porque exigem login
seu / pagamento / identidade. Segue na ordem. Cada passo diz **como saber que deu certo**.

---

## PARTE A — Banco de dados (Supabase SQL Editor) · ~3 min
Abre: https://supabase.com/dashboard/project/aefrcwysifgniogumxwk/sql/new

**A1. Endurecimento (LGPD + pagamento + consentimento)**
1. Abre o arquivo `supabase/_APLICAR-no-lancamento.sql`, copia TUDO.
2. Cola no SQL Editor e clica **Run** (ou Ctrl+Enter).
3. ✅ Deve aparecer "Success. No rows returned".  [FEITO em 2026-06-19]

**A2. Conteúdo do feed (Mozart + personas)**
1. Abre o arquivo `supabase/_SEED-conteudo-lancamento.sql`, copia TUDO.
2. Cola numa query nova e clica **Run**.
3. ✅ A última linha mostra uma tabela: `mozart_agendados` > 0 e `persona_posts_total` = 15.
   Os posts aparecem no feed aos poucos (o cron publica a cada 5 min).
   [FEITO em 2026-06-19: mozart_agendados=20, persona_posts_total=15, materias=9]

**A3. Correções da caça a bugs (limite de pet no servidor + trial conta como Pro)**
1. Abre o arquivo `supabase/_APLICAR-2-correcoes.sql`, copia TUDO.
2. Cola numa query nova e clica **Run** (aceita o aviso de "destrutivo", é trigger/função).
3. ✅ "Success. No rows returned".

---

## PARTE B — Pagamento Cakto funcionar · ~10 min

**B1. Segredo do webhook no Supabase**
1. No Cakto: Configurações → Webhooks → copie o **secret** do webhook.
2. No Supabase: **Edge Functions → aba Secrets** (ou Project Settings → Edge Functions) →
   **Add new secret** → nome `CAKTO_WEBHOOK_SECRET`, valor = o secret que você copiou.
3. ✅ O secret aparece listado (o valor fica oculto).

**B2. URL do webhook no Cakto**
1. No Cakto, no webhook, confirme a URL:
   `https://aefrcwysifgniogumxwk.supabase.co/functions/v1/cakto-webhook`
2. Eventos: pagamento aprovado + reembolso/estorno.

**B3. Redeploy do webhook** (pra valer as melhorias que fiz no código)
No terminal, dentro da pasta do projeto:
```
npx supabase login
npx supabase functions deploy cakto-webhook --project-ref aefrcwysifgniogumxwk --no-verify-jwt
```
✅ Termina com "Deployed Function cakto-webhook".
(Alternativa sem terminal: Supabase → Edge Functions → cakto-webhook → editor de código →
cola o conteúdo de `supabase/functions/cakto-webhook/index.ts` → Deploy.)

**B4. Conta bancária no Cakto**: cadastre pra poder sacar o dinheiro das vendas.

---

## PARTE C — Login funcionar (Supabase Auth) · ~1 min
1. Supabase → **Authentication → Providers → Email** (ou Sign In / Up).
2. Confirme que o usuário consegue logar logo após cadastrar (auto-confirm ligado).
   Se "Confirm email" estiver exigindo confirmação, ou liga o auto-confirm, ou
   configura o envio de e-mail de confirmação.
3. ✅ Teste real no item E.

---

## PARTE D — www com SSL (Vercel) · ~3 min
1. vercel.com → projeto **petsocial** → Settings → **Domains** → Add → `www.maestropet.com`.
2. Aceite a configuração sugerida (o SSL provisiona sozinho em alguns minutos).
3. ✅ Abrir https://www.maestropet.com cai no site com cadeado, sem aviso de segurança.

---

## PARTE E — Teste de ponta a ponta · ~5 min
1. Abra https://maestropet.com numa aba anônima → **Criar conta** (e-mail real seu).
   ✅ Loga direto (valida a Parte C).
2. Crie um pet, poste algo. ✅ Aparece no feed.
3. Vá em **Pet Pro → Assinar** → pague (Pix de teste ou valor real baixo).
   ✅ Em segundos a conta vira **Pro** (valida B1+B3). Se não virar, me chama que
   olhamos a tabela `cakto_events` juntos.

---

## PARTE F — Fiscal (gov.br) · quando puder
1. Tire o **MEI** (Portal do Empreendedor, grátis). Dá um **CNPJ** na hora.
2. Me manda o CNPJ → eu troco o CPF mascarado pelo CNPJ nos Termos.
3. Com CNPJ você passa a emitir **nota fiscal (NFS-e)** das vendas (exigência fiscal).

---

### Ordem sugerida
A1 → A2 → C → B1/B2/B3/B4 → E (teste) → D → F (quando der).
Me avisa quando terminar A e B que eu confiro o resultado com você.
