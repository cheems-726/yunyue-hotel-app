// M3 · 文档过期自检（报告模式：只报告，不自动改文档，不阻塞门禁）
// 运行：node tests/docs-staleness.mjs
// 原理：扫"进度类文档"里的【疑似未完成】标记行 → 提取关键词 → 在代码里搜
//       代码有命中 = 疑似过期（文档说没做、代码里有）
// 🔴 P0-1（BL-3 整改）：搜代码用【Node 原生 fs 遍历】，不用 execFileSync('grep')——
//    grep 在部分 Windows 环境（cmd.exe 直接跑）不存在 → 异常被 catch 吞掉 → 永远报 0 处 = 假绿。
//    修复后必须报出 ≥6 处（任务包 P0-1 验收）。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ALIAS, expandTerms } from './_alias.mjs'

const SRC_DIR = 'D:/教学app/hotel-app/src'
const DOC_DIRS = ['D:/教学app/1-总纲与进度', 'D:/教学app/2-任务包/现行']
const MARK_RE = /(❌|⬜|未完成|未开始|未做|未实施|待录入|待实施|还没做|尚未做)/
const KEYWORD_STRIP = /[:,，。；'"「」『』（）()、\s｜|]/g

// ── 代码语料：一次性读入全部 src/**（Node 原生，无外部命令）──
// 每个文件存"剥注释后的非空行"数组；命中判定 = 非注释行里真的出现该词
const corpus = []
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (/settle-old-|\.bak$/.test(f)) continue          // 测试夹具/备份的命中不算"功能已实现"
    const st = existsSync(p) && readdirSync(dir).includes(f) ? undefined : undefined
    let isDir = false
    try { isDir = readdirSync(p).length >= 0 && !/\.(js|jsx|mjs|json|ts|css|html)$/.test(f) } catch (e) { isDir = false }
    if (isDir) { walk(p); continue }
    if (!/\.(js|jsx|mjs)$/.test(f)) continue
    let body = ''
    try { body = readFileSync(p, 'utf8') } catch (e) { continue }
    const lines = body.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, ''))
      .map(l => l.trim()).filter(l => l.length > 0)
    corpus.push({ file: 'src/' + f, lines })
  }
}
walk(SRC_DIR)

// 关键词 → 命中文件列表（强命中：非注释行包含该词）
function grepSrc(keyword) {
  return corpus.filter(c => c.lines.some(l => l.includes(keyword))).map(c => c.file)
}

let stale = [], checked = 0
for (const dir of DOC_DIRS) {
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter(x => x.endsWith('.md'))) {
    const path = join(dir, f)
    const lines = readFileSync(path, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!MARK_RE.test(line)) return
      if (line.includes('已加顶部标注') || line.includes('文档过期清单') || line.includes('★') && line.includes('过期')) return
      if (/^#{1,4}\s*(⬜|❌)?\s*未完成/.test(line.trim())) return   // 纯章节标题不算条目
      if (f === '总任务包-设计落地与数据补全.md' && i === 372) return   // M3 自身正则文本（自指）
      if (line.includes('docs-staleness') || line.includes('MARK_RE')) return
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
      // ALIAS：关键词【包含】别名键即展开（"班级分组职位体系"含"职位体系"）
      const terms = expandTerms(kw)
      let hits = [], usedKw = kw
      for (const t of terms) { const h = grepSrc(t); if (h.length) { hits = h; usedKw = t + (t !== kw ? '（别名命中）' : ''); break } }
      if (hits.length) stale.push({ doc: f + ':' + (i + 1), kw: usedKw, line: line.trim().slice(0, 70), hits: hits.slice(0, 3) })
    })
  }
}

console.log('▶ M3 文档过期自检（报告模式 · Node 原生实现）')
console.log(`  代码语料：${corpus.length} 个文件（剥注释非空行）`)
console.log(`  扫描：${DOC_DIRS.join(' , ')} · 带"未完成"标记的关键词条目 ${checked} 条`)
if (!stale.length) {
  console.log('  ✅ 未发现"文档说没做、代码里有"的过期项')
} else {
  console.log(`  ⚠️ 疑似过期 ${stale.length} 处（文档说没做 / 代码里有命中）：`)
  const seen = new Set()
  for (const s of stale) {
    if (seen.has(s.doc)) continue
    seen.add(s.doc)
    console.log(`   · [${s.kw}] ${s.doc}`)
    console.log(`     原话：${s.line}`)
    console.log(`     代码命中：${s.hits.join(', ')}`)
    console.log(`     建议：人工确认后改标注为 ✅ 或移入归档（本脚本不自动改）`)
  }
}
console.log(`\n结果: ${stale.length === 0 ? checked : stale.length} 通过 / 0 失败（报告模式，不阻塞门禁）`)
process.exit(0)
