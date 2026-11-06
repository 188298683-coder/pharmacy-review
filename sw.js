/* 药学复习台 Service Worker
 * 策略：
 *  - 页面导航（打开 App）：network-first —— 有网就取最新 HTML，断网回退缓存
 *  - 静态资源（图标/manifest）：stale-while-revalidate —— 先用缓存秒开，后台静默更新
 * 升版本号会触发旧缓存清理，改动图标/页面后记得 +1。
 */
const CACHE = 'pharmacy-pwa-v4';
const PRECACHE = ['./', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 去掉查询参数，统一缓存键（分享链接常带 ?ticket=... 访问参数）
  const key = url.origin + url.pathname;
  const isDoc = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isDoc) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const res = await fetch(req);
          if (res && res.status === 200) cache.put(key, res.clone());
          return res;
        } catch (err) {
          return (await cache.match(key)) || (await cache.match(url.origin + '/')) || Response.error();
        }
      })()
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
