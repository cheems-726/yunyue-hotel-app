// M3 · 文档过期自检（双模式）
//   node tests/docs-staleness.mjs          → 报告模式（原样：扫"疑似未完成"标记，不阻塞门禁）
//   node tests/docs-staleness.mjs --gate   → 判死模式（§13.2-N8 新增 · 挂 run-all fast）：
//       (a) hotel-app/AGENTS.md 状态行（门禁数字 === _last-gate.json 精确相等 · 无失效警告 · 阶段含"二期"）
//       (b) 0-从这里开始.md 状态段（同上两条）
//       (c) 已被取代文档必须有【作废/取代】标注（长跑报告 v3 / 账务闭环方案）
//   ★ 与 docs-sync 分工（勿重复）：docs-sync 管【会话交接卡】HEAD/数字/未推数 + 关键事实 + 新鲜度；
//     本套件（--gate）管【入口文档】（AGENTS.md / 0-从这里开始.md）与【作废标注】。
//   ★ 背景（夜跑实测）：AGENTS.md 原先【不在 docs-sync 监控内】—— 把它门禁数字改成 9999 仍全绿
//     ⇒ 执行端唯一入口的数字可静默腐烂（本轮已实证并由此立项）。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { ALIAS, expandTerms } from './_alias.mjs'

const SRC_DIR = 'D:/教学app/hotel-app/src'
// 🔴 P2（D18 治本）：扫描范围收窄到【进度陈述类】白名单 4 个文档。
//   排除记录/清单/报告类（决策登记册/现行任务包/审计报告）——它们"本质含问题原文"，扫了必然假阳性（BL-5）
const DOC_WHITELIST = [
  'D:/教学app/1-总纲与进度/需求要点统合-现状对照.md',
  'D:/教学app/1-总纲与进度/交接文档-新会话必读.md',
  'D:/教学app/1-总纲与进度/项目进度总纲.md',
  'D:/教学app/1-总纲与进度/App现状全景评估.md',
]
const SELF_DOC = '总任务包-设计落地与数据补全.md'
const MARK_RE = /(❌|⬜|未完成|未开始|未做|未实施|待录入|待实施|还没做|尚未做)/
const KEYWORD_STRIP = /[:,，。；'"「」『』（）()、\s｜|]/g

// ── 代码语料：一次性读入 src/**（Node 原生遍历）──
const corpus = []
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (!/\.(js|jsx|mjs)$/.test(f)) continue            // 只收源码（src 根下无子目录，Engine 模块都在根）
    if (/settle-old-|\.bak$/.test(f)) continue          // 测试夹具/备份的命中不算"功能已实现"
    let body = ''
    try { body = readFileSync(p, 'utf8') } catch (e) { continue }
    const lines = body.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, ''))
      .map(l => l.trim()).filter(l => l.length > 0)
    corpus.push({ file: relative(SRC_DIR, p).split('\\').join('/'), lines, raw: body })
  }
}
walk(SRC_DIR)

// wired 判定：目标标识符必须被【非定义文件、非测试夹具】的文件以 import/调用方式引用
function isWired(id, definingFiles) {
  const importers = corpus.filter(c => {
    if (definingFiles.some(d => c.file === d || c.file.startsWith(d))) return false
    return c.lines.some(l => new RegExp("(import[^\\n]*[\\s{]|from\\s*['\"])[^\\n]*" + id.replace(/\$/g, '\\$')) .test(l) || new RegExp('\\b' + id.replace(/\$/g, '\\$') + '\\s*\\(').test(l))
  })
  return importers.length > 0
}
// 关键词 → 命中文件（kind 影响：wired 要查接线；concept 命中也只标 low）
function grepSrc(keyword, kind, id) {
  const files = corpus.filter(c => c.lines.some(l => l.includes(keyword))).map(c => c.file)
  if (kind === 'wired' && !isWired(id, files.length ? files : ['src/' + id])) return { files, wired: false }
  return { files, wired: true }
}

