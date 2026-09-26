// M0 · 开工前查重（防返工机制 · 第一道闸）
//
// 用途：任何任务开工前，先问一次"这件事定过没有 / 做过没有 / 在哪个包"
//      一次性回答，避免"重复开工"与"重做已完成的东西"
//
// 用法：node tests/preflight.mjs <关键词>
//       node tests/preflight.mjs dayEngine
//       node tests/preflight.mjs 教师打分
//
// 退出码：0 = 一切正常（信息已给出）；1 = 发现"已被取代的包"命中（需人工确认）
// 依据：决策登记册 P1/P2/P3

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(__dirname, '..')           // hotel-app/
const ROOT = path.resolve(APP, '..')                // 教学app/

const KW = process.argv.slice(2).join(' ').trim()
if (!KW) {
  console.error('用法：node tests/preflight.mjs <关键词>')
  console.error('示例：node tests/preflight.mjs dayEngine')
  process.exit(2)
}

// ★ 别名表：中文概念 → 代码里的实际标识符
//   血案：搜"职位体系"→ 代码里写的是 role_in_group → 报"无命中"→ 会重做已完成的功能
//   🔴 P0-3：抽到 tests/_alias.mjs 单一来源（docs-staleness 同步共享），本文件只 import；
//      合并了本表与旧 docs-staleness 表的差异（补 批注打分/资金/防作弊 三键）
import { ALIAS, expandTerms } from './_alias.mjs'
const terms = [KW, ...expandTerms(KW).filter(t => ALIAS[KW]?.includes(t) || KW === t || (ALIAS[KW] || []).length === 0)]
const isAliased = terms.length > 1

// ── 工具 ──────────────────────────────────────────────────────────
function readIf(p) { try { return fs.readFileSync(p, 'utf8') } catch { return null } }

function walkFiles(dir, exts, acc = [], depth = 0) {
  if (depth > 6) return acc
  let entries = []
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist' || e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkFiles(full, exts, acc, depth + 1)
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full)
  }
  return acc
}

function grepFiles(files, terms, base) {
  const hits = []
  const lowers = terms.map(t => t.toLowerCase())
  for (const f of files) {
    const txt = readIf(f)
    if (!txt) continue
    const lines = txt.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const low = lines[i].toLowerCase()
      const idx = lowers.findIndex(l => low.includes(l))
      if (idx >= 0) {
        hits.push({
          term: terms[idx],
          file: path.relative(base, f).replace(/\\/g, '/'),
          line: i + 1,
          text: lines[i].trim().slice(0, 120),
        })
        if (hits.length > 400) return hits
      }
    }
  }
  return hits
}

// ★ 文件名命中：只搜"内容"会漏掉关键文件
//   实例：src/dayEngine.js 的【文件内容里从没出现过 "dayEngine" 这个词】，
//        只搜内容会报"未做过" → 导致重做。血案，必须同时搜文件名。
function findByName(files, terms, base) {
  const hits = []
  const lowers = terms.map(t => t.toLowerCase())
  for (const f of files) {
    const baseName = path.basename(f).toLowerCase()
    const idx = lowers.findIndex(l => baseName.includes(l))
    if (idx >= 0) {
      hits.push({ term: terms[idx], file: path.relative(base, f).replace(/\\/g, '/'), line: 0, text: '（文件名命中）' })
    }
  }
  return hits
}

const out = []
const P = s => { out.push(s); console.log(s) }

P('')
P('════════════════════════════════════════════════════════')
P('  开工前查重（M0）  关键词：' + KW)
if (isAliased) P('  已自动展开别名：' + terms.slice(1).join(' / '))
P('════════════════════════════════════════════════════════')
P('')

// ── 1. 决策登记册 ────────────────────────────────────────────────
const REG = path.join(ROOT, '1-总纲与进度', '决策登记册.md')
const regTxt = readIf(REG)
const regHits = []
const regLowers = terms.map(t => t.toLowerCase())
if (regTxt) {
  const lines = regTxt.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (regLowers.some(l => lines[i].toLowerCase().includes(l))) {
      // 往上找最近的一条标题（D#/T#/###）
      let label = ''
      for (let j = i; j >= 0 && j > i - 12; j--) {
        const m = lines[j].match(/^#{2,4}\s*(.*)$/)
        if (m) { label = m[1].trim(); break }
      }
      regHits.push({ line: i + 1, label, text: lines[i].trim().slice(0, 110) })
    }
  }
}

P('【1】决策登记册（已拍板事实）')
if (!regTxt) P('  ⚠️ 读不到登记册：' + REG)
else if (regHits.length === 0) P('  （无命中 —— 这件事可能还没定过）')
else {
  for (const h of regHits.slice(0, 15)) {
    P('  · :' + h.line + (h.label ? '  [' + h.label + ']' : ''))
    P('      ' + h.text)
  }
}
P('')

// ── 2. 代码 ─────────────────────────────────────────────────────
const SRC = path.join(APP, 'src')
const srcFiles = walkFiles(SRC, ['.js', '.jsx', '.mjs'])
const nameHits = findByName(srcFiles, terms, APP)          // ★ 文件名优先展示
const codeHits = grepFiles(srcFiles, terms, APP)
const allCodeHits = [...nameHits, ...codeHits]

