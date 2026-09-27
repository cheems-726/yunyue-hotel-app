// 组装 Edge Function 的 engine/ 目录（Wave 1 · W1-1）
//
// ── 为什么需要它 ────────────────────────────────────────────────
// Supabase Edge Function 部署时只上传【函数目录本身】；而引擎在 src/ 下（浏览器端共用同一份）。
// 直接写 `import ... from '../../../src/engine/index.js'` 本地能跑、部署后必然 404。
// ⇒ 本脚本把 src/ 里的引擎模块【机械复制】进函数的 engine/ 子目录，并改写相对路径：
//      '../settlement.js'  →  './settlement.js'      （平铺）
//      './xxxxx.mjs'       →  './xxxxx.mjs'          （不变）
//   ★ 源码真相源仍是 src/ —— 本脚本【只搬运、不改写逻辑】，绝不产生"第二套实现"。
//   ★ 脚本会断言：搬运前后【除 import 路径外逐字节相同】，防止有人在这里偷偷改逻辑。
//
// 用法：node scripts/build-edge-function.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SRC = join(ROOT, 'src')
const OUT = join(ROOT, 'supabase', 'functions', 'advance-day', 'engine')

// 引擎需要的模块（含传递依赖）
const MODULES = [
  'engine/index.js',
  'settlement.js',
  'dayEngine.js',
  'attrs.js',
  'guests.js',
  'reviewRate.js',
  'liveReview.js',
  'dailyReport.mjs',
  'missingWeeks.mjs',
  'teachingClock.mjs',
  'hotelTitle.js',
  'stateMigration.mjs',
  'franchiseModel.mjs',
  'siteLocations.mjs',
  'serverTick.mjs',
  'deptCosts.mjs',
  'decisionLogIntegrity.mjs',
]

// 改写 import/export-from 的路径（两条规则，缺一不可）：
//   ① '../x'            → './x'         （src/ 下的同级引用 → 平铺后同目录）
//   ② './engine/index.js' → './index.js'（src/serverTick.mjs 那样从同级引用 engine/ ⇒ 平铺后不存在 engine/ 子目录）
const rewrite = (s) => s
  .replace(/(from\s*['"])\.\.\/([^'"]+)(['"])/g, '$1./$2$3')
  .replace(/(from\s*['"])\.\/engine\/([^'"]+)(['"])/g, '$1./$2$3')
// 剥掉 import 路径后再比，用于"除路径外逐字节相同"的断言
const stripImports = (s) => s.replace(/(from\s*['"])[^'"]+(['"])/g, '$1$2')

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const report = []
for (const m of MODULES) {
  const from = join(SRC, m)
  if (!existsSync(from)) { console.error('✗ 缺少模块：' + m); process.exit(1) }
  const raw = readFileSync(from, 'utf8')
  const out = rewrite(raw)
  writeFileSync(join(OUT, basename(m)), out, 'utf8')
  if (stripImports(raw) !== stripImports(out)) { console.error('✗ 搬运改动了非 import 内容：' + m); process.exit(1) }
  report.push(`  ${m.padEnd(24)} → engine/${basename(m)}`)
}

// 守门：engine/ 里的 settlement.js 必须是真引擎（不是空壳）
const st = readFileSync(join(OUT, 'settlement.js'), 'utf8')
if (!/export function settle/.test(st)) { console.error('✗ engine/settlement.js 不含 settle 导出'); process.exit(1) }
// 守门：engine/ 里不得残留指向 src/ 的越界 import
// ★ 守门：engine/ 下【任何】文件都不得残留会 404 的 import
//   ① '../'      —— 指向函数目录之外
//   ② './engine/'—— 平铺后没有 engine/ 子目录（这个漏过一次：serverTick.mjs 正是这种写法）
const BAD_IMPORT = /from\s*['"](?:\.\.\/|\.\/engine\/)/
const offenders = []
for (const m of MODULES) {
  const f = join(OUT, basename(m))
  const src = readFileSync(f, 'utf8')
  src.split(/\r?\n/).forEach((l, i) => { if (BAD_IMPORT.test(l)) offenders.push(`${basename(m)}:${i + 1} ${l.trim().slice(0, 60)}`) })
}
if (offenders.length) {
  console.error('✗ engine/ 内仍有会 404 的 import（部署后函数加载失败）：')
  offenders.slice(0, 6).forEach(o => console.error('   ' + o))
  process.exit(1)
}

console.log('▶ 组装 Edge Function 的 engine/（只搬运，不改逻辑）')
report.forEach(r => console.log(r))
console.log(`\n共 ${MODULES.length} 个模块；断言：除 import 路径外逐字节相同 ✅；engine/ 内无会 404 的 import ✅`)
console.log('输出目录：supabase/functions/advance-day/engine/')
console.log('\n★ 部署（需用户执行，见 supabase/functions/advance-day/README.md）：')
console.log('  1) npx supabase login')
console.log('  2) npx supabase functions deploy advance-day --project-ref <ref>')
console.log('  3) 应用 supabase/migrations/20260927_server_tick.sql（classDay + 幂等表 + pg_cron）')
console.log('  4) Supabase 后台 → Functions → Secrets 设 SUPABASE_SERVICE_ROLE_KEY')