let stale = [], checked = 0, skippedSelf = 0
// 🔴 P2（D18 治本）：只扫白名单 4 文档（进度陈述类）；排除记录/清单/报告类（BL-5 根因）
for (const path of DOC_WHITELIST) {
  if (!existsSync(path)) { console.log('  ⚠️ 白名单文档不存在：' + path); continue }
  const f = path.split('/').pop()
  {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!MARK_RE.test(line)) return
      // P1-1a 自指过滤（规则化，不再硬编码行号）：
      if (f === SELF_DOC) { skippedSelf++; return }                                   // 现行包的"未完成"= 本任务包台账，由 §十二 管
      if (line.includes('docs-staleness') || line.includes('MARK_RE')) { skippedSelf++; return }
      if (line.includes('已加顶部标注') || line.includes('文档过期清单')) return
      if (/^#{1,4}\s*(⬜|❌)?\s*未完成/.test(line.trim())) return                      // 纯章节标题
      // 提取关键词：优先反引号/「」/加粗；取不到取表格第二列或最长中文段（≥3字）
      let kw = null
      const cand = line.match(/`([^`]{2,24})`|「([^」]{2,24})」|\*\*([^*]{2,24})\*\*/)
      if (cand) kw = (cand[1] || cand[2] || cand[3]).trim()
      if (!kw) {
        const cells = line.split('|').map(c => c.trim()).filter(c => /[\u4e00-\u9fa5]{2,}/.test(c))
        if (cells.length >= 2 && /功能|模块|体系|项/.test(cells[0])) kw = cells[1]
        if (!kw) {
          const zh = line.replace(MARK_RE, ' ').split(KEYWORD_STRIP).filter(s => /[\u4e00-\u9fa5]{3,}/.test(s) && s.length >= 3 && s.length <= 20)
          zh.sort((a, b) => b.length - a.length)
          kw = zh[0]
        }
      }
      if (!kw) return
      checked++
      // P1-1b：ALIAS 展开（带 kind）；kw 包含别名键即展开
      const terms = expandTerms(kw)
      let hits = [], usedKw = kw, confidence = null, wired = null
      for (const t of terms) {
        const res = grepSrc(t.id, t.kind, t.id)
        if (res.files.length) {
          hits = res.files
          usedKw = t.id + (t.id !== kw ? `（别名命中·来自「${t.key}」）` : '')
          wired = t.kind === 'wired' ? res.wired : null
          confidence = t.kind === 'concept' ? 'low' : (t.kind === 'wired' ? (res.wired ? 'high' : 'low') : 'high')
          break
        }
      }
      // 无别名 → 纯中文关键词直搜（命中给 medium：可能是文案巧合）
      if (!hits.length && terms.length === 0) {
        const h = grepSrc(kw)
        if (h.files.length) { hits = h.files; usedKw = kw; confidence = 'medium' }
      }
      if (hits.length) stale.push({ doc: f + ':' + (i + 1), kw: usedKw, confidence, wired, line: line.trim().slice(0, 70), hits: hits.slice(0, 3) })
    })
  }
}

// P1-2：三档置信度输出
const CONF_ORDER = { high: '🔴 高置信', medium: '🟡 中置信', low: '⚪ 低置信' }
const bucket = { high: [], medium: [], low: [] }
const seen = new Set()
for (const s of stale) {
  if (seen.has(s.doc + s.kw)) continue
  seen.add(s.doc + s.kw)
  bucket[s.confidence || 'medium'].push(s)
}

console.log('▶ M3 文档过期自检（报告模式 · Node 原生 · 三档置信度）')
console.log(`  代码语料：${corpus.length} 个文件（剥注释非空行）`)
console.log(`  扫描：D18 白名单 4 文档 · 带"未完成"标记的关键词条目 ${checked} 条 · 跳过自指 ${skippedSelf} 处`)
for (const lvl of ['high', 'medium', 'low']) {
  const items = bucket[lvl]
  console.log(`\n${CONF_ORDER[lvl]}（${items.length} 处）${lvl === 'high' ? '—— 条条应可人工确认为真过期' : lvl === 'medium' ? '—— 无别名命中、靠词面匹配，需人工判读' : '—— 宽概念/未接线，仅提示'}`)
  for (const s of items) {
    console.log(`   · [${s.kw}] ${s.doc}`)
    console.log(`     原话：${s.line}`)
    console.log(`     代码命中：${s.hits.join(', ')}`)
    if (lvl === 'low') console.log(`     备注：低置信——可能是"文件在但未接线"或宽概念部分覆盖，不算定论`)
  }
}
console.log(`\n结果: ${bucket.high.length} 高 + ${bucket.medium.length} 中 + ${bucket.low.length} 低 / 0 失败（报告模式，不阻塞门禁；自指跳过 ${skippedSelf}）`)
console.log(`验收口径：最高置信项（high）条条为真——抽查请逐条看 high 档`)
// ── ★ §13.2-N8：判死模式（--gate）──────────────────────────────
if (process.argv.includes('--gate')) {
  const path2 = (await import('node:path')).default
  const APP2 = path2.resolve(path2.dirname(fileURLToPath(import.meta.url)), '..')
  const ROOT2 = path2.resolve(APP2, '..')
  let gp = 0, gf = 0
  const gok = (c, nm, extra = '') => { if (c) { gp++; console.log('  ✓ ' + nm) } else { gf++; console.error('  ✗ FAIL: ' + nm + (extra ? '  [' + extra + ']' : '')) } }
  const rd = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }

  console.log('\n▶ M3 --gate：入口文档状态行 + 作废标注')
  let gateRec = {}
  try { gateRec = JSON.parse(rd(path2.join(APP2, 'tests', '_last-gate.json')) || '{}') } catch (e) {}
  const 档 = []
  if (gateRec.full && gateRec.full.head) 档.push(gateRec.full.通过)
  if (gateRec.fast && gateRec.fast.head) 档.push(gateRec.fast.通过)

  // (a) AGENTS.md（执行端唯一入口）
  const A = rd(path2.join(APP2, 'AGENTS.md'))
  gok(A !== null, 'AGENTS.md 存在')
  if (A) {
    const nums = [...A.matchAll(/(\d{3,})\s*(?:通过|\/)/g)].map(m => Number(m[1]))
    if (档.length) {
      gok(档.every(v => nums.includes(v)), `AGENTS.md 门禁数字 === 门禁记录（fast ${档[1] ?? '—'} / full ${档[0] ?? '—'}）`, `卡内=[${nums.join(',')}]`)
    } else gok(true, '（尚无门禁记录 ⇒ 不判数字）')
    gok(!/当前门禁是红的/.test(A), '无失效的「D42 门禁是红的」警告')
    gok(/二期/.test(A), '阶段含「二期」')
    gok(!/40 小时冲刺 · Wave 2 收尾/.test(A), '无过期阶段「40 小时冲刺 · Wave 2 收尾」')
    const reg = rd(path2.join(ROOT2, '1-总纲与进度', '决策登记册.md')) || ''
    const maxD = Math.max(0, [...reg.matchAll(/D(\d{2,3})/g)].map(x => Number(x[1])).reduce((a, b) => Math.max(a, b), 0))
    const mUp = [...A.matchAll(/D1[–-]D(\d{2,3})/g)].map(x => Number(x[1]))
    if (maxD > 0 && mUp.length) gok(mUp[0] >= maxD - 3, `决策区间上限 D1–D${mUp[0]} 不落后登记册（最新 D${maxD}，容差 3）`, `卡=${mUp[0]} 册=${maxD}`)
    else gok(true, '（决策区间未标 ⇒ 不判）')
  }

  // (b) 0-从这里开始.md（新会话第一站）
  const Z = rd(path2.join(ROOT2, '0-从这里开始.md'))
  gok(Z !== null, '0-从这里开始.md 存在')
  if (Z) {
    const zNums = [...Z.matchAll(/(\d{3,})\s*通过/g)].map(m => Number(m[1]))
    if (gateRec.full && gateRec.full.head) gok(zNums.includes(gateRec.full.通过), `状态段全量数字 === 门禁记录（${gateRec.full.通过}）`, `卡内=[${zNums.join(',')}]`)
    gok(!/冲刺完成（Wave 1–5）→ 拍板窗口/.test(Z), '无过期状态「冲刺完成→拍板窗口」')
    gok(/二期进行中/.test(Z), '状态段标明「二期进行中」')
  }

  // (c) 作废标注
  const RETIRED = [
    { p: path2.join(ROOT2, '4-审计与报告', '18周（126天）长跑报告.md'), kw: ['作废', 'v3（本报告）'] },
    { p: path2.join(ROOT2, '3-设计文档', '账务闭环-设计方案.md'), kw: ['作废'] },
  ]
  for (const { p, kw } of RETIRED) {
    const t = rd(p)
    if (t === null) { gok(true, `（${path2.basename(p)} 不存在 ⇒ 跳过）`); continue }
    gok(kw.some(k => t.slice(0, 1200).includes(k)), `${path2.basename(p)}：顶部带作废/取代标注`)
  }
  const lr = rd(path2.join(ROOT2, '4-审计与报告', '18周（126天）长跑报告.md')) || ''
  // ★ §22.2（2026-09-29）：长跑报告已重跑为 **v5（含 B2 一次性费用）** ⇒ 本断言随之更新（原写 v4）。
  //   口径标注的**完整守门**在 tests/reportCaliber.test.mjs（本处只判"现行版本 + 真实链路"两件事）。
  gok(/v5（本报告）/.test(lr) && /真实链路/.test(lr), '长跑报告 = v5 现行（真实链路 · 含两费与一次性费用）')

  console.log(`\n结果: ${gp} 通过 / ${gf} 失败（--gate 判死模式）`)
  console.log('RV：把 AGENTS.md 门禁数字改成 9999 ⇒ 本模式必红（夜跑已实测 docs-sync 对它失明）')
  process.exit(gf ? 1 : 0)
}

process.exit(0)