P('【2】代码（★ 代码为准 —— 文档说"没做"不算数）')
if (allCodeHits.length === 0) P('  （src/ 下无命中 —— 可能确实还没做）')
else {
  if (nameHits.length) {
    P('  ▸ 文件名命中（最易漏，优先看）：')
    for (const h of nameHits) P('      · ' + h.file)
  }
  if (codeHits.length) {
    const byFile = {}
    for (const h of codeHits) (byFile[h.file] ||= []).push(h)
    P('  ▸ 内容命中：')
    for (const [f, hs] of Object.entries(byFile)) {
      P('  · ' + f + '  (' + hs.length + ' 处)')
      for (const h of hs.slice(0, 3)) P('      :' + h.line + '  ' + h.text)
      if (hs.length > 3) P('      … 另 ' + (hs.length - 3) + ' 处')
    }
  }
}
P('')

// ── 3. 现行任务包 ────────────────────────────────────────────────
const CUR = path.join(ROOT, '2-任务包', '现行')
const curFiles = walkFiles(CUR, ['.md'])
const curHits = grepFiles(curFiles, terms, ROOT)

P('【3】现行任务包（唯一有效的调度文件）')
if (curFiles.length === 0) P('  ⚠️ 现行包目录为空')
else if (curHits.length === 0) P('  （现行包无命中 —— 说明这是【新需求】，需追加批次）')
else {
  for (const h of curHits.slice(0, 12)) P('  · ' + h.file + ':' + h.line)
  if (curHits.length > 12) P('  … 另 ' + (curHits.length - 12) + ' 处')
}
P('')

// ── 4. 归档包（⚠️ 警示）─────────────────────────────────────────
const ARC = path.join(ROOT, '2-任务包', '已归档-被取代')
const arcFiles = walkFiles(ARC, ['.md'])
const arcHits = grepFiles(arcFiles, terms, ROOT)

P('【4】已归档任务包')
if (arcHits.length === 0) P('  （无命中）')
else {
  P('  ⚠️ 以下归档包提到该关键词 —— 这些包【已被取代】，其内容可能已过时。')
  P('     若据此判断"未完成"，极可能重做已完成的工作。')
  const seen = new Set()
  for (const h of arcHits) {
    if (seen.has(h.file)) continue
    seen.add(h.file)
    P('  · ' + h.file)
  }
}
P('')

// ── 5. 结论 ─────────────────────────────────────────────────────
const decided = regHits.length > 0
const implemented = allCodeHits.length > 0
const inCurrent = curHits.length > 0
const inArchive = arcHits.length > 0

P('────────── 结论 ──────────')
P('  · 登记册已定过 ：' + (decided ? '✅ 是' : '— 否'))
P('  · 代码已存在  ：' + (implemented
  ? '✅ 是（文件名 ' + nameHits.length + ' + 内容 ' + codeHits.length + '）'
  : '— 否'))
P('  · 在现行包内  ：' + (inCurrent ? '✅ 是' : '— 否'))
P('  · 仅见于归档包：' + (inArchive ? '⚠️ 是（慎防按过时信息重做）' : '— 否'))
P('')
if (implemented && !inCurrent) {
  P('  ⚠️ 代码里已有，但现行包未列 —— 先确认是"已完成"还是"半成品"。')
  P('     ★ 不要直接当新任务开工。')
} else if (implemented && inCurrent) {
  P('  ⇒ 已在现行包内 → 【直接做】，不要另起炉灶。')
} else if (!implemented && inCurrent) {
  P('  ⇒ 未实现且在现行包内 → 【直接做】。')
} else if (!implemented && !inCurrent) {
  P('  ⇒ 现行包未包含 → 按「追加批次规范」并入现行包，【不要新建文件】。')
}
P('')
P('  开工三查：① 登记册定过没 ② 代码做过没 ③ 现行包含没')
P('  铁律：任何时刻只有一个现行任务包；新需求一律追加批次。')
P('')

// ── 无命中警示（★ 防止"工具说没做"导致的误判）────────────────────
if (!implemented) {
  P('────────────────────────────────────────────────────')
  P('  ⚠️  代码无命中 ≠ 一定没做过')
  P('')
  P('  代码里的标识符可能是英文/拼音，中文关键词搜不到。')
  if (!isAliased) {
    P('  本例未走别名表。建议换这些词再搜一次：')
    P('    · 英文标识符（如 role_in_group / isBankrupt / handleStats）')
    P('    · 中文近义（如"批注"替"打分"、"房间"替"房量"）')
    P('    · 或直接把新词加进本脚本的 ALIAS 表')
  } else {
    P('  本例已试别名：' + terms.slice(1).join(' / '))
    P('  仍无命中 → 可信度较高，但仍建议人工确认一次。')
  }
  P('  ★ 判定"没做过"之前，先人工看一眼相关目录。')
  P('────────────────────────────────────────────────────')
  P('')
}

// ── 落盘（留痕，便于事后追溯"当时查过什么"）──────────────────────
const outDir = path.join(ROOT, '4-审计与报告', '_逐次查重记录')
try {
  fs.mkdirSync(outDir, { recursive: true })
  const safe = KW.replace(/[\\/:*?"<>|]/g, '_')
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
  fs.writeFileSync(path.join(outDir, stamp + '_' + safe + '.txt'), out.join('\n'), 'utf8')
} catch { /* 落盘失败不影响主流程 */ }

process.exit(inArchive && !inCurrent ? 1 : 0)
