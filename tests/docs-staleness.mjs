// M3 · 文档过期自检（报告模式：只报告，不自动改文档，不阻塞门禁）
// 运行：node tests/docs-staleness.mjs
// 原理：扫"进度类文档"里的【疑似未完成】标记行 → 提取关键词 → 在代码语料里搜
//       代码有命中 = 疑似过期（文档说没做、代码里有）
//
// P0-1：搜索用 Node 原生 fs（不用 execFileSync('grep')——部分 Windows 无 grep → 假绿，BL-3）
// P1-1：三类假阳性对策
//   a 自指过滤：M3 自身正则文本 / 本脚本名 / 现行包的"批次数"行 → 一律跳过（不再逐行硬编码行号）
//   b 别名拆细：_alias.mjs 的条目带 kind（feature/wired/concept）——
//       wired = 必须被【非测试文件】import/调用才算命中（"文件在、没接线"不再误报）
//       concept = 宽概念，命中降 low 置信度
//   c 死代码清理：walk() 的两分支 undefined / 恒真判定已重写；preflight 的 _localAliasBackup 已删
// P1-2：输出分【高/中/低】三档置信度 + "跳过 N 处自指"统计
import { readFileSync, readdirSync, existsSync } from 'node:fs'
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
process.exit(0)
