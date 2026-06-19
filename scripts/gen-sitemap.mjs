// ============================================================================
// Maestro Pet — Gera dist/sitemap.xml no build, listando as matérias publicadas.
//
// POR QUE: o sitemap estático antigo só tinha rotas de marketing/legal, e o
// sitemap dinâmico da edge voltava vazio. Sem as matérias no sitemap, o Google
// não descobre o Jornal Pet. Aqui buscamos as matérias publicadas via REST
// (anon — RLS já libera status='published') e escrevemos um sitemap completo.
//
// Best-effort: se faltar env ou a REST falhar, escreve só as rotas estáticas
// (nunca quebra o build). Roda DEPOIS do expo export (ver build:web/vercel.json).
// ============================================================================

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://maestropet.com';
// Rotas públicas que merecem indexação (a home, vitrine, jornal e legais).
const STATIC_PATHS = [
  '/',
  '/pro',
  '/noticias',
  '/legal/about',
  '/legal/faq',
  '/legal/terms',
  '/legal/privacy',
];

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function fetchArticles() {
  if (!url || !key) {
    console.warn('[sitemap] sem EXPO_PUBLIC_SUPABASE_* — gerando só rotas estáticas.');
    return [];
  }
  try {
    const endpoint = `${url}/rest/v1/news_articles?status=eq.published&select=slug,published_at,updated_at&order=published_at.desc&limit=2000`;
    const r = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) {
      console.warn('[sitemap] REST falhou:', r.status);
      return [];
    }
    return await r.json();
  } catch (e) {
    console.warn('[sitemap] erro ao buscar matérias:', String(e).slice(0, 120));
    return [];
  }
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const distDir = join(process.cwd(), 'dist');
if (!existsSync(distDir)) {
  console.error('[sitemap] dist/ não existe — rodou o expo export antes?');
  process.exit(0);
}

const articles = await fetchArticles();
const entries = [
  ...STATIC_PATHS.map((p) => ({ loc: SITE + p, lastmod: null, priority: p === '/' ? '1.0' : '0.7' })),
  ...articles
    .filter((a) => a && a.slug)
    .map((a) => ({
      loc: `${SITE}/ler/${a.slug}`,
      lastmod: (a.updated_at || a.published_at || '').slice(0, 10) || null,
      priority: '0.6',
    })),
];

const body = entries
  .map(
    (u) =>
      `  <url><loc>${xmlEscape(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(distDir, 'sitemap.xml'), xml, 'utf8');
console.log(`[sitemap] ${entries.length} URLs (${articles.length} matérias) em dist/sitemap.xml`);
