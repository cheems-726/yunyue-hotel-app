// V62 · 未开业态「零动态」守门（挂 run-all fast）
// 判据（V62 线上复验 2026-10-07 05:50 实捕：「夜班前台接待深夜到店客人」出现在 0 入住店 ⇒ 幻影到店未断根）：
//   HotelStatus LiveFeed 四族事件全部挂 occupiedRooms 门槛：退房/入住（原有）· misc 杂项（本批补）· night 深夜（本批补）
//   · 实时评价已有 V55-b 0 客守卫（不回退）
// 可证伪：把任一分支的 occupiedRooms > 0 && 拆掉 ⇒ 对应断言红。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'HotelStatus.jsx'), 'utf8')

console.log('▶ V62 · 未开业零动态守门')

// ① 四族事件门槛
ok(/if \(ph\.checkout > 0 && roll < EVENT_PROB\.checkout && s\.checkout \+ s\.checkin < Math\.round\(occupiedRooms \* 0\.8\)\)/.test(src), '① 退房族：数量门槛 occupancy×0.8（原有）')
ok(/else if \(ph\.checkin > 0 && roll < EVENT_PROB\.checkin && s\.checkin < Math\.round\(occupiedRooms \* 0\.6\)\)/.test(src), '① 入住族：数量门槛 occupancy×0.6（原有）')
ok(/else if \(occupiedRooms > 0 && roll < EVENT_PROB\.misc && h >= 8 && h < 22\)/.test(src), '① misc 杂项族：0 入住静默（V62 补 · 深夜到店/押金幻影根源之一）')
ok(/else if \(occupiedRooms > 0 && \(h >= 23 \|\| h < 6\) && roll < EVENT_PROB\.night\)/.test(src), '① night 深夜族：0 入住静默（V62 补 · 「夜班前台接待深夜到店客人」05:50 线上实捕）')

// ② V55-b 实时评价 0 客守卫不回退
ok(/if \(!\(occupiedRooms > 0\)\) return\s+\/\/ ★ V55-b/.test(src), '② 实时评价 0 客守卫仍在（V55-b）')

// ③ 未开业视图传 0（R55-1 不回退）
ok(/<LiveFeed occupiedRooms=\{0\} price=\{230\} week=\{week\} \/>/.test(src), '③ 未开业视图 occupiedRooms=0（R55-1）')

// ④ 幻影文案本体仍在但被门槛保护（不许删文案——开业后仍是教学趣味）
ok(src.includes('夜班前台接待 1 位深夜到店客人') && src.includes('为 ${room}房客人退还押金'), '④ 事件文案保留（开业后教学趣味 · 只加门槛不删内容）')

console.log(`结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
