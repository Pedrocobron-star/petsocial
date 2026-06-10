# 🚀 Deploy Maestro Pet — Web (Vercel) → PWA instalável no celular

Guia direto pra colocar o site no ar e ter o **banner "Instalar Maestro Pet"** aparecendo
no celular dos usuários — sem app store, sem EAS, sem burocracia.

---

## Caminho recomendado: deploy via dashboard (5 minutos)

### 1. Criar conta no Vercel
- https://vercel.com/signup
- Use sua conta GitHub pra agilizar (Login with GitHub)

### 2. Subir o código pro GitHub (se ainda não estiver)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/SEU-USER/petsocial.git
git push -u origin main
```

### 3. Importar no Vercel
1. https://vercel.com/new
2. **Import Git Repository** → escolha o repo `petsocial`
3. Vercel detecta automaticamente o `vercel.json` (já tem na raiz)
4. **NÃO clique em Deploy ainda** — primeiro as variáveis

### 4. Configurar Environment Variables

Em **Environment Variables**, adicione exatamente:

| Nome | Valor |
|------|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://aefrcwysifgniogumxwk.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | (copie do seu `.env` local) |

Marque **Production**, **Preview** e **Development** pra cada uma.

### 5. Deploy
- Clique **Deploy**
- Vercel roda `npx expo export --platform web` (definido em `vercel.json`)
- Saída em `dist/`, servida como SPA com rewrites
- ~3-5 minutos na primeira vez

### 6. Pegar a URL
Vai sair algo tipo `https://petsocial-xxx.vercel.app` — esse é seu site.

---

## Caminho alternativo: deploy via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

CLI pergunta as env vars na primeira vez. Próximos deploys são auto.

---

## Pós-deploy obrigatório

### 1. Configurar Supabase Auth pro novo domínio
Senão login com email-confirmation não volta pro lugar certo.

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. **Site URL**: `https://petsocial-xxx.vercel.app` (ou seu domínio custom)
3. **Redirect URLs** (adicione todas):
   - `https://petsocial-xxx.vercel.app`
   - `https://petsocial-xxx.vercel.app/**`
   - `https://petsocial-xxx.vercel.app/reset-password`

### 2. Deploy da edge function `share-meta` (OG previews ricos no WhatsApp/Twitter)

```bash
npm install -g supabase
supabase login
supabase link --project-ref aefrcwysifgniogumxwk
supabase functions deploy share-meta --no-verify-jwt
```

Setar secret opcional pra URL canônica:
```bash
supabase secrets set PUBLIC_APP_URL=https://petsocial-xxx.vercel.app
```

Depois disso, links tipo `https://petsocial-xxx.vercel.app/share/post/{id}` mostram preview
bonito quando compartilhados.

### 3. Push web (notificações no navegador/PWA, mesmo com o app fechado)

O app já tem todo o código (service worker, inscrição, edge function `send-web-push`,
cron de lembretes). Falta só ligar no Supabase:

```bash
# Deploy da function
supabase functions deploy send-web-push --no-verify-jwt

# Secrets VAPID (a pública já está no client; a privada é só sua)
supabase secrets set VAPID_PUBLIC_KEY=BGYcFqQLkmKMnuwWAhQNmoBnHUOQAFa-3aSkdTuMlCT5XRYvGOg_a4KYO7gLNjmf9K4hB41A56DQ5xc5ZTuX9XU
supabase secrets set VAPID_PRIVATE_KEY=<SUA_CHAVE_PRIVADA_VAPID>
supabase secrets set VAPID_SUBJECT=mailto:pedrocobron@gmail.com
```

**Lembretes automáticos diários** (opcional):
1. Dashboard → Database → Extensions: ligue `pg_cron` e `pg_net`.
2. No SQL editor, rode `supabase/push-reminders-cron.sql` + os 2 `ALTER DATABASE`
   comentados no topo dele (URL da function + service_role key).

**Testar:** app → Notificações → "Ativar push no navegador" → Permitir → "Enviar teste".
(A tabela `push_subscriptions` já foi criada.)

### 4. (Opcional) Domínio próprio
1. Compre em Registro.br (.com.br) ou Namecheap (.com)
2. Vercel → seu projeto → **Settings** → **Domains**
3. Adicione o domínio, configure os DNS conforme Vercel mostra
4. **VOLTE no Supabase** → atualize Site URL e Redirect URLs pra esse domínio

---

## Como testar PWA no celular

### Android (Chrome ou Edge)
1. Abra `https://petsocial-xxx.vercel.app` no celular
2. **Banner laranja aparece no topo**: "Instale o Maestro Pet"
3. Toque **Instalar** → confirma no popup do sistema → app vai pra home screen
4. Abre como app nativo, fullscreen, sem barra do browser

