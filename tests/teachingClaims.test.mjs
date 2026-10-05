// §33-V7 · 教辅守门 —— 防"讲义也乱说"（声明了没发生的教辅版）
// 机制标记：【机制:关键词】—— 讲义里凡提到系统机制都用此标记；断言每个关键词都能在 src/ 查到。
// 黑名单：讲义里不许出现已知不存在的功能名。
// 运行：node tests/teachingClaims.test.mjs   （挂 run-all fast）
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const 材料 = path.join(ROOT, '7-教学材料')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// ── 代码语料（src/** · 与 docs-staleness 同法）──
const SRC_DIR = path.join(APP, 'src')
const corpus = []
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (!/\.(js|jsx|mjs)$/.test(f)) continue
    if (/settle-old-|\.bak$/.test(f)) continue
    let body = ''
    try { body = readFileSync(p, 'utf8') } catch (e) { continue }
    corpus.push({ file: 'src/' + f, body })
  }
}
walk(SRC_DIR)
const 查src = (kw) => corpus.filter(c => c.body.includes(kw))

// ── ① 收集教辅材料里的全部机制标记 ──
console.log('▶ §33-V7 教辅守门（机制标记查 src · 黑名单反向断言）')
ok(existsSync(材料), '7-教学材料/ 目录存在')
const 材料文件 = existsSync(材料) ? readdirSync(材料).filter(f => f.endsWith('.md')) : []
ok(材料文件.length >= 4, `教辅材料 ≥4 份（现 ${材料文件.length}：${材料文件.join(' · ')}）`)

const 标记 = []   // { 文件, 关键词, 行 }
for (const f of 材料文件) {
  const lines = readFileSync(path.join(材料, f), 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/【机制:([^】]+)】/g)) 标记.push({ 文件: f, 关键词: m[1], 行: `:${i + 1}` })
  })
}
const 去重标记 = [...new Set(标记.map(t => t.关键词))]
console.log(`  标记总数 ${标记.length} · 去重关键词 ${去重标记.length} 个：${去重标记.join(' · ')}`)
ok(标记.length >= 15, `机制标记 ≥15 处（现 ${标记.length}——覆盖讲义+脚本+模板三份）`)
ok(去重标记.length >= 10, `去重机制关键词 ≥10 个（现 ${去重标记.length}）`)

// ── ② 每个标记关键词都能在 src/ 查到 ──
const 查不到 = []
for (const kw of 去重标记) {
  const hits = 查src(kw)
  if (!hits.length) 查不到.push(kw)
}
ok(查不到.length === 0, '★ 每个机制关键词都能在 src/ 查到（缺失 = 讲义在说系统没有的东西）',
  查不到.map(k => `【机制:${k}】`).join(' · '))
for (const kw of 去重标记) {
  const hits = 查src(kw)
  ok(hits.length > 0, `  【机制:${kw}】→ ${hits.map(h => h.file).join(', ')}`)
}

// ── ③ 反向断言：黑名单（已知不存在的功能名 · 讲义不许出现）──
const 黑名单 = [
  '自动排班助手',     // 用户曾误以为有 · 实际排班是手动决策 shifts
  '一键排班',
  'AI 定价精灵',      // 不存在的拟人功能名（领班是授权代管不是精灵）
  '自动生成周报邮件',  // 无邮件功能
  '微信通知推送',      // 无推送功能
  '语音播报',
  '会员积分商城',
  '自动回复差评机器人', // 差评回复是学生手选，无机器人
]
const 命中黑名单 = []
for (const f of 材料文件) {
  const text = readFileSync(path.join(材料, f), 'utf8')
  for (const b of 黑名单) if (text.includes(b)) 命中黑名单.push(`${f} 含「${b}」`)
}
ok(命中黑名单.length === 0, '★ 反向断言：讲义零黑名单功能名（不写系统没有的功能）', 命中黑名单.join(' · '))

