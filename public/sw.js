// Service Worker：网络优先；离线时**只对导航/静态资源**回退缓存。
// ★ V129-R109-3：API（/rest /auth /realtime）**永不复用缓存** —— 断网时必须 reject，
//   否则会"假活着"（界面像在线、登录报密码错，实际是缓存里的旧响应）。
// 缓存版本随构建变化（__BUILD_VERSION__ 由 vite.config.js 在 build 时替换）。
const CACHE_NAME = 'hotel-sim-__BUILD_VERSION__'
const PRECACHE = ['/', '/index.html', '/manifest.json']
const API_RE = /^\/(rest|auth|realtime)(\/|$)/

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
  const req = event.request
  if (req.method !== 'GET') return

  // ★ API 一律走网络：不 respondWith ⇒ 断网时浏览器直接 reject（绝不给缓存响应）
  let pathname = ''
  try { pathname = new URL(req.url).pathname } catch (e) { pathname = '' }
  if (API_RE.test(pathname)) return

  // 网络优先：成功就返回最新并写缓存；失败只允许「导航 / 静态资源」回退
  event.respondWith(
    fetch(req).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone))
      }
      return response
    }).catch(() => {
      // 导航：离线兜底到缓存的页面（SPA）
      if (req.mode === 'navigate') {
        return caches.match(req).then((cached) => cached || caches.match('/index.html'))
      }
      // 静态资源：允许用缓存（否则离线页面连 JS/CSS 都加载不了）
      const dest = req.destination || ''
      if (['script', 'style', 'image', 'font', 'manifest'].includes(dest)) {
        return caches.match(req).then((cached) => cached || Response.error())
      }
      return Response.error()
    })
  )
})
