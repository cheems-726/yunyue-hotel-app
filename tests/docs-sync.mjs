// M5 · 文档同步守卫（防"文档滞后 → 误判未做 → 返工"）
//
// 起因：已发生 3 次返工，其中至少 2 次根因是【代码变了、文档没同步】：
//   · 交接文档写"C 第一期 dayEngine 未完成"，实际 src/dayEngine.js 已存在
//   · 《需求要点统合》标 6 项"未完成"，实际全部已做
//
// 本脚本做两件事：
//   ① 【事实对照】逐条验证"关键事实"，比对文档里的说法 —— 不符就报
//   ② 【新鲜度】比较 src/ 与关键文档的 mtime —— 代码比文档新就报
//
// 用法：node tests/docs-sync.mjs          检查并报告（默认）
//       node tests/docs-sync.mjs --json   机器可读输出
// 退出码：0 = 文档与代码一致；1 = 发现不同步（需更新文档）

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(__dirname, '..')
const ROOT = path.resolve(APP, '..')
const JSON_OUT = process.argv.includes('--json')

const readIf = p => { try { return fs.readFileSync(p, 'utf8') } catch { return null } }
const exists = p => fs.existsSync(p)

// 🔴 W4-6 补覆盖（2026-09-27）：本脚本此前只盯 3 份文档 ⇒ 会话交接卡 / 索引 / 现行目录其余任务包
//    全在监控之外。而"做完即更新交接卡"是 R1 纪律 ⇒ 交接卡落后时门禁照样绿 = **假绿近亲（BL-11 族）**。
//    本处新增两类覆盖：① 新鲜度清单扩容（含"现行"目录全部 .md）② 交接卡与 HEAD 的一致性事实断言。
// A1：取"## <标记>"段的正文（到下一个 --- 或 ## 为止）
function 段(card, mark) {
  const lines = String(card).split(/\r?\n/)
  const i = lines.findIndex(l => new RegExp("^##\\s*" + mark).test(l))
  if (i < 0) return ""
  const rest = lines.slice(i + 1)
  const j = rest.findIndex(l => /^##\s|^---\s*$/.test(l))
  return (j < 0 ? rest : rest.slice(0, j)).join("\n")
}
// A1：读"最近一次门禁记录"（run-all 每次跑自动重写；缺失 = 首次，不判）
function 门禁记录() {
  try { return JSON.parse(readIf(path.join(APP, "tests", "_last-gate.json")) || "{}") } catch { return {} }
}
function gitCount(args) {
  const r = spawnSync("git", args, { cwd: APP, encoding: "utf8", shell: false })
  return r.status === 0 ? Number((r.stdout || "").trim()) : null
}

function gitShortHead() {
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: APP, encoding: 'utf8', shell: false })
    return (r.status === 0 ? (r.stdout || '').trim() : null)
  } catch { return null }
}
// 监控文档清单：三份原有 + 交接卡 + 索引 + 现行目录全部任务包
function monitoredDocs() {
  const list = [
    path.join(ROOT, '1-总纲与进度', '交接文档-新会话必读.md'),
    path.join(ROOT, '1-总纲与进度', '决策登记册.md'),
    path.join(ROOT, '2-任务包', '现行', '总任务包-设计落地与数据补全.md'),
    path.join(ROOT, '4-审计与报告', '会话交接卡.md'),
    path.join(ROOT, '0-从这里开始.md'),
  ]
  const dir = path.join(ROOT, '2-任务包', '现行')
  try {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.md')) list.push(path.join(dir, f))
  } catch { /* ignore */ }
  return list.filter(exists)
}

function walk(dir, exts, acc = [], depth = 0) {
  if (depth > 6) return acc
  let es = []
  try { es = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, exts, acc, depth + 1)
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full)
  }
  return acc
}

function newestMtime(files) {
  let max = 0, which = null
  for (const f of files) {
    try {
      const m = fs.statSync(f).mtimeMs
      if (m > max) { max = m; which = f }
    } catch { /* ignore */ }
  }
  return { mtime: max, file: which }
}

