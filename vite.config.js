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
  build: {
    target: 'es2017',
    // ★ V154 批5：vendor 拆包 —— supabase/react 移出主包（多文件并行下载，主包 ≤800KB）。
    //   ⚠ 兼容性边界（与 V140 同页备注）：多 chunk ⇒ index.html 变 <script type="module">，
    //   Chromium 61+ 才支持模块脚本；V140 的 ①判据（?.=0 且 ??=0 = es2017 语法降级）不变，
    //   且产物中无 import() 动态导入语法（tests/perfV154 钉死）。老内核风险如实登记批次报告。
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'vendor-react'
          if (/[\/]src[\/](TeacherDashboard|TeacherReport|ClassroomPack|ReportCardPrint|ReportCard|SemesterTasks|TeacherDiagnosis)\./.test(id)) return 'page-teacher'
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173
  },
  // ★ V138 §1.1：部署包用同源（location.origin）访问 Supabase ⇒ 本地 preview 必须把
  //   /rest /auth /realtime 代理到测试机，否则本地跑 UI 测试会 404（云断言被 skip，等于空转）
  preview: {
    // V142 测试：允许用 www/test 的 Host 头打开本地 preview（验证“旧站横幅”）
    allowedHosts: ['www.2026911301.xyz', 'test.2026911301.xyz'],
    proxy: {
      '/rest': { target: 'https://test.2026911301.xyz', changeOrigin: true, secure: false },
      '/auth': { target: 'https://test.2026911301.xyz', changeOrigin: true, secure: false },
      '/realtime': { target: 'wss://test.2026911301.xyz', ws: true, changeOrigin: true, secure: false },
    },
  },
})
