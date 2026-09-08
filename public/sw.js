// Service Worker：网络优先（保证用户第一时间拿到新版本），断网时回退缓存（离线可看）
// 2026-09-08 重写：旧版纯缓存优先导致更新永远到不了用户手上
const CACHE_NAME = 'hotel-sim-v2'
const PRECACHE = ['/', '/index.html', '/manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  // 网络优先：成功就返回最新并把副本写入缓存；失败（离线）回退缓存
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
      }
      return response
    }).catch(() =>
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        // 导航请求离线兜底到 index.html（SPA 单页）
        if (event.request.mode === 'navigate') return caches.match('/index.html')
        return Response.error()
      })
    )
  )
})
