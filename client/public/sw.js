// Service Worker - AI Schedule PWA
const CACHE_NAME = 'ai-schedule-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/heyheylogo.png'
];

// 설치: 앱 셸 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 정리
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: 네트워크 우선, 캐시 폴백
self.addEventListener('fetch', (event) => {
  // API 요청은 캐시하지 않음
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공 응답만 캐시
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// 메시지: 뱃지 업데이트
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BADGE') {
    const count = event.data.count;
    if (navigator.setAppBadge) {
      if (count > 0) {
        navigator.setAppBadge(count);
      } else {
        navigator.clearAppBadge();
      }
    }
  }
});
