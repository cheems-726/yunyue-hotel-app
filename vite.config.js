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
  server: {
    host: true,
    port: 5173
  }
})
