// 外壳缓存版本：改动图标 / manifest.json / index.html 后必须递增，否则手机上收不到更新
// —— SHELL 里包含 '/'，SW 字节不变就不会重新安装，离线时永远拿旧壳。
// index.html 本身走 network-first，不受这个版本号影响。
var CACHE_NAME = 'ttd-shell-v3';

var SHELL = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE_NAME ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 实时数据：完全不拦截，直连网络。
  // 一旦缓存住 /api/*，你会看到一份永远不会更新的假数据。
  if (url.pathname.indexOf('/api/') === 0) return;

  // 导航请求走 network-first：联网时永远拿到最新页面，离线时回退到外壳。
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () { return caches.match('/'); })
    );
    return;
  }

  // 其余静态资源走 cache-first，未命中再联网并回填。
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
