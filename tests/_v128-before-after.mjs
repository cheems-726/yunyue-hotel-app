// V128-#2 零变化对照（evidence · 不进 run-all）
// 目的：证明四个出口只在【注入 + 应对】时生效 —— 无注入 / 有注入但无应对 ⇒ 整周结算与改前**逐字节一致**。
// 方法：从 git HEAD 取改前 settlement.js（V127），与当前版本喂同一存档/同一批决策，JSON 逐字节比较。
// 运行：node tests/_v128-before-after.mjs
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decisions } from '../src/decisions.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = path.join(APP, 'src', '_settlement_head_tmp.mjs')

const DEC = (() => {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const a = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, a + (i === 0 ? d.total - a * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
})()
const BASE = {
  site: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2, district: '锦江区' },
  brand: { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' },
  decisions: DEC, week: 1, attrs: { quality: 60, reputation: 70, morale: 65 }, prevCapital: 1490000, bizMode: 'direct',
}
const E7 = { week: 1, source: 'teacher', 来源事件: 'E7', name: '📌 老师注入 · 员工集体请辞威胁', text: 'x' }
const E3 = { week: 1, source: 'teacher', 来源事件: 'E3', name: '📌 老师注入 · 卫生突检', text: 'y' }

let 旧
try {
  旧 = execFileSync('git', ['show', 'HEAD:src/settlement.js'], { cwd: APP, encoding: 'utf8' })
} catch (e) {
  console.error('✗ 取不到 HEAD:src/settlement.js'); process.exit(1)
}
writeFileSync(TMP, 旧, 'utf8')

let 全过 = true
try {
  const oldMod = await import(pathToFileURL(TMP).href + '?v=' + Date.now())
  const newMod = await import(pathToFileURL(path.join(APP, 'src', 'settlement.js')).href)
  const 例 = [
    { 名: '无注入', extra: {} },
    { 名: '注入 E7 但无应对（改前=士气 −10）', extra: { injectedEvents: [E7] } },
    { 名: '注入 E3 但无应对（改前=卫生决策决定全额/减半）', extra: { injectedEvents: [E3] } },
    { 名: '注入 E3+E7 但无应对', extra: { injectedEvents: [E3, E7] } },
  ]
  for (const x of 例) {
    const a = oldMod.settle({ ...BASE, ...x.extra })
    const b = newMod.settle({ ...BASE, ...x.extra })
    const 同 = JSON.stringify(a) === JSON.stringify(b)
    console.log(`  ${同 ? '✓' : '✗'} ${x.名}：整周结算${同 ? '逐字节一致' : '出现差异'}（利润 ${a.profit} / 资本 ${a.capital}）`)
    if (!同) {
      全过 = false
      const 异 = Object.keys({ ...a, ...b }).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
      console.log('    差异键：' + 异.slice(0, 8).join(', '))
    }
  }
  console.log(`\n结果: ${全过 ? '零变化成立' : '零变化不成立'}（改前 = HEAD:src/settlement.js · 改后 = 当前工作区）`)
  process.exitCode = 全过 ? 0 : 1
} finally {
  try { if (existsSync(TMP)) unlinkSync(TMP) } catch (e) {
    try { spawn('cmd', ['/c', `ping 127.0.0.1 -n 3 >nul & del /f /q "${TMP}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref() } catch (e2) {}
  }
}
