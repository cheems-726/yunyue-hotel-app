// §26 的反向验证（RV）：把用户投诉的三种缺陷**逐一注入**，证明守门真的会红
//
//   RV-1  把「在店客房」改回"人数 + 间"（原缺陷）      ⇒ livePanel[1] 必红
//   RV-2  把「在店客房」的值改成 999（不可能的数）      ⇒ livePanel[2] 必红
//   RV-3  房型明细改回 `tp.total × tp.occRate`          ⇒ dataDict V6 + livePanel[3] 必红
//   RV-4  面板重新自记收支（`apply({ income: ... })`）  ⇒ dataDict V7 必红
//   RV-5  事件文案重新自带金额（`amt: -80`）            ⇒ dataDict V8 必红
//   RV-6  金额路径重新用 Math.random                    ⇒ dataDict V4b 必红
//   RV-7  把"模拟估算"免责句加回去（谎话回潮）           ⇒ livePanel[4] 必红
//
// 用法：node tests/_rv-26.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HS = path.join(APP, 'src', 'HotelStatus.jsx')

const 跑 = (文件) => {
  try {
    const out = execFileSync(process.execPath, [文件], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || ''), err: e.message } }
}
const 跑LP = () => 跑(path.join(APP, 'tests', 'livePanel.test.mjs'))
const 跑DD = () => 跑(path.join(APP, 'tests', 'dataDict.check.mjs'))
const 判据 = (跑fn, 片段) => Object.assign(跑fn, { 红: r => r.code !== 0 && (!片段 || r.out.includes(片段)) })

let 全过 = true
const 例 = (label, 旧, 新, 判) => {
  const 备份 = readFileSync(HS, 'utf8')
  if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}\n        （期望片段：${旧.slice(0, 80)}）`); 全过 = false; return }
  writeFileSync(HS, 备份.replace(旧, 新))
  const r = 判()
  writeFileSync(HS, 备份)
  const 掉红 = 判.红(r)
  const 还原 = 判()
  const 复绿 = 还原.code === 0
  if (process.env.RV_DEBUG) console.log(`        [debug] 改后 out=${r.out.length}字 err=${r.err}`)
  if (!(掉红 && 复绿)) 全过 = false
  console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
}

console.log('【RV §26 P0a/P0b】面板口径三种缺陷逐一注入（改一处验一处 · 逐次还原）\n')

例('RV-1 「在店客房」改回 人数+间（原缺陷：75 间 > 60 间）',
  "{ l: '在店客房', v: occRooms + ' 间', c: '#1D4ED8', live: true, sub: `出租率 ${occupancy}%` }",
  "{ l: '在店客房', v: (liveStats ? liveStats.guests : (liveGuests ?? targetGuests)) + ' 间', c: '#1D4ED8', live: true }",
  判据(跑LP, '房间类标签的格子'))

例('RV-2 「在店客房」的值改成字面量 999（> 兜底房量 70）',
  "v: occRooms + ' 间'", "v: 999 + ' 间'",
  判据(跑LP, '写死数字的「间」格'))

例('RV-3 房型明细改回独立估算 tp.total × tp.occRate',
  '{tp.total} 间 · 在店 {occByType[idx]}', '{tp.total} 间 · 在店 {Math.round(tp.total * tp.occRate)}',
  判据(跑DD, 'V6'))

例('RV-4 面板重新自记收支（apply({ income: ... })）',
  'apply({ checkout: s.checkout + 1, guests: Math.max(4, s.guests - 2) })',
  'apply({ checkout: s.checkout + 1, guests: Math.max(4, s.guests - 2), income: s.income + 100 })',
  判据(跑DD, 'V7'))

例('RV-5 事件文案重新自带金额（amt: -80）',
  'pushFeed(`🧹 [${clockTag}] ${x.room}房退房清扫完成`, 0)',
  'pushFeed(`🧹 [${clockTag}] ${x.room}房退房清扫完成`, -80)',
  判据(跑DD, 'V8'))

例('RV-6 金额路径重新用 Math.random（房费随机）',
  'const g = [\'商务出差\', \'家庭出游\', \'旅行散客\', \'会议客人\'][Math.floor(Math.random() * 4)]',
  'const g = String(Math.round(price * (0.85 + Math.random() * 0.3)))',
  判据(跑DD, 'V4b'))

例('RV-7 把"模拟估算"免责句加回去',
  "          : '今日流水待本周结算后显示（引擎日快照未就绪）'}",
  "          : '今日流水待本周结算后显示（引擎日快照未就绪）'}\n      <div>今日流水为模拟估算，实际收支以每周结算为准</div>",
  判据(跑LP, '模拟估算'))

console.log(`\n判定：${全过 ? '✓ §26 RV 全过（7 条靶子 · 红→绿可逆）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
