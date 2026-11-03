/* CMO Training service worker: lets the installed app open with no signal (for example in a gym).
 * Only this site's own files are cached. */
const CACHE = 'cmo-training-v4';
const SAMPLE_VIDEO = './samples/pick-and-roll.mp4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png', SAMPLE_VIDEO];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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
  const full = await cache.match(request.url);
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

  // Pages: try the network first so updates show up, fall back to the saved copy offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Built files (scripts, styles, fonts) have a content hash in their name, so a saved copy is always correct.
  event.respondWith(
    caches.match(request).then(
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
