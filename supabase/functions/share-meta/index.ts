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
const APP_URL = Deno.env.get('PUBLIC_APP_URL') ?? 'https://maestropet.com';
const DEFAULT_IMAGE = `${APP_URL}/icon-512.png`;
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

    // sitemap.xml — descoberta de URLs pro Google (rewrite /sitemap.xml ->
    // .../share-meta/sitemap). Gateado em shareIdx<0 pra NÃO colidir com uma
    // matéria de slug 'sitemap' (/share/news/sitemap tem segmento 'share').
    const last = segments[segments.length - 1] ?? '';
    if (shareIdx < 0 && (last === 'sitemap' || last === 'sitemap.xml')) {
      return await sitemapResponse();
    }
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
    } else if (kind === 'news') {
      meta = await fetchNewsMeta(id);
      redirectPath = `/ler/${id}`; // leitor público (sem login)
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
  /** HTML do conteudo visivel (so pra crawler): corpo da materia renderizado.
   *  Sem isso o crawler so ve <meta> + a tela "Abrindo..." (zero texto indexavel). */
  articleHtml?: string;
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
    : `${data.name} (${breedLine}) tem carteirinha digital, histórico de saúde e perfil no Maestro Pet. Crie a do seu pet grátis.`;

  return {
    title: `${data.name} (${breedLine}) · Maestro Pet`,
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
    : `Post de ${pet.name} no Maestro Pet`;

  return {
    title: `${pet.name} no Maestro Pet`,
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
  // NÃO buscar telefones aqui — o HTML/OG não os usa, e fetchá-los só cria risco
  // de vazamento de PII de terceiro num futuro edit da description (least-privilege).
  // O token vive em pet_private (saiu de pets pra fechar o vazamento de PII).
  // Service role ignora RLS — resolve token -> pet_id, depois a base em pets.
  const { data: priv } = await supabase
    .from('pet_private')
    .select('pet_id')
    .eq('id_card_token', token)
    .maybeSingle();
  if (!priv) return null;
  const { data, error } = await supabase
    .from('pets')
    .select('id, name, species, breed, avatar_url')
    .eq('id', priv.pet_id)
    .maybeSingle();
  if (error || !data) return null;

  const speciesLabel = speciesPt(data.species);
  const breedLine = data.breed ? `${speciesLabel} ${data.breed}` : speciesLabel;
  const description = `Carteirinha digital de ${data.name} (${breedLine}). Toque pra contato em caso de emergência.`;

  return {
    title: `Carteirinha de ${data.name} · Maestro Pet`,
    description,
    image: data.avatar_url ?? DEFAULT_IMAGE,
    ogType: 'profile',
  };
}

async function fetchNewsMeta(slug: string): Promise<PageMeta | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select(
      'slug, title, dek, cover_url, cover_caption, body, published_at, updated_at, author_name, status',
    )
    .eq('slug', slug)
    .eq('status', 'published') // service role ignora RLS — só compartilha publicadas
    .maybeSingle();
  if (error || !data) return null;

  const description = data.dek ? truncate(data.dek, 160) : `Leia no Jornal Pet do Maestro Pet.`;

  return {
    title: `${data.title} · Maestro Pet`,
    description,
    image: data.cover_url ?? DEFAULT_IMAGE,
    ogType: 'article',
    articleHtml: renderArticleHtml({
      title: data.title,
      dek: data.dek,
      coverUrl: data.cover_url,
      coverCaption: data.cover_caption,
      body: data.body ?? '',
      authorName: data.author_name ?? 'Redação Maestro Pet',
      publishedAt: data.published_at,
      slug,
    }),
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: data.title,
      description,
      image: data.cover_url ?? undefined,
      datePublished: data.published_at ?? undefined,
      dateModified: data.updated_at ?? data.published_at ?? undefined,
      author: { '@type': 'Organization', name: data.author_name ?? 'Maestro Pet' },
      publisher: {
        '@type': 'Organization',
        name: 'Maestro Pet',
        logo: { '@type': 'ImageObject', url: DEFAULT_IMAGE },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${APP_URL}/ler/${slug}` },
      url: `${APP_URL}/ler/${slug}`,
    },
  };
}

/**
 * Renderiza o corpo da matéria como HTML semântico (só pro crawler ler). Espelha
 * o parser do client (components/news/article-body.tsx): bloco que é só uma
 * imagem markdown ![legenda](url) vira <figure>; o resto vira <p>. Tudo escapado.
 */
function renderArticleHtml(a: {
  title: string;
  dek: string | null;
  coverUrl: string | null;
  coverCaption: string | null;
  body: string;
  authorName: string;
  publishedAt: string | null;
  slug: string;
}): string {
  const IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/;
  const blocks = (a.body || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .map((b) => {
      const m = b.match(IMG_RE);
      if (m) {
        const cap = (m[1] ?? '').trim();
        return `<figure><img src="${escape(m[2])}" alt="${escape(cap)}" loading="lazy" />${
          cap ? `<figcaption>${escape(cap)}</figcaption>` : ''
        }</figure>`;
      }
      return `<p>${escape(b)}</p>`;
    })
    .join('\n');

  const cover = a.coverUrl
    ? `<figure><img src="${escape(a.coverUrl)}" alt="${escape(a.title)}" />${
        a.coverCaption ? `<figcaption>${escape(a.coverCaption)}</figcaption>` : ''
      }</figure>`
    : '';
  const dek = a.dek ? `<p class="dek">${escape(a.dek)}</p>` : '';
  const byline = `<p class="byline">Por ${escape(a.authorName)}${
    a.publishedAt ? ` · <time datetime="${escape(a.publishedAt)}">${escape(a.publishedAt.slice(0, 10))}</time>` : ''
  }</p>`;

  return `<article>
    <h1>${escape(a.title)}</h1>
    ${dek}
    ${byline}
    ${cover}
    ${blocks}
    <p class="cta"><a href="/ler/${escape(a.slug)}">Leia no Maestro Pet — crie sua conta grátis 🐾</a></p>
  </article>`;
}

// ============================================================================
// HTML rendering
// ============================================================================

function buildHtml(meta: PageMeta, canonicalUrl: string, spaPath: string, isBot: boolean): string {
  const jsonLdScript = meta.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd).replace(/</g, '\\u003c')}</script>`
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
  <meta property="og:site_name" content="Maestro Pet" />
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
    .article { max-width:680px; margin:0 auto; padding:24px 18px 64px; color:#1A1410; line-height:1.6; }
    .article h1 { font-size:30px; line-height:1.2; margin:0 0 12px; }
    .article .dek { font-size:18px; color:#525252; margin:0 0 12px; }
    .article .byline { font-size:13px; color:#737373; margin:0 0 18px; }
    .article p { font-size:17px; margin:0 0 16px; }
    .article figure { margin:0 0 16px; }
    .article img { width:100%; height:auto; border-radius:12px; }
    .article figcaption { font-size:13px; color:#737373; font-style:italic; text-align:center; margin-top:6px; }
    .article .cta a { display:inline-block; margin-top:8px; }
  </style>
</head>
<body>
  ${
    isBot && meta.articleHtml
      ? `<main class="article">${meta.articleHtml}</main>`
      : `<div class="container">
    <div class="pulse">🐾</div>
    <p class="text">
      Abrindo Maestro Pet...
      <br />
      <noscript>JavaScript desativado? <a href="${escape(spaPath)}">Continuar</a></noscript>
    </p>
  </div>`
  }
</body>
</html>`;
}

function notFoundHtml(reason: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Não encontrado · Maestro Pet</title>
  <meta name="theme-color" content="${BRAND_ORANGE}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="Não encontrado · Maestro Pet" />
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
    <a href="${APP_URL}">Ir pra Maestro Pet</a>
  </div>
</body>
</html>`;
}

// ============================================================================
// Sitemap
// ============================================================================

/**
 * sitemap.xml — só URLs PÚBLICAS (indexáveis sem login): a home + cada matéria
 * publicada em /ler/<slug>. NÃO inclui o portal /news nem /news/category|tag
 * (essas rotas estão atrás do gate de auth → Google só veria o redirect).
 */
async function sitemapResponse(): Promise<Response> {
  // Rotas estaticas marketing/legais (espelha o public/sitemap.xml antigo, que
  // sera removido quando esta edge estiver no ar).
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${APP_URL}/` },
    { loc: `${APP_URL}/welcome` },
    { loc: `${APP_URL}/pro` },
    { loc: `${APP_URL}/legal/about` },
    { loc: `${APP_URL}/legal/terms` },
    { loc: `${APP_URL}/legal/privacy` },
    { loc: `${APP_URL}/legal/faq` },
  ];
  try {
    const { data } = await supabase
      .from('news_articles')
      .select('slug, updated_at, published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(5000);
    for (const a of data ?? []) {
      const lm = (a.updated_at ?? a.published_at ?? '').slice(0, 10);
      urls.push({ loc: `${APP_URL}/ler/${a.slug}`, lastmod: lm || undefined });
    }
  } catch (e) {
    console.error('[share-meta] sitemap error', e);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${escape(u.loc)}</loc>${u.lastmod ? `<lastmod>${escape(u.lastmod)}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=3600',
      'access-control-allow-origin': '*',
    },
  });
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
