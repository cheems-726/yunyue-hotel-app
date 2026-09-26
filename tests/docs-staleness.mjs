// M3 · 文档过期自检（报告模式：只报告，不自动改文档，不阻塞门禁）
// 运行：node tests/docs-staleness.mjs
// 原理：扫"进度类文档"里的【疑似未完成】标记行 → 提取关键词 → grep 代码
//       代码有命中 = 疑似过期（文档说没做、代码里有）
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const DOC_DIRS = ['D:/教学app/1-总纲与进度', 'D:/教学app/2-任务包/现行']
// 中→英别名表：与 tests/preflight.mjs 的 ALIAS 同源（🔴 两处需同步维护，preflight Bug2 教训：
// 文档关键词"职位体系"在代码里叫 role_in_group，纯中文 grep 永远够不着）
const ALIAS = {
  '职位体系': ['role_in_group', 'groupRole', 'OWNER_LABELS'],
  '职位': ['role_in_group', 'groupRole'],
  '教师批注': ['saveTeacherNote', 'teacher_notes', 'fetchMyNotes'],
  '批注打分': ['saveTeacherNote', 'fetchMyNotes', 'replyTier'],
  '资金': ['isBankrupt', 'capital'],
  '破产': ['isBankrupt'],
  '日引擎': ['dayEngine', 'simulateDay'],
  '房量': ['parseRooms'],
  '差评处理率': ['handleStats', 'negativeScore'],
  '实时评价': ['liveReview', 'LiveFeed'],
  '结算': ['settle'],
  '决策流水': ['saveDecisionLog', 'decision_log'],
  '防作弊': ['决策模式异常一致', 'insights'],
}
const MARK_RE = /(❌|⬜|未完成|未开始|未做|未实施|待录入|待实施|还没做|尚未做)/
const KEYWORD_STRIP = /[:,，。；'"「」『』（）()、\s｜|]/g

// grep 代码：内容 + 文件名都搜（preflight Bug1 教训）
function grepSrc(keyword) {
  try {
    const out = execFileSync('grep', ['-rl', '-F', keyword, 'src/'], { encoding: 'utf8', cwd: 'D:/教学app/hotel-app', timeout: 30000 })
    const files = out.trim().split('\n').filter(Boolean)
      .filter(f => !/settle-old-|\.bak$/.test(f))   // 测试夹具/备份的命中不算"功能已实现"
    const strong = []
    for (const f of files) {
      let body = ''
      try { body = readFileSync('D:/教学app/hotel-app/' + f, 'utf8') } catch (e) { continue }
      // 非注释行里真的出现该词才算强命中（防"文档提到、代码只在注释里出现"的弱命中）
      const codeLines = body.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/\/\/.*$/, ''))
      if (codeLines.some(l => l.includes(keyword))) strong.push(f)
    }
    return strong
  } catch (e) { return [] }   // grep 无命中 exit 1
}

let stale = [], checked = 0
for (const dir of DOC_DIRS) {
  if (!existsSync(dir)) continue
  for (const f of readdirSync(dir).filter(x => x.endsWith('.md'))) {
    const path = dir + '/' + f
    const lines = readFileSync(path, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (!MARK_RE.test(line)) return
      if (line.includes('已加顶部标注') || line.includes('文档过期清单') || line.includes('★') && line.includes('过期')) return
      if (/^#{1,4}\s*(⬜|❌)?\s*未完成/.test(line.trim())) return   // 纯章节标题（如"### ⬜ 未完成"）不算条目
      if (f === '总任务包-设计落地与数据补全.md' && i === 372) return   // M3 自身正则文本（自指）
      if (line.includes('MARK_RE') || line.includes('docs-staleness') || /\S\s\S/.test(line) && line.includes('待录入|待实施')) return   // 跳过本脚本正则被扫描时的自指
      // 提取关键词：优先反引号/「」/加粗，取不到取最长连续中文段（≥3字）
      let kw = null
      const cand = line.match(/`([^`]{2,24})`|「([^」]{2,24})」|\*\*([^*]{2,24})\*\*/)
      if (cand) kw = (cand[1] || cand[2] || cand[3]).trim()
      if (!kw) {
        const zh = line.replace(MARK_RE, ' ').split(KEYWORD_STRIP).filter(s => /[\u4e00-\u9fa5]{3,}/.test(s) && s.length >= 3 && s.length <= 20)
        // 表格行（| a | b |）优先取【第二列】（通常是功能名，第一列常是编号/图标）
        const cells = line.split('|').map(c => c.trim()).filter(c => /[\u4e00-\u9fa5]{2,}/.test(c))
        if (cells.length >= 2 && /功能|模块|体系|项/.test(cells[0])) kw = cells[1]
        if (!kw) { zh.sort((a, b) => b.length - a.length); kw = zh[0] }
      }
      if (!kw) return
      checked++
      // ALIAS 命中规则：关键词【包含】某个别名键即展开（"班级分组职位体系"含"职位体系"）
      const aliasKeys = Object.keys(ALIAS).filter(k => (kw || '').includes(k))
      const terms = aliasKeys.flatMap(k => [k, ...ALIAS[k]])
      let hits = [], usedKw = kw
      for (const t of terms) { const h = grepSrc(t); if (h.length) { hits = h; usedKw = t + (t !== kw ? '（别名命中）' : ''); break } }
      if (hits.length) stale.push({ doc: f + ':' + (i + 1), kw: usedKw, line: line.trim().slice(0, 70), hits: hits.slice(0, 3) })
    })
  }
}

console.log('▶ M3 文档过期自检（报告模式）')
console.log(`  扫描：${DOC_DIRS.join(' , ')} · 带"未完成"标记的关键词条目 ${checked} 条`)
if (!stale.length) {
  console.log('  ✅ 未发现"文档说没做、代码里有"的过期项')
} else {
  console.log(`  ⚠️ 疑似过期 ${stale.length} 处（文档说没做 / 代码里有命中）：`)
  const seen = new Set()
  for (const s of stale) {
    const key = s.kw
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`   · [${s.kw}] ${s.doc}`)
    console.log(`     原话：${s.line}`)
    console.log(`     代码命中：${s.hits.join(', ')}`)
    console.log(`     建议：人工确认后改标注为 ✅ 或移入归档（本脚本不自动改）`)
  }
}
console.log(`\n结果: ${stale.length === 0 ? checked : stale.length} 通过 / 0 失败（报告模式，不阻塞门禁）`)
process.exit(0)
