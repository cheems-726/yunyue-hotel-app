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
  // ★ §32-U3（2026-09-30）：长跑报告从 v5 升到 **v6**（世界层上线 · 六组数字全刷新）——
  //   判据跟着产物走（不是放宽：仍要求"现行版 + 真实链路"两件事齐备，只是版本号前进一档）。
  // ★ §33-V4（2026-10-01）：v6 → **v7**（A8 选址两维接线）· ★ §33-V6（2026-10-02）：v7 → **v8**（客群结构加权）——
  //   同款递进，判据不放宽（仍要求"现行版 + 真实链路"两件齐备）。
  gok(/v8（本报告）/.test(lr) && /真实链路/.test(lr), '长跑报告 = v8 现行（真实链路 · 含两费/一次性/世界层/A8 两维/V6 客群加权）')

  // ── ★ §33-V1（D100 · 2026-10-01）：进度文档锚点断言（[d] 段 · A01–A22）────────────
  //   出处：`4-审计与报告/进度文档-锚点对照表.md` §四 —— "每个百分比都能指到可复跑的锚点"的机器化。
  //   原则：**数字变了要红**（A08/A09/A16）· **状态变了也要红**（A11–A15/A17）· 横幅/指针被拿掉要红（A01–A07/A19–A22）。
  console.log('\n▶ M3 --gate [d]：§33-V1 进度文档锚点断言（A01–A22 · 对照表 §四）')
  const G1 = rd(path2.join(ROOT2, '1-总纲与进度', 'App现状全景评估.md')) || ''
  const G2 = rd(path2.join(ROOT2, '1-总纲与进度', '需求要点统合-现状对照.md')) || ''
  const G3 = rd(path2.join(ROOT2, '1-总纲与进度', '项目进度总纲.md')) || ''
  const G4 = rd(path2.join(ROOT2, '1-总纲与进度', '华住酒店运营模拟系统-项目交接文档.md')) || ''
  const G5 = rd(path2.join(ROOT2, '1-总纲与进度', '后续开发路线图-四件套规格.md')) || ''
  const G6 = rd(path2.join(ROOT2, '1-总纲与进度', '酒店管理教学系统-设计方案.md')) || ''
  const G7 = rd(path2.join(ROOT2, '1-总纲与进度', '长效任务总表（总纲·开工先读）.md')) || ''
  const G8 = rd(path2.join(ROOT2, '1-总纲与进度', '需求-全量开发任务细化方案.md')) || ''
  const G9 = rd(path2.join(ROOT2, '1-总纲与进度', '酒店模拟经营教学APP_全量开发任务细化方案.txt')) || ''
  const G10 = rd(path2.join(ROOT2, '1-总纲与进度', '交接文档-新会话必读.md')) || ''
  const REG = rd(path2.join(ROOT2, '1-总纲与进度', '决策登记册.md')) || ''
  // 代码语料（A16 用）：src/** 文件名缓存
  const srcFiles = []
  try { for (const f of readdirSync(SRC_DIR)) if (/\.(js|jsx|mjs)$/.test(f)) srcFiles.push(f) } catch (e) {}
  const srcHit = (kw) => srcFiles.filter(f => { try { return readFileSync(join(SRC_DIR, f), 'utf8').includes(kw) } catch (e) { return false } }).length

  // A01–A04 过期横幅必须存在（四份历史文档）
  gok(G1.slice(0, 1200).includes('已过期'), 'A01 App现状全景评估：头部带「已过期」横幅', '横幅被删 ⇒ 过期文档伪装成现行')
  gok(G2.slice(0, 1200).includes('已过期'), 'A02 需求要点统合：头部带「已过期」标注')
  gok(G3.slice(0, 1200).includes('过期'), 'A03 项目进度总纲：头部带「过期」标注')
  gok(G4.slice(0, 1200).includes('已被取代'), 'A04 华住交接文档：头部带「已被取代」')
  // A05–A06 V1 处置标注（仅历史）
  gok(G1.slice(0, 1600).includes('仅历史'), 'A05 App现状全景评估：头部带「仅历史」（V1 处置 · 不作现状引用）')
  gok(G2.slice(0, 1600).includes('仅历史'), 'A06 需求要点统合：头部带「仅历史」（达成表整体作废）')
  // A07 需求原文头部行
  gok(G8.slice(0, 300).includes('需求原文'), 'A07a 需求-全量开发任务细化方案.md：头部标「需求原文」（只读不改）')
  gok(G9.slice(0, 300).includes('需求原文'), 'A07b 全量开发任务细化方案.txt：头部标「需求原文」')
  // A08/A09 长效总表门禁数字 === 门禁记录（数字变了要红）
  if (gateRec.full && gateRec.full.head) {
    const mFull = /全量 \*\*(\d{3,}) 通过/.exec(G7) || /全量 \*\*(\d{3,}) 条断言/.exec(G7)
    gok(mFull && Number(mFull[1]) === gateRec.full.通过, `A08 长效总表「全量 N」=== 门禁记录（${gateRec.full.通过}）`, mFull ? `卡内=${mFull[1]}` : '未找到全量数字行')
    const mFast = /快检 \*\*(\d{3,})\/0\*\*/.exec(G7)
    gok(mFast && Number(mFast[1]) === gateRec.fast.通过, `A09 长效总表「快检 M/0」=== 门禁记录（${gateRec.fast.通过}）`, mFast ? `卡内=${mFast[1]}` : '未找到快检数字行')
  } else gok(true, '（A08/A09：尚无门禁记录 ⇒ 不判）')
  // A10 旧 D 上限不得回归
  gok(!/D1–D74/.test(G7) || /D1–D100/.test(G7), 'A10 长效总表：无旧上限「D1–D74」（现 D1–D100）', '回写旧 D 上限 ⇒ 红')
  // A11–A15 状态断言（"已完成"改回"未做"要红）
  gok(/一键图文报告已上线/.test(G7), 'A11 长效总表 模块六：一键图文报告已上线（U2 · D89）', '状态回退成"缺" ⇒ 红')
  gok(!/grep `上热门` ⇒ \*\*0\*\*/.test(G7), 'A12 长效总表 B12：不写「上热门 ⇒ 0」（已实现 · hotReview 23 断言）', '把已完成改回未做 ⇒ 红')
  gok(/B14.*✅ \*\*已实施\*\*/.test(G7.replace(/\n/g, ' ')), 'A13 长效总表 B14：职务加成标「已实施」', '状态回退 ⇒ 红')
  gok(/B15.*✅ \*\*已实施\*\*/.test(G7.replace(/\n/g, ' ')), 'A14 长效总表 B15：决策风险化标「已实施」', '状态回退 ⇒ 红')
  gok(!/\| \*\*B4\*\|[^\n]*⏸ \*\*未开工\*\*/.test(G7), 'A15 长效总表 B4：三期不写「未开工」（U8+U8-补 · D99 已交付）', '三期被写回未开工 ⇒ 红')
  // A16 R7 状态与代码互证（数字变了也要红）
  {
    const mR7 = /handover\|移交[^）]*）[^→]*→ \*\*(\d+)\*\*/.exec(G5) || /`handover\\?\|移交[^`]*`\s*→\s*\*\*(\d+)\*\*/.exec(G5)
    const 实际 = srcHit('handover') + srcHit('强制移交')
    if (mR7) gok(Number(mR7[1]) === 实际, `A16 路线图 R7 命中数 === src 实测（表内 ${mR7[1]} / 实际 ${实际}）`, 'R7 状态与代码不符 ⇒ 红')
    else gok(srcHit('handover') === 0, 'A16 路线图 R7：src 中 handover/强制移交 零命中（真缺口 · V2 排期依据）', `出现命中 ${srcHit('handover')} ⇒ R7 状态必须更新（对照表同步）`)
  }
  // A17 路线图 R8 状态行
  gok(/R8 · 教师端决策流水视图（★ V1 核定 2026-10-01：\*\*已完成\*\*）/.test(G5), 'A17 路线图 R8：V1 核定状态行存在（已完成）', '状态回退/被删 ⇒ 红')
  // A18/A19 登记册（豁免依据 + 近期编号）
  for (const d of ['D96', 'D97', 'D99', 'D100']) gok(REG.includes(d), `A18 登记册含 ${d}（近期过审编号在册）`, '登记册被回改/截断 ⇒ 红')
  gok(/不许重开讨论/.test(REG.slice(0, 600)), 'A19 登记册头部「不许重开讨论」在（整段豁免的依据）')
  // A20/A21 交接必读（历史快照标注 + 失实行更正）
  gok(G10.slice(0, 1200).includes('仅历史'), 'A20 交接必读：头部带「仅历史」快照标注 + 现行指针', '拿掉诚实标注 ⇒ 红')
  gok(!/negativeScore（15%维度，待改）/.test(G10), 'A21 交接必读 :295：无「negativeScore 待改」失实描述（A4 已实施）', '失实描述回归 ⇒ 红')
  // A22 设计方案指针
  gok(G6.slice(0, 1200).includes('现行参数一律以') || G6.slice(0, 1200).includes('现行参数以'), 'A22 设计方案：头部带「现行参数以代码为准」指针')

  console.log(`\n结果: ${gp} 通过 / ${gf} 失败（--gate 判死模式）`)
  console.log('RV：把 AGENTS.md 门禁数字改成 9999 ⇒ 本模式必红（夜跑已实测 docs-sync 对它失明）')
  process.exit(gf ? 1 : 0)
}

process.exit(0)
