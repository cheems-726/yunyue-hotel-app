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
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs'
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
  'franchiseFees.mjs',   // §14.3（G3 二步）：加盟两费计费（settlement 依赖 ⇒ 必须一起组装）
  'siteLocations.mjs',
  'serverTick.mjs',
  'weeklyAuto.mjs',   // E2（N-2）：自动周报纯核心（serverTick 依赖它 ⇒ 必须一起组装）
  'weekInputs.mjs',   // §16.2-B7（铺满批次）：周内输入单源（serverTick 依赖它 ⇒ 必须一起组装）
  'weekSegments.mjs', // §19.1（单元1·B4）：周内分段定价（serverTick 依赖它 ⇒ 必须一起组装）
  'semester.mjs',     // §22.2-B2：学期长度单源（TOTAL_WEEKS；settlement/franchiseFees 依赖 ⇒ 必须一起组装）
                      //   ★ 漏登后果与 §14.3 那次同族：部署后 Edge Function import 404。
                      //     本批我是先漏登、被 serverTick 的「导入闭包」断言当场拦下的 —— 守门在跑。
  'tierLimit.mjs',    // §31.2-A1：等级限制真强制（settlement 依赖 ⇒ 必须一起组装；漏登 = 又一次 404）
  'hotReview.mjs',    // §32-U1 R2：上热门三级惩罚（settlement 依赖 ⇒ 必须一起组装）
  'weather.mjs',      // §32-U3-A：天气（settlement 依赖 ⇒ 必须一起组装；漏登 = 部署后 import 404）
  'season.mjs',       // §32-U3-B：淡旺季（settlement 依赖 ⇒ 必须一起组装）
  'otaRating.mjs',    // §32-U3-C：OTA 平台评分 + 违规处罚（settlement 依赖 ⇒ 必须一起组装）
  'roleBonus.mjs',    // §32-U4-R4：职务加成 ×1.3（weekInputs 依赖 ⇒ 必须一起组装）
  'decisionRisk.mjs',
  'teacherEvents.mjs',
  'aiSupervisor.mjs',  // §32-U8-B：AI 领班（App 层用 · 组装以保一致） // §32-U8-A：老师事件注入（settlement 依赖 ⇒ 必须一起组装；漏登 = 部署后 404） // §32-U4c-R6：决策风险化（attrs 依赖 ⇒ 必须一起组装；漏登 = 部署后 404）
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
// ★ §32-U4b（本轮实测抓到的**假绿**）：上面那条只查"路径写法"（../ 与 ./engine/），**不查目标是否存在**
//   ⇒ MODULES 漏登依赖时照样 ✅ + exit 0，而生成物里确实缺文件 ⇒ 部署后 404（同类第 7 次的真凶）。
//   本段补上**真闭包**：逐文件解析 import 目标，相对路径的必须在 engine/ 里存在（内建/裸包名跳过）。
const 缺依赖 = []
for (const f of readdirSync(OUT)) {
  // ★ §32-U4c-§5①（D92 · 决策端实证证伪）：原判据只扫 .mjs/.ts —— 而 engine/ 有 **8 个 .js**，
  //   引擎主体 `settlement.js` 正是 weather/season/otaRating/decisionRisk 的 import 方
  //   ⇒ 实测：漏登 weather.mjs 时判据照样 exit 0 且打印「闭包完整 ✅」（假绿）。
  //   修：扫描范围扩到 .js（本目录只含引擎文件，不会误伤）。
  if (!f.endsWith('.mjs') && !f.endsWith('.ts') && !f.endsWith('.js')) continue
  // ★ §32-U4c（本判据上线当场抓到的**假阳性**）：index.js 的【注释】里有 import 示例
  //   （"原先两端各自 \`import ... from './src/某文件.js'\`"）⇒ 被当真依赖报红。
  //   与既有"断言前剥注释"纪律同源：扫描前先剥行注释与块注释。
  const src = readFileSync(join(OUT, f), 'utf8')
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
    const 目标 = m[1]
    if (!目标.startsWith('.')) continue                       // node: / 裸包名 ⇒ 部署环境自带，跳过
    const 名 = 目标.replace(/^\.\//, '').replace(/^\.\.\//, '')
    const 落 = join(OUT, 名)
    if (!existsSync(落)) 缺依赖.push(`${f} → ${目标}（engine/ 里没有 ${名}）`)
  }
}
if (缺依赖.length) {
  console.error('✗ 组装闭包不完整（MODULES 漏登依赖 ⇒ 部署后 404）：')
  const 去重 = Array.from(new Set(缺依赖))
  去重.slice(0, 6).forEach(o => console.error('   ' + o))
  process.exit(1)
}

console.log('▶ 组装 Edge Function 的 engine/（只搬运，不改逻辑）')
report.forEach(r => console.log(r))
console.log(`\n共 ${MODULES.length} 个模块；断言：除 import 路径外逐字节相同 ✅；engine/ 内无会 404 的 import ✅；**闭包完整**（逐文件 import 目标都存在）✅`)
console.log('输出目录：supabase/functions/advance-day/engine/')
console.log('\n★ 部署（需用户执行，见 supabase/functions/advance-day/README.md）：')
console.log('  1) npx supabase login')
console.log('  2) npx supabase functions deploy advance-day --project-ref <ref>')
console.log('  3) 应用 supabase/migrations/20260927_server_tick.sql（classDay + 幂等表 + pg_cron）')
console.log('  4) Supabase 后台 → Functions → Secrets 设 SUPABASE_SERVICE_ROLE_KEY')
