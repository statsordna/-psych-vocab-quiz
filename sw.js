const CACHE = 'psych-vocab-v4';
const SHELL = ['./', 'index.html', 'app.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // glossary.json: 네트워크 우선(매일 업데이트 반영), 실패 시 캐시
  if (url.pathname.endsWith('glossary.json')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('glossary.json', copy));
        return res;
      }).catch(() => caches.match('glossary.json'))
    );
    return;
  }

  // 앱 셸: 캐시 우선
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
