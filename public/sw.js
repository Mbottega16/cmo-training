/* CMO Training service worker: lets the installed app open with no signal (for example in a gym).
 * Only this site's own files are cached. */
// Both filled in by the build (vite.config.ts): every script, style and font the pages need, and a cache name
// that changes whenever they do, so phones pick up new versions.
const CACHE = 'cmo-training-dev';
const BUILD_ASSETS = [];
const SAMPLE_VIDEO = './samples/pick-and-roll.mp4';
// The coach and athlete pages open offline once installed; the dev page needs the network.
const SHELL = ['./', './coach/', './athlete/', './coach.webmanifest', './athlete.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', SAMPLE_VIDEO];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...SHELL, ...BUILD_ASSETS])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Video players ask for byte ranges. Answer them from a cached full copy when there is one, else from the network. */
async function rangeResponse(request) {
  const cache = await caches.open(CACHE);
  const full = await cache.match(request.url, { ignoreVary: true });
  if (!full) return fetch(request);
  const buffer = await full.arrayBuffer();
  const size = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '');
  let start = 0;
  let end = size - 1;
  if (match && match[1]) {
    start = Number(match[1]);
    if (match[2]) end = Math.min(Number(match[2]), size - 1);
  } else if (match && match[2]) {
    start = Math.max(0, size - Number(match[2])); // "last N bytes"
  }
  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.headers.has('range')) {
    event.respondWith(rangeResponse(request).catch(() => fetch(request)));
    return;
  }

  // Pages: try the network first so updates show up, fall back to that page's saved copy offline.
  if (request.mode === 'navigate') {
    const pageKey = new URL(url.pathname.replace(/index\.html$/, ''), url.origin).href;
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(pageKey, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(pageKey)) || (await caches.match(new URL('./', self.registration.scope).href)))
    );
    return;
  }

  // Built files (scripts, styles, fonts) have a content hash in their name, so a saved copy is always correct.
  // ignoreVary: servers mark files "Vary: Origin", and module scripts are requested with an Origin header that the
  // pre-downloaded copies don't have. These are this site's own files, so the copy is right either way.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      cached =>
        cached ||
        fetch(request).then(response => {
          if (response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
