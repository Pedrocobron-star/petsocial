/**
 * Maestro Pet — Service Worker
 *
 * Estratégia:
 *  - Cache-first pra assets estáticos (fontes, ícones, JS/CSS bundle)
 *  - Network-first pra navegação HTML (sempre tenta versão fresca, fallback cache)
 *  - Network-first pra API Supabase (não cacheia POST/PATCH/DELETE; GETs leves opcionais)
 *  - Fallback /offline.html quando nem rede nem cache têm a resposta
 *
 * Bump CACHE_VERSION ao mudar assets — força refresh do cache.
 */

const CACHE_VERSION = 'pet-social-v210';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ----- INSTALL -----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined)),
  );
  self.skipWaiting();
});

// ----- ACTIVATE -----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// ----- FETCH -----
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Pula non-GET (auth, mutations)
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Pula Supabase API + auth (precisa estar sempre fresh)
  if (url.host.endsWith('supabase.co')) return;

  // Pula extensions
  if (url.protocol.startsWith('chrome-extension')) return;

  // HTML navigation: network-first, fallback cache, fallback /offline.html
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Atualiza cache em background
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html')),
        ),
    );
    return;
  }

  // Assets estáticos: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Só cacheia 200 OK
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});

// ----- PUSH (Web Push API) -----
// Payload esperado (JSON): { title, body, url, icon, tag }
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Maestro Pet', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Maestro Pet 🐾';
  const options = {
    body: data.body || '',
    // icon = imagem grande colorida do Mozart (aparece na notificação expandida)
    icon: data.icon || '/icon-192.png',
    // badge = ícone pequeno da barra de status. O Android FORÇA monocromático:
    // precisa ser silhueta branca em fundo transparente (senão vira quadrado branco).
    badge: '/badge-96.png',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag,
    // vibrate sinaliza notificação "ruidosa" → o Android mostra como HEADS-UP
    // (balão que pula na tela) + vibra, em vez de cair silenciosa na gaveta.
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ----- NOTIFICATION CLICK -----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});

// Mensagem do app pra forçar reload do SW (usado em deploy)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
