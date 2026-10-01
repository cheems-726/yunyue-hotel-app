// U4c-§5① RV（可执行 · 用完删）：漏登 weather.mjs（.js 依赖）⇒ 修复后的判据必须 exit 1 且报「闭包不完整」
import { readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const P = 'scripts/build-edge-function.mjs'
copyFileSync(P, 'scripts/_bef.bak')
let 咬 = false
try {
  const 行 = "  'weather.mjs',      // §32-U3-A：天气（settlement 依赖 ⇒ 必须一起组装；漏登 = 部署后 import 404）\n"
  let s = readFileSync(P, 'utf8').replace(/\r\n/g, '\n')
  if (!s.includes(行)) { console.log('❌ weather 登记行未命中'); process.exit(2) }
  writeFileSync(P, s.replace(行, ''), 'utf8')
  rmSync('supabase/functions/advance-day/engine/weather.mjs', { force: true })
  let out = '', code = 0
  try { out = execFileSync(process.execPath, [P], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); code = e.status ?? 1 }
  咬 = code !== 0 && /闭包不完整/.test(out) && /weather/.test(out)
  console.log(`RV（漏登 weather.mjs · .js 依赖）：exit=${code} · ${咬 ? '✓ 判据咬住了（修复生效）' : '✗ 仍未咬'}`)
} finally {
  copyFileSync('scripts/_bef.bak', P); rmSync('scripts/_bef.bak')
  execFileSync(process.execPath, [P], { stdio: 'ignore' })
  console.log('已还原 + 重新组装（' + (existsSync('supabase/functions/advance-day/engine/weather.mjs') ? '生成物齐' : '生成物缺！') + '）')
}
process.exit(咬 ? 0 : 1)
