// V105 E1+E2（跑法甲：引擎直调）· 六性格 × 12 周 · 纯 Node 离线跑（无浏览器无 AI · 确定性可复现）
// 用法：node scripts/v105-run.mjs [--smoke]        # --smoke = E1 冒烟（1 组 1 周）
// 产出：4-审计与报告/V105-引擎直调/v105-轨迹.{json,csv} + 控制台对照表
// 判据（单元卡 §4）：① 六组轨迹互不相同 ② 无 NaN/异常 ③ 可复现（同命令同结果）
import { settle } from '../src/settlement.js'
import { decisions as 决策库 } from '../src/decisions.js'
import { districts } from '../src/siteLocations.mjs'
import { brandGroups } from '../src/brands.mjs'
import { 性格规则, 站点, 品牌 } from './v105-personas.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SMOKE = process.argv.includes('--smoke')
const 周 = SMOKE ? 1 : 12

const site = districts['锦江区'] || Object.values(districts).flat().find(d => d.name === 站点)
const brand = brandGroups.flatMap(g => g.brands).find(b => b.name === 品牌)
if (!site || !brand) { console.error('✗ 站点/品牌取不到'); process.exit(1) }

// 规则解析： shifts 条件式按【上周出租率】解释；其余逐字进 decisions
function 组决策(规则, 上周) {
  const shifts = 规则.shifts.startsWith('按出租率')
    ? ((上周 && Number(上周.occupancy) >= 80) ? '满编保服务' : '精简省成本')
    : 规则.shifts
  return { ...规则, shifts }
}

// 合法值自检（卡 §8①：合法值表从 decisions.js 动态取）
let 非法 = 0
for (const { group, 性格, 规则 } of 性格规则) {
  for (const d of 决策库) {
    const v = 规则[d.id]
    if (v === undefined) { console.error(`✗ ${性格} 缺决策 ${d.id}`); 非法++; continue }
    if (d.type === 'option' && !d.options.some(o => o.label === v) && !(d.id === 'shifts' && String(v).startsWith('按出租率'))) { console.error(`✗ ${性格} ${d.id} 非法 label：${v}`); 非法++ }
    if (d.type === 'slider' && (v < d.min || v > d.max)) { console.error(`✗ ${性格} ${d.id} 越界：${v}`); 非法++ }
  }
}
if (非法) process.exit(1)
console.log('✓ 规则表合法值自检通过（6 组 × 18 项）')

// 循环：每组 12 周
const out = { 站点, 品牌, 组: [] }   // ★ 判据④可复现：不在产物里放时间戳（时间戳只进控制台）
console.log('生成时间:', new Date().toISOString())
for (const { group, 性格, 规则 } of 性格规则) {
  let capital = 1490000
  let attrs = null
  let prevGoodRate = null
  const history = []
  const 轨迹 = []
  for (let w = 1; w <= 周; w++) {
    const 上周 = history[history.length - 1] || null
    const decisions = 组决策(规则, 上周)
    const r = settle({
      site, brand, decisions, week: w,
      prevGoodRate, prevCapital: capital, attrs,
    })
    capital = r.capital != null ? r.capital : capital + (r.netProfit || 0)
    attrs = r.attrsAfter || attrs
    prevGoodRate = r.finalGoodRate
    history.push(r)
    轨迹.push({ 周: w, 营收: r.revenue, 出租率: r.occupancy, 好评率: r.finalGoodRate, 净利: r.netProfit, 资金: capital })
  }
  out.组.push({ group, 性格, 轨迹 })
  console.log(`${性格}：12 周累计净利 ${轨迹.reduce((a, t) => a + t.净利, 0).toLocaleString()} 元 · 期末资金 ${capital.toLocaleString()}`)
}

// 判据①：六组轨迹互不相同
const sig = out.组.map(g => JSON.stringify(g.轨迹.map(t => [t.营收, t.净利])))
const 互异 = new Set(sig).size === out.组.length
console.log(互异 ? '✓ 判据①：六组轨迹两两不同' : '✗ 判据①：存在相同轨迹 ⇒ 脚本未生效')
// 判据②：无 NaN
const flat = JSON.stringify(out)
const 无NaN = !/NaN|Infinity/.test(flat)
console.log(无NaN ? '✓ 判据②：全程无 NaN/Infinity' : '✗ 判据②：出现 NaN/Infinity')

if (!SMOKE) {
  const dir = 'D:/教学app/4-审计与报告/V105-引擎直调'
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'v105-轨迹.json'), JSON.stringify(out, null, 1))
  const rows = ['组,性格,周,营收,出租率,好评率,净利,资金']
  for (const g of out.组) for (const t of g.轨迹) rows.push([g.group, g.性格, t.周, t.营收, t.出租率, t.好评率, t.净利, t.资金].join(','))
  writeFileSync(join(dir, 'v105-轨迹.csv'), rows.join('\n'))
  console.log('产出：' + dir + '/v105-轨迹.{json,csv}')
}
if (!互异 || !无NaN) process.exit(1)
