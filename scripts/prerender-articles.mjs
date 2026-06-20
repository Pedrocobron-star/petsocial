// ============================================================================
// Maestro Pet — Prerender SEO das matérias do Jornal (dist/ler/<slug>/index.html).
//
// POR QUE: com web.output 'single', TODA rota /ler/<slug> é servida pelo mesmo
// index.html da home (via rewrite), então cada matéria herda o título/descrição
// GENÉRICOS da home. Resultado: Google indexa todas as matérias com o mesmo
// título, e o preview de link (WhatsApp/FB, que NÃO roda JS) cai no card genérico.
//
// Este script pega o index.html já com OG (pós inject-og) e gera uma cópia POR
// matéria com <title>, description, og:*, twitter:* e JSON-LD Article PRÓPRIOS,
// em dist/ler/<slug>/index.html. A Vercel serve esse arquivo estático antes do
// rewrite, então crawler/unfurler vê o meta certo; o bundle do app continua no
// HTML e monta normalmente pro usuário (client-route pra matéria).
//
// Best-effort TOTAL: qualquer erro -> loga e sai com 0 (NUNCA quebra o build).
// Roda DEPOIS de inject-og + gen-sitemap (ver vercel.json buildCommand).
// ============================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://maestropet.com';
const FALLBACK_IMG = `${SITE}/icon-512.png`;

function attr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function stripToText(s) {
  return String(s ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // imagens markdown
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // links markdown
    .replace(/[#*_>`~|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const distDir = join(process.cwd(), 'dist');
  const distIndex = join(distDir, 'index.html');
  if (!existsSync(distIndex)) {
    console.warn('[prerender] dist/index.html não existe — pulando.');
    return;
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn('[prerender] sem EXPO_PUBLIC_SUPABASE_* — pulando.');
    return;
  }

  const home = readFileSync(distIndex, 'utf8');

  let articles = [];
  try {
    const endpoint = `${url}/rest/v1/news_articles?status=eq.published&select=slug,title,dek,cover_url,body,author_name,published_at,updated_at&order=published_at.desc&limit=2000`;
    const r = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) {
      console.warn('[prerender] REST falhou:', r.status);
      return;
    }
    articles = await r.json();
  } catch (e) {
    console.warn('[prerender] erro REST:', String(e).slice(0, 120));
    return;
  }

  let count = 0;
  for (const a of articles) {
    if (!a || !a.slug || !a.title) continue;
    try {
      const pageUrl = `${SITE}/ler/${a.slug}`;
      const title = `${a.title} · Jornal Pet · Maestro Pet`;
      const descRaw = a.dek && a.dek.trim() ? a.dek : stripToText(a.body).slice(0, 160);
      const desc = String(descRaw).slice(0, 200).trim();
      const img = a.cover_url && /^https?:\/\//.test(a.cover_url) ? a.cover_url : FALLBACK_IMG;

      let h = home;
      h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(title)}</title>`);
      h = h.replace(/(<meta name="description" content=")[^"]*(")/, `$1${attr(desc)}$2`);
      h = h.replace(/(<link rel="canonical" href=")[^"]*("\s*\/>)/, `$1${pageUrl}$2`);
      h = h.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${pageUrl}$2`);
      h = h.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1article$2`);
      h = h.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${attr(title)}$2`);
      h = h.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${attr(desc)}$2`);
      h = h.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${attr(img)}$2`);
      // dims fixas da home não valem pra capa variável
      h = h.replace(/\s*<meta property="og:image:width"[^>]*>/, '');
      h = h.replace(/\s*<meta property="og:image:height"[^>]*>/, '');
      h = h.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${attr(title)}$2`);
      h = h.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${attr(desc)}$2`);
      h = h.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${attr(img)}$2`);

      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: String(a.title).slice(0, 110),
        description: desc,
        image: img,
        datePublished: a.published_at || undefined,
        dateModified: a.updated_at || a.published_at || undefined,
        author: { '@type': 'Organization', name: a.author_name || 'Redação Maestro Pet' },
        publisher: {
          '@type': 'Organization',
          name: 'Maestro Pet',
          logo: { '@type': 'ImageObject', url: FALLBACK_IMG },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
      };
      const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');
      h = h.replace('</head>', `    <script type="application/ld+json">${ldJson}</script>\n  </head>`);

      const dir = join(distDir, 'ler', a.slug);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.html'), h, 'utf8');
      count++;
    } catch (e) {
      console.warn(`[prerender] falhou ${a.slug}:`, String(e).slice(0, 100));
    }
  }
  console.log(`[prerender] ${count}/${articles.length} matérias geradas em dist/ler/<slug>/index.html`);
}

try {
  await main();
} catch (e) {
  console.warn('[prerender] erro geral (ignorado):', String(e).slice(0, 160));
}
