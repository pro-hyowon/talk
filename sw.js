// 끼리톡 서비스 워커 — 앱 화면 캐시(오프라인에서도 열림) + 푸시 알림 수신·클릭 처리
const CACHE = 'kkiritalk-v1.29';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/api.js',
  './js/config.js',
  './js/icons.js',
  './js/stickers.js',
  './js/qr.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './sounds/kkitok.mp3',          // v1.23: 끼톡 알림음
  './sounds/kkitok-melody.mp3',
  './js/vendor/supabase.js',      // v1.28: 외부 CDN 대신 앱에 포함
  './fonts/GmarketSansMedium.woff2',
  './fonts/GmarketSansBold.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 같은 사이트 파일: 항상 최신을 먼저 받고, 안 되면(오프라인) 캐시 사용
  //   v1.27: 신호가 약해 4초 넘게 응답이 없으면 저장해 둔 것을 먼저 보여 줌 (첫 화면에서 멈춰 있지 않게)
  if (url.origin === self.location.origin) {
    const net = fetch(req).then((res) => {
      if (res.ok && !res.redirected) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    });
    const fallback = () => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'));
    e.respondWith(new Promise((resolve) => {
      let done = false;
      const finish = (r) => { if (!done) { done = true; resolve(r); } };
      const t = setTimeout(() => { caches.match(req, { ignoreSearch: true }).then((hit) => { if (hit) finish(hit); }); }, 4000);
      net.then((res) => { clearTimeout(t); finish(res); }).catch(() => { clearTimeout(t); finish(fallback()); });
    }));
    return;
  }

  // 그 외(Supabase 서버 통신 등)는 건드리지 않음 (v1.28: 글꼴·라이브러리는 이제 앱에 포함 — 외부 CDN 없음)
});

// 서버에서 보낸 알림(Web Push) 받기
const isAppleWebKit = /Safari/.test(self.navigator.userAgent) && !/Chrome|Chromium|CriOS|Android|Edg/.test(self.navigator.userAgent);

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    // 앱 화면을 보고 있으면 앱 안의 알림으로 충분 (아이폰은 규정상 항상 표시)
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!isAppleWebKit && wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(d.title || '끼리톡', {
      body: d.body || '새 메시지가 도착했습니다.',
      tag: d.tag || 'minitalk',
      renotify: true,
      icon: './icons/icon-192.png',
      badge: './icons/badge-72.png',
      data: { url: d.url || './' },
    });
  })());
});

// 브라우저가 알림 구독을 갱신했을 때: 새로 구독하고 열린 앱에 알려 서버에 다시 저장
self.addEventListener('pushsubscriptionchange', (e) => {
  const opts = e.oldSubscription && e.oldSubscription.options;
  if (!opts) return;
  e.waitUntil(
    self.registration.pushManager.subscribe(opts)
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((wins) => wins.forEach((w) => w.postMessage({ type: 'resubscribed' })))
      .catch(() => {}),
  );
});

// 알림을 누르면 앱을 열고 해당 대화방으로 이동
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const hash = new URL(target).hash;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        await w.focus();
        w.postMessage({ type: 'open', hash });
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
