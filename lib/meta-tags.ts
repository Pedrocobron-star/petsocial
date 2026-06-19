/**
 * Helpers pra atualizar meta tags em runtime (Web only).
 *
 * Por que runtime: o app é SPA com static export. Scrapers que NÃO executam JS
 * (Facebook, Twitter, LinkedIn) verão os defaults injetados em `app/+html.tsx`.
 * Scrapers modernos (Discord, Telegram, alguns crawlers do Google) executam JS
 * suficiente pra pegar os meta tags atualizados aqui.
 *
 * Pra share perfeito em todos os scrapers, idealmente teríamos SSR — fica como
 * próximo passo se OG performance importar muito.
 */

const DEFAULTS = {
  title: 'Maestro Pet · Saúde do pet + comunidade · App grátis',
  description:
    'Calendário de vacinas, registro de sintomas, carteirinha digital e a comunidade pet do Brasil. Grátis pra cuidar do seu cachorro, gato, coelho e mais.',
  image: '/icon-512.png',
};

export interface MetaTagsInput {
  /** Document title E og:title E twitter:title. */
  title?: string;
  /** og:description E twitter:description E <meta name="description">. */
  description?: string;
  /** og:image E twitter:image. */
  image?: string | null;
  /** og:type: 'website' (default) ou 'article' / 'profile'. */
  type?: 'website' | 'article' | 'profile';
  /**
   * URL canônica deste recurso. Quando omitido, usa window.location.href.
   * Use quando o conteúdo aparece em múltiplas URLs (ex: /pet/{id} também
   * acessível via /share/pet/{id}) e queremos colapsar pra uma única
   * referência no Google.
   */
  canonicalUrl?: string;
  /**
   * Objeto schema.org pra injetar como <script type="application/ld+json">.
   * Melhora rich results no Google + reuso por scrapers semânticos.
   */
  jsonLd?: Record<string, unknown>;
}

/** Atualiza document title + meta tags. No-op em native. */
export function setMetaTags(input: MetaTagsInput): void {
  if (typeof document === 'undefined') return;

  const title = input.title ?? DEFAULTS.title;
  const description = input.description ?? DEFAULTS.description;
  const image = absoluteUrl(input.image ?? DEFAULTS.image);
  const type = input.type ?? 'website';
  const canonical = input.canonicalUrl ?? window.location.href;

  document.title = title;

  setMeta('description', description);
  setOg('og:title', title);
  setOg('og:description', description);
  setOg('og:image', image);
  setOg('og:type', type);
  setOg('og:url', canonical);

  setName('twitter:card', 'summary_large_image');
  setName('twitter:title', title);
  setName('twitter:description', description);
  setName('twitter:image', image);

  setCanonical(canonical);
  setJsonLd(input.jsonLd ?? null);
}

/** Reseta tudo pros defaults — usar em telas genéricas (feed, tabs). */
export function resetMetaTags(siteSuffix?: string): void {
  setMetaTags({
    title: siteSuffix ? `${siteSuffix} · Maestro Pet` : DEFAULTS.title,
    description: DEFAULTS.description,
    image: DEFAULTS.image,
    type: 'website',
  });
}

// ---- internals ----

function absoluteUrl(maybeRelative: string): string {
  if (typeof window === 'undefined') return maybeRelative;
  if (/^https?:\/\//.test(maybeRelative)) return maybeRelative;
  return new URL(maybeRelative, window.location.origin).toString();
}

function setMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setOg(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const JSON_LD_ID = '__petsocial_jsonld';

function setJsonLd(data: Record<string, unknown> | null): void {
  // Remove any previous JSON-LD inserted by us
  document.getElementById(JSON_LD_ID)?.remove();
  if (!data) return;
  const el = document.createElement('script');
  el.id = JSON_LD_ID;
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}