// ── ④ 课程参数抽查（数字一律现读，不许凭记忆）──
{
  const 讲义 = readFileSync(path.join(材料, '12周课堂讲义.md'), 'utf8')
  const { decisions } = await import('../src/decisions.js')
  const { SEMESTER } = await import('../src/semester.mjs')
  ok(decisions.length === 18 && 讲义.includes('18 项决策'), `18 项决策（src 实读 ${decisions.length}）`)
  ok(Number(SEMESTER?.TOTAL_WEEKS ?? SEMESTER?.weeks ?? 12) === 12 && 讲义.includes('12 周'), '12 周（semester 单源）')
  const { districts } = await import('../src/siteLocations.mjs')
  const 区县数 = Object.values(districts).reduce((a, arr) => a + arr.length, 0)
  ok(区县数 === 26 && 讲义.includes('26 个区县'), `26 区县（siteLocations 实读 ${区县数}）`)
  // 事件库数量：讲义说 35 条（V8 实况）
  const { 注入事件库 } = await import('../src/teacherEvents.mjs')
  ok(注入事件库.length === 35 && (讲义.includes('35 条') || 讲义.includes('35 条内置')), `事件库 35 条（实读 ${注入事件库.length}）`)
}

// ── ⑤ 不碰评分（反向：讲义不给评分细则/等级标准）──
{
  const 讲义 = readFileSync(path.join(材料, '12周课堂讲义.md'), 'utf8')
  const 上手 = readFileSync(path.join(材料, '老师30分钟上手单页.md'), 'utf8')
  const 评分词 = ['评分细则：', '评语模板', '等级标准：A=', '90分以上为优']
  const 违规 = []
  for (const t of [讲义, 上手]) for (const w of 评分词) if (t.includes(w)) 违规.push(w)
  ok(违规.length === 0, '★ 不碰评分：讲义/上手页零评分细则与等级标准（成绩归老师）', 违规.join(' · '))
}


// ── ⑤ V20批1：教学点对照表 v2（18 项决策 × 4 要素）──────────
{
  const f2 = path.join(材料, '教学点对照表-v2-18项决策.md')
  ok(existsSync(f2), '⑤ 教学点对照表 v2 存在')
  if (existsSync(f2)) {
    const t2 = readFileSync(f2, 'utf8')
    const rows = t2.split(/\r?\n/).filter(l => /^\| \d+ \|/.test(l))   // V20批1：逐格行（| N | 开头）
    ok(rows.length === 18, `⑤ v2 表逐格行数 === 18（实读 ${rows.length}）`)
    const 缺要素 = rows.filter(r => { const cells = r.split('|').map(c => c.trim()).filter(c => c !== ''); return cells.length !== 6 || cells.slice(2).some(c => !c) })
    ok(缺要素.length === 0, '⑤ 每行四要素非空（逻辑/锚点/问法/位置）', 缺要素.slice(0, 2).join(' | '))
    const 坏锚 = []
    for (const r of rows) {
      for (const m of r.matchAll(/【机制:([^】]+)】/g)) { if (!查src(m[1]).length) 坏锚.push(m[1]) }
    }
    ok(坏锚.length === 0, '⑤ v2 表每个机制锚点都在 src 实读命中', [...new Set(坏锚)].map(k => `【机制:${k}】`).join(' · '))
    // 18 个决策名与 decisions.js 一致（逐名出现在对应行）
    const decSrc = readFileSync(path.join(APP, 'src', 'decisions.js'), 'utf8')
    const names = [...decSrc.matchAll(/name: '([^']+)'/g)].map(m => m[1])
    const 缺名 = names.filter(n => !rows.some(r => r.includes(`| ${n}（`) || r.includes(` ${n}（`)))
    ok(缺名.length === 0, `⑤ v2 表覆盖 decisions.js 全部 ${names.length} 个决策名`, 缺名.join(' · '))
  }
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：教辅材料与代码同源——「声明了没发生」在教辅层也守门（§33-V7②）')
process.exit(fail ? 1 : 0)
