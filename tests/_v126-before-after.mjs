// V126 零变化对照（evidence · 不进 run-all）
// 目的：证明 §1/§2 只改"该不该结算、结算后清不清"，**金额算法零变化**。
// 方法：从 git HEAD 取出改前的 serverTick.mjs（V125 版本），与当前版本喂同一份存档/同一批决策，
//       剥掉新增的审计标记（决策数/决策来源/结算闸）后，整周结果必须逐字节一致。
// 运行：node tests/_v126-before-after.mjs    （需在 hotel-app 目录、git 可用）
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { decisions } from '../src/decisions.js'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = path.join(APP, 'src', '_serverTick_head_tmp.mjs')

function 十八项() {
  const o = {}
  for (const d of decisions) {
    if (d.type === 'option' || d.type === 'timer') o[d.id] = d.options[0].label
    else if (d.type === 'slider') o[d.id] = d.min ?? 0
    else if (d.type === 'budget') {
      const avg = Math.floor(d.total / d.items.length)
      o[d.id] = Object.fromEntries(d.items.map((it, i) => [it, avg + (i === 0 ? d.total - avg * d.items.length : 0)]))
    } else if (d.type === 'sort') o[d.id] = [...d.items]
  }
  return o
}
const SITE = { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 }
const BRAND = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
const mk = (d) => ({ __groupKey: 'g1', week: 1, location: SITE, brand: BRAND, attrs: { quality: 60, reputation: 70, morale: 65 }, capital: 5020000, history: [], doneDecisions: d, bizMode: 'direct' })
const 剥标 = (h) => { const { 决策数, 决策来源, 结算闸, ...rest } = (h || {}); return rest }

let 旧
try {
  旧 = execFileSync('git', ['show', 'HEAD:src/serverTick.mjs'], { cwd: APP, encoding: 'utf8' })
} catch (e) {
  console.error('✗ 取不到 HEAD:src/serverTick.mjs（需在 hotel-app 仓库内）'); process.exit(1)
}
writeFileSync(TMP, 旧, 'utf8')

try {
  const oldMod = await import(pathToFileURL(TMP).href + '?v=' + Date.now())
  const newMod = await import(pathToFileURL(path.join(APP, 'src', 'serverTick.mjs')).href)

  const 例 = [
    { 名: '18 项决策（达标，第 1 天结算）· 第 1 周', 存档: mk(十八项()), day: 1 },
    { 名: '18 项决策 · 第 1 周第 7 天（周尾）', 存档: mk(十八项()), day: 7 },
    { 名: '0 项决策 · 第 1 周（旧=首日结算 / 新=周尾兜底）', 存档: mk({}), day: 7 },
  ]
  let 全过 = true
  for (const x of 例) {
    const a = oldMod.advanceGroupOneDay(x.存档, x.day)
    const b = newMod.advanceGroupOneDay(x.存档, x.day)
    const ha = a.save.history[0] ? 剥标(a.save.history[0]) : null
    const hb = b.save.history[0] ? 剥标(b.save.history[0]) : null
    const 同 = JSON.stringify(ha) === JSON.stringify(hb)
    const 金额同 = !ha || !hb ? 同 : ['revenue', 'totalCost', 'profit', 'gop', 'capital', 'occupancy', 'finalGoodRate'].every(k => ha[k] === hb[k])
    console.log(`  ${同 && 金额同 ? '✓' : '✗'} ${x.名}：整周结果逐字节 ${同 ? '一致' : '不同'} · 关键金额 ${金额同 ? '一致' : '不同'}${hb ? `（营收 ${hb.revenue} · 利润 ${hb.profit} · 期末资金 ${hb.capital}）` : '（新版本周不结算）'}`)
    if (!(同 && 金额同)) 全过 = false
  }
  console.log(`\n结果: ${全过 ? '零变化成立' : '零变化不成立'}（改前 = HEAD:src/serverTick.mjs · 改后 = 当前工作区）`)
  process.exitCode = 全过 ? 0 : 1
} finally {
  // Windows 下刚 import 过的 ESM 文件在进程退出前可能无法删除（EPERM）⇒ 先试，失败则交给 detached 子进程迟删
  try { if (existsSync(TMP)) unlinkSync(TMP) } catch (e) {
    try {
      spawn('cmd', ['/c', `ping 127.0.0.1 -n 3 >nul & del /f /q "${TMP}"`], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    } catch (e2) {}
  }
}