### iPhone (Safari)
1. Abra `https://petsocial-xxx.vercel.app` no Safari (não no Chrome)
2. **Banner aparece com "Como"** (Apple não tem API automática)
3. Toque "Como" → modal com 3 passos:
   - Toque no botão Compartilhar do Safari
   - Role pra baixo, escolha "Adicionar à Tela de Início"
   - Toque "Adicionar"
4. Ícone na home, abre como app

### Verificar PWA funcionando
1. https://web.dev/measure/ — cola sua URL
2. Score PWA deve estar > 90
3. **Manifest detected** + **Service Worker active** = OK

---

## Verificação pós-deploy (checklist)

- [ ] Site abre em `https://...vercel.app`
- [ ] Login/cadastro funcionam (email-confirmation chega)
- [ ] Cria pet → mostra na lista
- [ ] Posta foto → aparece no feed
- [ ] Saúde do pet → vacinas, sintomas, calendário renderizam
- [ ] Admin Dashboard só visível pra `pedrocobron@gmail.com`
- [ ] No celular, banner "Instalar" aparece
- [ ] Compartilha post via WhatsApp → preview com imagem aparece (depois de deploy do share-meta)
- [ ] `/robots.txt` carrega
- [ ] `/sitemap.xml` carrega

---

## Testar build local antes de deploy

```bash
npm run build:web     # gera dist/
npm run preview:web   # serve em http://localhost:3000
```

Se rodar local ok, vai rodar no Vercel.

---

## Recursos no Supabase que precisam estar OK

**Tabelas + RLS** (devem existir, todas com RLS habilitada):
- `profiles`, `pets`, `posts`, `post_media`, `comments`, `likes`, `follows`
- `vaccinations`, `parasite_treatments`, `vet_visits`, `medications`, `medication_logs`, `weight_records`
- `pet_symptoms`, `pet_diet_logs`, `pet_health_snapshots`
- `meetups`, `meetup_rsvps`
- `lost_reports`, `places`, `place_reviews`
- `notifications`, `conversations`, `messages`, `conversation_participants`
- `subscriptions`, `subscription_events`
- `pet_events`, `pet_event_logs`, `pet_caretakers`
- `ai_conversations`, `ai_messages`
- `memorial_messages`, `pet_milestones`, `blocked_users`, `reports`
- `app_errors`
- `recalls`, `vet_endorsements`, `pet_documents`, `pet_expenses`
- `offers`, `adoption_listings`, `push_subscriptions`
- (pets ganhou a coluna `sinpatinhas_id`)

**Storage buckets** (públicos):
- `avatars`
- `posts`
- `pet-symptoms`

**RPCs essenciais**:
- `export_my_data()` — LGPD export
- `delete_my_account()` — LGPD delete
- `admin_stats()` — admin dashboard
- `admin_latest_signups(int)` — admin dashboard

**Edge functions** (deploy após app):
- `share-meta` — OG previews
- `ai-pet-assistant` — chat IA (precisa OPENAI_API_KEY ou ANTHROPIC_API_KEY no secrets)
- `send-push` — push nativo (Expo, só nos apps de loja)
- `send-web-push` — push web/PWA (precisa secrets VAPID — ver seção Push web acima)
- `endorse_fetch` / `endorse_submit` / `caretaker_shared_pets` / `track_offer_click` — RPCs (já no banco)
- `create-checkout-session` + `stripe-webhook` — Pet Pro (opcional, só ativa quando ligar Stripe)

---

## Mobile nativo (iOS + Android nas lojas) — futuro

Quando quiser publicar nas stores de verdade (não só PWA):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview  # gera .apk pra teste
eas build --platform all --profile production
eas submit --platform android  # Play Store
eas submit --platform ios      # App Store ($99/ano Apple)
```

Hoje **não precisa** disso — o PWA via Vercel já dá experiência tipo app.

---

## Troubleshooting

**Build falha no Vercel com "Module not found"**:
- Confirma que `package-lock.json` está commitado
- Confirma que não tem dep em `devDependencies` que devia estar em `dependencies`

**Site carrega mas login não funciona**:
- Falta Site URL / Redirect URLs no Supabase Auth (passo 1 do pós-deploy)

**Compartilha no WhatsApp e não mostra preview bonito**:
- Faltou deploy da edge function `share-meta` (passo 2 do pós-deploy)
- Ou link tá apontando pra `/post/{id}` em vez de `/share/post/{id}` — `lib/share.ts` já corrige isso automaticamente

**Banner "Instalar" não aparece no celular**:
- Em Android Chrome: requer "engagement" mínimo (Chrome decide quando mostrar). Visite 2x ou aguarde 30s
- Em iPhone Safari: aparece sempre — se não aparece, dismiss anterior persistiu por 14d. Limpe localStorage.

**Erro `app_errors` ou outras tabelas inexistentes**:
- Algum migration não rodou. Veja `Recursos no Supabase` acima e crie a tabela faltante.
