// M1 · 承诺一致性自检（防"文案承诺了、代码没实现"）
//
// 起因：App.jsx / TeacherDashboard.jsx 三处写"教师打分计入期末总评10%"，
//       但 FinalResult 的四维权重合计 = 1.00，【没有教师分项】→ 承诺失真。
//
// 原理：文案里的【数值承诺】↔ 代码里的【权重计算】，对不上就报红。
//
// 用法：node tests/promise-consistency.mjs
// 退出码：0 = 全部兑现；1 = 有承诺未兑现

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(__dirname, '..')
const SRC = path.join(APP, 'src')

const readIf = p => { try { return fs.readFileSync(p, 'utf8') } catch { return null } }

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

// ── 1. 收集"数值承诺" ────────────────────────────────────────────
// 只认【承诺句式】—— 避免把"跟降10%"这类业务数值误判为权重承诺
const PROMISE_PATTERNS = [
  { re: /计入[^，。；、\n）)]{0,10}?(\d+(?:\.\d+)?)\s*%/g, label: '计入…%' },
  { re: /权重\s*[:：]?\s*(\d+(?:\.\d+)?)\s*%/g, label: '权重…%' },
  { re: /占\s*(?:期末|总评|总分)[^，。；、\n）)]{0,6}?(\d+(?:\.\d+)?)\s*%/g, label: '占期末…%' },
]

// 明确不检查的上下文（业务数值，不是权重承诺）
const SKIP_CONTEXT = [
  /跟降\s*\d+%/, /降价\s*\d+%/, /涨价\s*\d+%/, /溢价\s*\d+%/,
  /出租率\s*\d+%/, /好评率\s*\d+%/, /毛利率/, /首付\s*\d+%/,
  /占营收/, /佣金/, /抽成/, /CRS/, /折扣/,
]

const promises = []
for (const f of walk(SRC, ['.js', '.jsx'])) {
  const txt = readIf(f)
  if (!txt) continue
  const lines = txt.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 只看"文案行"：含中文且被引号包裹的内容
    if (!/[\u4e00-\u9fa5]/.test(line)) continue
    for (const { re, label } of PROMISE_PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        const snippet = line.slice(Math.max(0, m.index - 12), m.index + m[0].length + 6)
        if (SKIP_CONTEXT.some(s => s.test(snippet))) continue
        promises.push({
          file: path.relative(APP, f).replace(/\\/g, '/'),
          line: i + 1,
          pct: Number(m[1]),
          label,
          text: line.trim().slice(0, 130),
        })
      }
    }
  }
}

// ── 2. 收集"权重计算" ────────────────────────────────────────────
// 找 finalScore / score = ... * 0.xx 之类的加权式
const WEIGHT_PATTERNS = [
  /(?:finalScore|totalScore|score)\s*=\s*([^\n;]+)/g,
]
const weightsFound = []   // { file, line, weights: [0.4, 0.25, ...], expr }
for (const f of walk(SRC, ['.js', '.jsx'])) {
  const txt = readIf(f)
  if (!txt) continue
  const lines = txt.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const re of WEIGHT_PATTERNS) {
      re.lastIndex = 0
      const m = re.exec(lines[i])
      if (!m) continue
      const w = []
      const wr = /\*\s*0\.(\d+)/g
      let wm
      while ((wm = wr.exec(m[1])) !== null) w.push(Number('0.' + wm[1]))
      if (w.length) weightsFound.push({ file: path.relative(APP, f).replace(/\\/g, '/'), line: i + 1, weights: w, expr: m[1].trim().slice(0, 90) })
    }
  }
}

// 代码里【真正参与加权计算】的权重集合
// ★ 血案（2026-09-26）：第一版用"全库出现过的小数"判定，
//    结果 0.1 在别处出现过 → "教师打分10%"被误判为【已兑现】→ 假绿！
//    正解：只认【权重计算式里】的数字。承诺的百分比必须真的参与计算。
const implementedWeights = new Set()
for (const w of weightsFound) for (const x of w.weights) implementedWeights.add(x)