function grepCount(dir, pattern, exts = ['.js', '.jsx', '.mjs']) {
  const files = walk(dir, exts)
  let n = 0
  const re = new RegExp(pattern)
  for (const f of files) {
    const t = readIf(f)
    if (t && re.test(t)) n++
  }
  return n
}

// ── 关键事实对照表 ────────────────────────────────────────────────
// 每条 = 一个"代码里的事实" + "文档里可能的旧说法"
// 维护约定：发现新的"文档与代码不符"案例，就加一条
const FACTS = [
  {
    name: '第一期 dayEngine 已存在',
    actual: () => exists(path.join(APP, 'src', 'dayEngine.js')),
    docSays: '第一期未完成 / C 未完成',
    docs: ['1-总纲与进度/交接文档-新会话必读.md', '1-总纲与进度/项目进度总纲.md'],
  },
  {
    name: '职位体系已上线',
    actual: () => grepCount(path.join(APP, 'src'), 'role_in_group') > 0,
    docSays: '模块五 🔴 0% 未开始',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '教师批注功能已上线',
    actual: () => grepCount(path.join(APP, 'src'), 'saveTeacherNote') > 0,
    docSays: '模块六 ❌ 未做',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '资金扣减与破产判定已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'isBankrupt') > 0,
    docSays: '模块四 未真正扣减资金',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '三类事件（请假/故障/爆单）已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'holidaySurge') > 0,
    docSays: '模块三 缺员工请假/设备故障',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '承德/重庆数据已录入',
    actual: () => {
      const t = readIf(path.join(APP, 'src', 'siteLocations.mjs')) || ''
      return t.includes('承德') && t.includes('重庆')
    },
    docSays: '模块一 承德/重庆待录入',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: 'OTA 模式引擎差异化已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'otaCommissionRate') > 0,
    docSays: '模块二 引擎未区分（两者结算逻辑相同）',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    // 🔴 Phase D/C2（2026-09-27）：dayEngine 已接进 settlement（周值拆 7 天，零变化）。
    //    本守卫原为"尚未接线"（expect:true），其注释写明"若变 false → 文档要更新" ⇒ 本夜按新事实翻转期望。
    name: 'dayEngine 已接线（Phase D/C2 起 · settlement → simulateWeek）',
    actual: () => {
      const files = walk(path.join(APP, 'src'), ['.js', '.jsx'])
      for (const f of files) {
        if (path.basename(f) === 'dayEngine.js') continue
        const t = readIf(f)
        if (t && /(from|require\()\s*['"].*dayEngine/.test(t)) return true
      }
      return false
    },
    docSays: 'settlement 内部已调用 simulateWeek（Phase D/C2）',
    docs: [],
    expect: true,   // 期望为 true：若变 false，说明接线被回退 → 需说明原因
  },
  {
    // 🔴 W4-6：R1 纪律是"做完即更新交接卡"——此前没有任何守门盯着它（交接卡不在本脚本的监控清单里）。
    //   本事实断言：交接卡的起点校验段必须引到【当前 HEAD 短哈希】⇒ 卡落后于提交即报红。
    name: '会话交接卡已跟上最新提交（起点校验含 HEAD）',
    actual: () => {
      const head = gitShortHead()
      if (!head) return false
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      return !!card && card.includes(head)
    },
    docSays: '会话交接卡 ⑥ 起点校验（应含最新的 commit 短哈希）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    // 🔴 A1（BL-13 对策）：卡里数字由人维护 ⇒ 与【最近一次全绿门禁记录】对账
    //   容差 = 本套件自身断言数（总数包含它，否则会自指循环）
    name: '会话交接卡 ⑥ 段门禁数字 === 最近一次门禁记录（±本套件断言数）',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      const rec = 门禁记录()
      const seg = 段(card, '⑥')
      // 容差 = max(20, 基准×5%)：既容忍本套件自身断言数变化，又能抓真正过期的数字
      const 候选 = []
      if (rec.fast && rec.fast.head) 候选.push({ 档: 'fast', 基准: rec.fast.通过, 容差: (rec.fast.docsSync断言数 || 0) })
      if (rec.full && rec.full.head) 候选.push({ 档: 'full', 基准: rec.full.通过, 容差: (rec.full.docsSync断言数 || 0) })
      if (!候选.length) return true   // 还没有记录（首次跑）⇒ 不判
      const 数字 = (seg.match(/\b\d{3,}\b/g) || []).map(Number)
      return 候选.every(c => 数字.some(n => Math.abs(n - c.基准) <= Math.max(20, Math.round(c.基准 * 0.05))))
    },
    docSays: '会话交接卡 ⑥（快检/全量数字应与最近一次全绿门禁一致；容差 = max(20, 基准×5%)）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    name: '会话交接卡 ⑥ 段「未推 N」与实际一致',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      const m = /未推\s*(\d+)/.exec(段(card, '⑥'))
      if (!m) return false
      const n = gitCount(['rev-list', '--count', 'origin/main..HEAD'])
      return n != null && Number(m[1]) === n
    },
    docSays: '会话交接卡 ⑥（未推数应等于 git rev-list --count origin/main..HEAD）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    name: '会话交接卡 ①–⑥ 六段各恰好一次（无重复段）',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      return ['①','②','③','④','⑤','⑥'].every(mk =>
        (card.match(new RegExp('^##\\s*' + mk, 'gm')) || []).length === 1)
    },
    docSays: '会话交接卡（①–⑥ 各一段；本次实装卡曾出现重复的第三段）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
]

