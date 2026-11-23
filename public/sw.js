// v1.3 weak-network mode: the patient app opens without internet.
// - The app's own files (the "shell") are kept on the phone and refreshed whenever the network works.
// - Network first, with a short wait: on a slow connection the saved copy is shown instead of a blank page.
// - Never stored: /api/* (answers, Kendras, prices come fresh from the Worker), staff and developer pages.
// VERSION must equal APP_VERSION in worker/src/index.js (test/offline.test.mjs checks it): a new
// version installs a fresh copy of every shell file at once and removes the old copy.
const VERSION = '2.0.8';
const CACHE = `ssm-shell-${VERSION}`;
const SHELL = [
  '/', '/app.js', '/rules.js', '/strings.js', '/styles.css', '/envbanner.js', '/chat.js', '/suggest.js',
  '/manifest.webmanifest', '/icon-128.png', '/icon-256.png', '/assets/SamaSalt-Mitra-Wordmark.svg',
];
const WAIT_MS = 4000; // slower than this: use the saved copy (and keep saving the fresh one in the background)

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ssm-shell-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Which requests the saved copy may answer: the patient app's own files only.
function shellKey(url) {
  if (url.origin !== self.location.origin) return null;
  if (url.pathname === '/' || url.pathname === '/index.html') return '/'; // ?lang, ?k, ?dev: same page
  return SHELL.includes(url.pathname) ? url.pathname : null;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const key = shellKey(new URL(req.url));
  if (!key) return; // the browser handles it as usual
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone()).catch(() => {});
      return res;
    });
    const saved = await cache.match(key);
    if (!saved) return net; // first visit: network only
    e.waitUntil(net.catch(() => {}));
    const late = new Promise((ok) => setTimeout(() => ok(null), WAIT_MS));
    try {
      return (await Promise.race([net, late])) || saved;
    } catch {
      return saved; // offline
    }
  })());
});