// ── 3. 比对 ─────────────────────────────────────────────────────
const WHITELIST = [
  // 形如 { match: '某段文案特征', reason: '...' }
  // 用于登记"确实只是说明性文案、非承诺"的例外。每条必须写明理由。
]

const results = []
for (const p of promises) {
  const dec = Number((p.pct / 100).toFixed(4))
  const hit = implementedWeights.has(dec)
  const wl = WHITELIST.find(w => p.text.includes(w.match))
  results.push({ ...p, decimal: dec, hit, whitelisted: !!wl, reason: wl?.reason })
}

const bad = results.filter(r => !r.hit && !r.whitelisted)
const good = results.filter(r => r.hit || r.whitelisted)

// 权重和检查：加权式之和应为 1.00（否则可能漏了一项）
const sumIssues = weightsFound.filter(w => {
  const s = w.weights.reduce((a, b) => a + b, 0)
  return Math.abs(s - 1) > 0.001
})

// ── 4. 输出 ─────────────────────────────────────────────────────
console.log('')
console.log('════════════════════════════════════════════════')
console.log('  M1 · 承诺一致性自检')
console.log('════════════════════════════════════════════════')
console.log('')
console.log('  扫描到的权重计算式：')
for (const w of weightsFound) {
  const sum = w.weights.reduce((a, b) => a + b, 0)
  const flag = Math.abs(sum - 1) > 0.001 ? '  ⚠️ Σ≠1.00' : ''
  console.log('   · ' + w.file + ':' + w.line + '  Σ=' + sum.toFixed(2) + '  [' + w.weights.join(' + ') + ']' + flag)
}
console.log('')
console.log('  已实现的权重集：{' + [...implementedWeights].join(', ') + '}')
console.log('')
console.log('  文案承诺：' + promises.length + ' 条 ｜ 兑现 ' + good.length + ' ｜ 未兑现 ' + bad.length)
console.log('')

if (bad.length) {
  console.log('  ✗ 未兑现的承诺（文案说了、代码里找不到对应的权重）：')
  for (const b of bad) {
    console.log('   · ' + b.file + ':' + b.line + '  【' + b.pct + '%】(' + b.label + ')')
    console.log('       ' + b.text)
    console.log('       ⇒ 代码中未出现 ' + b.decimal + ' 这个权重')
  }
  console.log('')
}
if (good.length) {
  console.log('  ✓ 已兑现：' + good.length + ' 条')
  for (const g of good.slice(0, 8)) {
    console.log('   · ' + g.file + ':' + g.line + '  【' + g.pct + '%】' + (g.whitelisted ? ' (白名单)' : ''))
  }
  if (good.length > 8) console.log('   … 另 ' + (good.length - 8) + ' 条')
  console.log('')
}

console.log('────────── 结论 ──────────')
if (bad.length === 0 && sumIssues.length === 0) {
  console.log('  ✓ 所有数值承诺均已兑现，且权重和 = 1.00')
} else {
  if (sumIssues.length) {
    console.log('  ⚠️ ' + sumIssues.length + ' 处权重和 ≠ 1.00（可能漏了分项）')
  }
  if (bad.length) {
    console.log('  ⚠️ ' + bad.length + ' 条承诺未兑现 —— 二选一：')
    console.log('     (a) 补实现（让代码真的按承诺算）')
    console.log('     (b) 改文案（删掉不实的承诺）')
    console.log('     ★ 现状"说了不算"是最坏的，必须择一。')
  }
}
console.log('')

// 统一尾行格式，便于 run-all 汇总统计
console.log(good.length + ' 通过 / ' + (bad.length + sumIssues.length) + ' 失败')
console.log('')

process.exit((bad.length || sumIssues.length) ? 1 : 0)