// ── 执行 ─────────────────────────────────────────────────────────
const problems = []
const oks = []

for (const f of FACTS) {
  let actual
  try { actual = f.actual() } catch (e) { actual = false }
  const expect = f.expect === undefined ? true : f.expect
  const ok = actual === expect
  if (ok) oks.push(f.name)
  else problems.push({ type: 'fact', name: f.name, actual, expect, docSays: f.docSays, docs: f.docs })
}

// 新鲜度：src/ vs 关键文档
const srcFiles = walk(path.join(APP, 'src'), ['.js', '.jsx', '.mjs'])
const docFiles = monitoredDocs()

const srcNewest = newestMtime(srcFiles)
const docNewest = newestMtime(docFiles)
const stale = srcNewest.mtime > docNewest.mtime

// ── 输出 ─────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ oks, problems, stale, srcNewest, docNewest }, null, 2))
} else {
  console.log('')
  console.log('════════════════════════════════════════════════')
  console.log('  M5 · 文档同步守卫')
  console.log('════════════════════════════════════════════════')
  console.log('')
  console.log('【一、关键事实对照】')
  for (const n of oks) console.log('  ✓ ' + n)
  for (const p of problems) {
    console.log('  ✗ ' + p.name)
    console.log('      代码实际：' + p.actual)
    console.log('      文档旧说法：' + p.docSays)
    if (p.docs.length) console.log('      需更新：' + p.docs.join('、'))
  }
  console.log('')
  console.log('【二、文档新鲜度】')
  const fmt = t => new Date(t).toISOString().replace('T', ' ').slice(0, 16)
  console.log('  src/ 最新变更 ：' + fmt(srcNewest.mtime) + '  ' + path.relative(ROOT, srcNewest.file || ''))
  console.log('  文档最新变更  ：' + fmt(docNewest.mtime) + '  ' + path.relative(ROOT, docNewest.file || ''))
  console.log('  ' + (stale ? '⚠️ 代码比文档新 —— 文档可能滞后，需同步' : '✓ 文档不落后于代码'))
  console.log('')
console.log('────────── 结论 ──────────')
if (problems.length === 0 && !stale) {
  console.log('  ✓ 文档与代码一致')
} else {
  console.log('  ⚠️ 发现 ' + problems.length + ' 条事实不符' + (stale ? ' + 文档滞后' : ''))
  console.log('  ⇒ 更新上述文档后重跑本脚本，直到全绿')
}
  console.log('')
}

// 统一尾行格式，便于 run-all 汇总统计
const passN = oks.length + (stale ? 0 : 1)
const failN = problems.length + (stale ? 1 : 0)
console.log(passN + ' 通过 / ' + failN + ' 失败')
console.log('')

process.exit(failN === 0 ? 0 : 1)
