// V138 §2 · 预览新鲜度守卫
// 背景：ui-smoke / verify-live-review-ui 在 4173 有常驻 preview 时直接复用；
//       若该 preview 是旧构建（部署前起的），测试会对着旧包跑 ⇒ 19 条假失败（D337）。
// 判据：preview 的入口包名必须 === 本地 dist/index.html 的入口包名；不是就是旧构建，别复用。
import { readFileSync } from 'node:fs'

export function 入口包名(html) {
  const m = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html || '')
  return m ? m[1] : null
}

export function 本地入口包() {
  try { return 入口包名(readFileSync('dist/index.html', 'utf8')) } catch { return null }
}

export async function 是当前构建(base) {
  try {
    const url = String(base).replace(/\/+$/, '') + '/'
    const html = await fetch(url, { signal: AbortSignal.timeout(4000) }).then(r => (r.ok ? r.text() : ''))
    const 远端 = 入口包名(html)
    return !!远端 && 远端 === 本地入口包()
  } catch {
    return false
  }
}
