import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ★ V129-R109-3：sw.js 的缓存版本随构建变化（activate 里会清掉所有旧版本缓存）
const swBuildVersion = () => ({
  name: 'sw-build-version',
  closeBundle() {
    const p = resolve('dist/sw.js')
    if (!existsSync(p)) return
    const 注入 = String(Date.now())
    writeFileSync(p, readFileSync(p, 'utf8').replace(/__BUILD_VERSION__/g, 注入), 'utf8')
  },
})

export default defineConfig({
  plugins: [react(), swBuildVersion()],
  // ★ V140 §1：旧微信 X5（Chromium 53/66/77）解析不了 ?. / ?? ⇒ 白屏。
  //   es2017 会让 esbuild 把可选链/空值合并降级成等价写法（不改业务逻辑，产物变大可接受）。
  build: { target: 'es2017' },
  server: {
    host: true,
    port: 5173
  },
  // ★ V138 §1.1：部署包用同源（location.origin）访问 Supabase ⇒ 本地 preview 必须把
  //   /rest /auth /realtime 代理到测试机，否则本地跑 UI 测试会 404（云断言被 skip，等于空转）
  preview: {
    proxy: {
      '/rest': { target: 'https://test.2026911301.xyz', changeOrigin: true, secure: false },
      '/auth': { target: 'https://test.2026911301.xyz', changeOrigin: true, secure: false },
      '/realtime': { target: 'wss://test.2026911301.xyz', ws: true, changeOrigin: true, secure: false },
    },
  },
})
