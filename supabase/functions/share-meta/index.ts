// @ts-nocheck — Deno edge function, types não resolvem em TS node config
/**
 * Edge function `share-meta` — HTML server-rendered pra crawlers de links.
 *
 * Por quê: o app é SPA com static export. Quando alguém compartilha um post
 * ou pet no WhatsApp/Twitter/Facebook/Slack/Discord, o crawler busca o HTML
 * inicial e lê <meta>. Pra rotas dinâmicas (/pet/{id}, /post/{id}) o HTML
 * shell não tem os og:* certos.
 *
 * Esta function recebe URLs canônicas /share/* e:
 *  1. Fetch os dados do recurso via service role
 *  2. Renderiza HTML com og:* + twitter:* + JSON-LD preenchidos
 *  3. Pra humanos: injeta JS que redireciona pro path SPA
 *  4. Pra crawlers: meta tags ficam disponíveis sem JS
 *
 * Rotas:
 *  - /share/pet/{petId}
 *  - /share/post/{postId}
 *  - /share/id/{idCardToken}   (carteirinha pública via QR)
 *
 * Deploy: `supabase functions deploy share-meta --no-verify-jwt`
 * Setup no Supabase:
 *  - vault.secrets:
 *    - PUBLIC_APP_URL: https://pet.social (ou domínio próprio)
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://pet.social';
const DEFAULT_IMAGE = `${APP_URL}/assets/assets/images/icon-512.png`;
const BRAND_ORANGE = '#F97316';
const BRAND_BG = '#FFFBF5';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// UAs de crawlers conhecidos. Lista não-exaustiva — basta cobrir os principais
// pra evitar o "redirect flicker" em previews.
const CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /twitterbot/i,
  /slackbot/i,
  /discordbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /skypeuripreview/i,
  /googlebot/i,
  /bingbot/i,
  /duckduckbot/i,
  /yandex/i,
  /baiduspider/i,
];

function isCrawler(userAgent: string): boolean {
  return CRAWLER_PATTERNS.some((p) => p.test(userAgent));
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    // URL chega como /functions/v1/share-meta/<path...> — extrair só o que importa
    const segments = url.pathname.split('/').filter(Boolean);
    // Procura "share" como entry point — robusto a vários path prefixes
    const shareIdx = segments.indexOf('share');
    const after = shareIdx >= 0 ? segments.slice(shareIdx + 1) : segments;
    const [kind, id] = after;

    if (!kind || !id) {
      return htmlResponse(notFoundHtml('Recurso não encontrado'), 404);
    }

    const ua = req.headers.get('user-agent') ?? '';
    const isBot = isCrawler(ua);

    let meta: PageMeta | null = null;
    let redirectPath: string;

    if (kind === 'pet') {
      meta = await fetchPetMeta(id);
      redirectPath = `/pet/${id}`;
    } else if (kind === 'post') {
      meta = await fetchPostMeta(id);
      redirectPath = `/post/${id}`;
    } else if (kind === 'id') {
      meta = await fetchIdCardMeta(id);
      redirectPath = `/id/${id}`;
    } else {
      return htmlResponse(notFoundHtml('Rota desconhecida'), 404);
    }

    if (!meta) {
      return htmlResponse(notFoundHtml('Conteúdo não encontrado'), 404);
    }

    const fullPath = redirectPath;
    const canonicalUrl = `${APP_URL}${fullPath}`;

    return htmlResponse(buildHtml(meta, canonicalUrl, redirectPath, isBot));
  } catch (err) {
    console.error('[share-meta] error', err);
    return htmlResponse(notFoundHtml('Erro ao carregar'), 500);
  }
});

// ============================================================================
// Data fetchers
// ============================================================================

interface PageMeta {
  title: string;
  description: string;
  image: string;
  ogType: 'article' | 'profile' | 'website';
  jsonLd?: object;
}

async function fetchPetMeta(petId: string): Promise<PageMeta | null> {
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, breed, bio, avatar_url')
    .eq('id', petId)
    .maybeSingle();
  if (error || !data) return null;

  const speciesLabel = speciesPt(data.species);
  const breedLine = data.breed ? `${speciesLabel} ${data.breed}` : speciesLabel;
  const description = data.bio
    ? truncate(data.bio, 160)
    : `${data.name} (${breedLine}) tem carteirinha digital, histórico de saúde e perfil no Pet Social. Crie a do seu pet grátis.`;

  return {
    title: `${data.name} (${breedLine}) · Pet Social`,
    description,
    image: data.avatar_url ?? DEFAULT_IMAGE,
    ogType: 'profile',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: data.name,
      description,
      image: data.avatar_url ?? undefined,
      url: `${APP_URL}/pet/${petId}`,
    },
  };
}

async function fetchPostMeta(postId: string): Promise<PageMeta | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      caption,
      created_at,
      pet:pets!inner(id, name, avatar_url, species, breed),
      media:post_media(url, media_type, position)
      `,
    )
    .eq('id', postId)
    .order('position', { foreignTable: 'post_media' })
    .maybeSingle();
  if (error || !data) return null;

  const pet = (data as { pet: { name: string; avatar_url: string | null } }).pet;
  const firstMedia = (data as { media: { url: string }[] }).media?.[0]?.url;
  const description = data.caption
    ? truncate(data.caption, 160)
    : `Post de ${pet.name} no Pet Social`;

  return {
    title: `${pet.name} no Pet Social`,
    description,
    image: firstMedia ?? pet.avatar_url ?? DEFAULT_IMAGE,
    ogType: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SocialMediaPosting',
      headline: description,
      datePublished: data.created_at,
      image: firstMedia ?? pet.avatar_url ?? undefined,
      author: { '@type': 'Person', name: pet.name },
      url: `${APP_URL}/post/${postId}`,
    },
  };
}

async function fetchIdCardMeta(token: string): Promise<PageMeta | null> {
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, breed, avatar_url, emergency_contact_phone, preferred_vet_phone')
    .eq('id_card_token', token)
    .maybeSingle();
  if (error || !data) return null;

  const speciesLabel = speciesPt(data.species);
  const breedLine = data.breed ? `${speciesLabel} ${data.breed}` : speciesLabel;
  const description = `Carteirinha digital de ${data.name} (${breedLine}). Toque pra contato em caso de emergência.`;

  return {
    title: `Carteirinha de ${data.name} · Pet Social`,
    description,
    image: data.avatar_url ?? DEFAULT_IMAGE,
    ogType: 'profile',
  };
}

// ============================================================================
// HTML rendering
// ============================================================================

function buildHtml(meta: PageMeta, canonicalUrl: string, spaPath: string, isBot: boolean): string {
  const jsonLdScript = meta.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`
    : '';

  // Pra humanos: meta-refresh + JS replace pra evitar voltar com Back button
  // Pra crawlers: skip o redirect (eles só leem meta tags)
  const redirectMeta = isBot
    ? ''
    : `
    <meta http-equiv="refresh" content="0;url=${escape(spaPath)}" />
    <script>
      if (typeof window !== 'undefined') {
        window.location.replace('${escape(spaPath)}');
      }
    </script>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escape(meta.title)}</title>
  <meta name="description" content="${escape(meta.description)}" />
  <link rel="canonical" href="${escape(canonicalUrl)}" />
  <meta name="theme-color" content="${BRAND_ORANGE}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <!-- Open Graph -->
  <meta property="og:type" content="${meta.ogType}" />
  <meta property="og:title" content="${escape(meta.title)}" />
  <meta property="og:description" content="${escape(meta.description)}" />
  <meta property="og:image" content="${escape(meta.image)}" />
  <meta property="og:url" content="${escape(canonicalUrl)}" />
  <meta property="og:site_name" content="Pet Social" />
  <meta property="og:locale" content="pt_BR" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escape(meta.title)}" />
  <meta name="twitter:description" content="${escape(meta.description)}" />
  <meta name="twitter:image" content="${escape(meta.image)}" />

  ${jsonLdScript}
  ${redirectMeta}
  <style>
    html, body { margin:0; padding:0; height:100%; background:${BRAND_BG}; font-family: -apple-system, sans-serif; }
    .container { min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; }
    .pulse { width:88px; height:88px; background:${BRAND_ORANGE}; border-radius:24px; display:flex; align-items:center; justify-content:center; font-size:44px; animation:pulse 1.4s infinite; }
    .text { font-size:14px; color:#525252; max-width:280px; text-align:center; line-height:1.5; }
    @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.05); } }
    a { color:${BRAND_ORANGE}; text-decoration:none; font-weight:600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="pulse">🐾</div>
    <p class="text">
      Abrindo Pet Social...
      <br />
      <noscript>JavaScript desativado? <a href="${escape(spaPath)}">Continuar</a></noscript>
    </p>
  </div>
</body>
</html>`;
}

function notFoundHtml(reason: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Não encontrado · Pet Social</title>
  <meta name="theme-color" content="${BRAND_ORANGE}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Não encontrado · Pet Social" />
  <meta property="og:description" content="Esse conteúdo não está mais disponível." />
  <meta property="og:image" content="${DEFAULT_IMAGE}" />
  <style>
    html, body { margin:0; padding:0; height:100%; background:${BRAND_BG}; font-family: -apple-system, sans-serif; }
    .container { min-height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:24px; text-align:center; }
    .icon { font-size:64px; }
    h1 { font-size:22px; margin:0; }
    p { color:#525252; max-width:360px; line-height:1.5; }
    a { display:inline-block; margin-top:8px; padding:10px 24px; background:${BRAND_ORANGE}; color:white; border-radius:999px; text-decoration:none; font-weight:700; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🐾</div>
    <h1>Conteúdo não encontrado</h1>
    <p>${escape(reason)}. Talvez tenha sido removido pelo tutor.</p>
    <a href="${APP_URL}">Ir pra Pet Social</a>
  </div>
</body>
</html>`;
}

// ============================================================================
// Helpers
// ============================================================================

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cache moderado pra reduzir DB hits — crawlers às vezes re-fetcham
      'cache-control': 'public, max-age=300, s-maxage=600',
      // CORS pra qualquer crawler
      'access-control-allow-origin': '*',
    },
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

function speciesPt(species: string): string {
  return (
    {
      dog: 'cachorro',
      cat: 'gato',
      bird: 'pássaro',
      rabbit: 'coelho',
      reptile: 'réptil',
      rodent: 'roedor',
      fish: 'peixe',
      other: 'pet',
    }[species] ?? 'pet'
  );
}
