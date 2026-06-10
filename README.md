# Maestro Pet 🐾

Rede social para pets — Instagram-like, com perfis de pets, posts (fotos/vídeos), encontros (meetups) e follows entre pets.

Stack:

- **Expo SDK 54** (React Native + Expo Router)
- **React 19** • TypeScript • NativeWind v4 (Tailwind CSS)
- **Supabase** (Postgres + Auth + Storage + RLS)
- **TanStack Query** (cache de dados) • Zod (validação) • date-fns

Roda em **iOS**, **Android** e **Web** com o mesmo código.

---

## 1. Pré-requisitos

- Node.js LTS (já instalado se você seguiu o setup inicial)
- Conta gratuita no [supabase.com](https://supabase.com)
- (Opcional) **Expo Go** no celular pra testar mobile — baixe na App Store / Play Store
- (Opcional) **EAS CLI** se quiser gerar builds pras lojas

## 2. Configurar o Supabase

1. Acesse [app.supabase.com](https://app.supabase.com) e crie um novo projeto (escolha um nome, senha do banco e região mais próxima).
2. Aguarde o projeto provisionar (~1 minuto).
3. No menu lateral, abra **SQL Editor** → **New query**.
4. Cole o conteúdo inteiro de [`supabase/schema.sql`](supabase/schema.sql) e clique **Run**.
   - Isso cria todas as tabelas, índices, triggers, RLS policies e os 2 buckets de storage (`avatars` e `posts`).
5. No menu lateral, vá em **Project Settings → API**. Copie:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - **anon public** key (a chave que começa com `eyJ...`)

## 3. Configurar variáveis de ambiente

Na raiz do projeto, crie um `.env` (copie do `.env.example`):

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> Importante: as variáveis precisam começar com `EXPO_PUBLIC_` pra serem expostas ao app.

## 4. Rodar o app

```bash
# instalar dependências (se ainda não rodou)
npm install

# web (abre no navegador)
npm run web

# Android (precisa do Expo Go ou emulador)
npm run android

# iOS (precisa de macOS pra build local, ou Expo Go via QR code)
npm run ios

# Modo geral — mostra QR code pra Expo Go + opções
npm start
```

Para o app rodar no celular: instale o **Expo Go** e escaneie o QR code que aparece no terminal.

## 5. Estrutura do projeto

```
app/
├── _layout.tsx                # Providers (Session, QueryClient)
├── index.tsx                  # Redirect inicial
├── (auth)/
│   ├── sign-in.tsx
│   └── sign-up.tsx
└── (app)/                     # Tudo aqui exige autenticação
    ├── _layout.tsx            # Auth guard + ActivePetProvider
    ├── onboarding.tsx         # Cadastra primeiro pet
    ├── (tabs)/
    │   ├── index.tsx          # Feed
    │   ├── meetups.tsx        # Lista de encontros
    │   ├── create.tsx         # Criar post
    │   └── profile.tsx        # Perfil do tutor + pets
    ├── pet/[id].tsx           # Perfil de outro pet
    ├── pet/new.tsx            # Adicionar pet
    ├── post/[id].tsx          # Detalhe + comentários
    ├── meetup/[id].tsx        # Detalhe do encontro
    └── meetup/new.tsx         # Criar encontro

components/                    # UI compartilhada
├── ui/                        # Button, Input, Screen, TextArea
├── pet-avatar.tsx
├── pet-form.tsx               # Form de criar/editar pet
├── pet-picker.tsx             # Seletor horizontal de pets ativos
├── post-card.tsx
├── meetup-card.tsx
└── empty-state.tsx

lib/
├── supabase.ts                # Client
├── types.ts                   # Tipos do banco
├── queries.ts                 # Funções de fetch + mutations
├── storage.ts                 # Upload de mídia
├── validators.ts              # Schemas Zod
└── constants.ts               # Espécies, helpers

providers/
├── session-provider.tsx       # Auth do Supabase
├── query-provider.tsx         # TanStack Query
└── active-pet-provider.tsx    # Qual pet do tutor está "ativo"

supabase/
└── schema.sql                 # Schema completo (cole no SQL Editor)
```

## 6. Conceitos do app

- **Tutor**: a conta de autenticação. Cada usuário do Supabase Auth tem 1 `profile`.
- **Pet**: perfil público vinculado ao tutor. Um tutor pode ter vários pets. O **active pet** é o pet que está postando/curtindo/seguindo no momento (você troca pelo seletor no topo do feed).
- **Posts**: foto ou vídeo (até 60s), com legenda opcional. Cada post pertence a um pet.
- **Follows**: pet segue pet (não tutor).
- **Likes/Comentários**: pet curte/comenta, não o tutor.
- **Encontros (meetups)**: um pet (host) cria um evento com local, data e descrição. Outros pets confirmam presença (RSVP).

## 7. Próximos passos sugeridos (v2)

- Posts em colab (multi-pet)
- Stories
- Chat direto entre tutores
- Mapa de locais pet-friendly
- Carteira de vacinação
- Notificações push

## 8. Comandos úteis

```bash
npm run lint           # ESLint
npx tsc --noEmit       # Typecheck
```

## 9. Deploy (quando quiser publicar)

- **Web**: `npx expo export --platform web` → publique a pasta `dist` em Vercel, Netlify, Cloudflare Pages.
- **Mobile**: instale EAS CLI (`npm i -g eas-cli`), faça `eas login` e `eas build --platform all`. Veja [docs.expo.dev/build](https://docs.expo.dev/build/introduction/).
