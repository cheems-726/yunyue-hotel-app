// T2.3 / Phase E1 · 教学日历时钟验收
// 运行：node tests/teachingClock.test.mjs
// 判据（§十七·六 E1）：早 8 点前 / 晚 23 点后，dateKey 与教学日历日一致；★ 对外数值零变化
import { teachingDayKey, teachingDayNo, teachingDayOfMonth, inTeachingHours, TEACHING_DAY_START_HOUR, nowMinutes, nowClockTag } from '../src/teachingClock.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ T2.3 教学日历时钟（Phase E1）')

// 用本地时间构造，避免时区漂移
const at = (y, m, d, h, mi = 0) => new Date(y, m - 1, d, h, mi, 0)

console.log('\n[1] 边界断言：早 8 点前 / 晚 23 点后，dateKey 与教学日历日一致')
{
  // 07:30 仍属【前一天】的教学日
  ok(teachingDayKey(at(2026, 10, 1, 7, 30)) === '2026-09-30',
    `07:30（10-01）→ 教学日 2026-09-30（实得 ${teachingDayKey(at(2026, 10, 1, 7, 30))}）`)
  // 08:00 起算当天
  ok(teachingDayKey(at(2026, 10, 1, 8, 0)) === '2026-10-01',
    `08:00（10-01）→ 教学日 2026-10-01（实得 ${teachingDayKey(at(2026, 10, 1, 8, 0))}）`)
  // 23:30 仍属当天（晚 23 点后不跨日）
  ok(teachingDayKey(at(2026, 10, 1, 23, 30)) === '2026-10-01',
    `23:30（10-01）→ 教学日 2026-10-01（实得 ${teachingDayKey(at(2026, 10, 1, 23, 30))}）`)
  // 跨月 / 跨年边界
  ok(teachingDayKey(at(2026, 11, 1, 7, 0)) === '2026-10-31',
    `跨月：11-01 07:00 → 2026-10-31（实得 ${teachingDayKey(at(2026, 11, 1, 7, 0))}）`)
  ok(teachingDayKey(at(2027, 1, 1, 6, 0)) === '2026-12-31',
    `跨年：01-01 06:00 → 2026-12-31（实得 ${teachingDayKey(at(2027, 1, 1, 6, 0))}）`)
  // 同一教学日内恒定
  const sameDay = [9, 12, 18, 22, 23].map(h => teachingDayKey(at(2026, 10, 1, h)))
  ok(new Set(sameDay).size === 1, `同一教学日（08:00–23:59）内 dateKey 恒定：${sameDay[0]}`)
}

console.log('\n[2] 单调性：教学日序号跨日恰好 +1（不跳号）')
{
  let bad = 0
  for (let d = 1; d <= 28; d++) {
    const a = teachingDayNo(at(2026, 10, d, 12))
    const b = teachingDayNo(at(2026, 10, d + 1, 12))
    if (b - a !== 1) bad++
  }
  ok(bad === 0, '连续 28 天：teachingDayNo 每日恰好 +1')
  ok(teachingDayOfMonth(at(2026, 10, 1, 7, 30)) === 30, 'teachingDayOfMonth(07:30 于 10-01) = 30（属 09-30 教学日）')
  ok(teachingDayOfMonth(at(2026, 10, 1, 9)) === 1, 'teachingDayOfMonth(09:00 于 10-01) = 1')
}

console.log('\n[3] 教学时段（仅展示用，不参与判定）')
{
  ok(inTeachingHours(at(2026, 10, 1, 8)) === true, '08:00 在教学时段内')
  ok(inTeachingHours(at(2026, 10, 1, 7, 59)) === false, '07:59 不在教学时段内')
  ok(inTeachingHours(at(2026, 10, 1, 22, 59)) === true, '22:59 在教学时段内')
  ok(inTeachingHours(at(2026, 10, 1, 23, 0)) === false, '23:00 不在教学时段内（教学时段 08:00–23:00）')
  ok(TEACHING_DAY_START_HOUR === 8, '教学日起算小时 = 8')
}

console.log('\n[4] 收编到位：三处不得再直接读设备墙钟日期')
{
  const src = readFileSync(new URL('../src/HotelStatus.jsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/toISOString\(\)\.slice\(0,\s*10\)/.test(code), 'HotelStatus.jsx 不再用 toISOString().slice(0,10) 当日期键')
  ok(!/new Date\(\)\.getDate\(\)/.test(code), 'HotelStatus.jsx 不再用 new Date().getDate() 当种子')
  ok(/teachingDayKey/.test(code), 'HotelStatus.jsx 已改用 teachingDayKey（存档键 / 日计数键）')
  ok(/teachingDayOfMonth/.test(code), 'HotelStatus.jsx 已改用 teachingDayOfMonth（房型面板种子）')
}

console.log('\n[5] 对外数值零变化：结算链路不依赖本模块')
{
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => f.endsWith('.js') || f.endsWith('.mjs'))
  const offenders = files.filter(f => f === 'settlement.js' || f === 'dayEngine.js' || f === 'attrs.js' || f === 'guests.js' || f === 'reviewRate.js')
    .filter(f => /teachingClock/.test(readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')))
  ok(offenders.length === 0, `结算/引擎模块不 import teachingClock（${offenders.length ? offenders.join(',') : '0 个'}）⇒ 对外数值零变化`)
}

console.log('\n[6] §26.5（P0d）面板时钟口径：真实时间 · 单一时钟源（用户第三次投诉）')
{
  const src = readFileSync(new URL('../src/HotelStatus.jsx', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  // ① 自走钟必须消失（原 `gameMin += 1` 每 2 秒 +1 分钟 = ×30 速 ⇒ 一个游戏日 48 真实分钟绕一圈）
  ok(!/gameMin\s*\+=\s*1/.test(code), '★ 面板无自走游戏钟（`gameMin += 1` 已删 · 原为 ×30 速）')
  ok(/gameMin\s*=\s*nowMinutes\(\)/.test(code), '★ 每 tick 重取真实时间（gameMin = nowMinutes()）')
  ok(/nowClockTag\(\)/.test(code), '★ 流水时间戳走 nowClockTag()（与 nowMinutes 同源）')
  // ② 单一时钟源：所有 phaseOf() 调用都从 nowMinutes 派生（同屏不再有两套时段）
  const 时段调用 = code.split('\n').filter(l => /phaseOf\(/.test(l))
  const 非真实源 = 时段调用.filter(l => !/nowMinutes/.test(l) && !/function phaseOf/.test(l) && !/const ph = phaseOf\(h\)/.test(l))
  ok(非真实源.length === 0, '★ 所有 phaseOf() 调用都从 nowMinutes 派生（同屏不再有两套时段）', 非真实源.join(' | '))
  ok(时段调用.length >= 2, `phaseOf 调用点解析到 ${时段调用.length} 处（判据有靶子 · 非空转）`)
  // ③ simDate 不再混算（设备年 / getDay() 当周内偏移）
  ok(/function simDate\(\)/.test(code), '★ simDate 已重定义为无参纯函数（只读本地真实日期）')
  ok(!/new Date\(\)\.getFullYear\(\)/.test(code), '★ 源码不再读设备年当"游戏年历"起点（原混算来源之一）')
  // ④ 教学日口径：日计数不再用"游戏日"
  ok(!/Math\.floor\(gameMin \/ 1440\)/.test(code), '★ 日计数改教学日口径（原 floor(gameMin/1440) 是游戏日）')
  // ⑤ nowMinutes / nowClockTag 语义（可确定复算 · 不依赖跑测时刻）
  const d = new Date(2026, 8, 29, 8, 30, 0)   // 本地 2026-09-29 08:30
  ok(nowMinutes(d) === 510, `nowMinutes(08:30) === 510（实际 ${nowMinutes(d)}）`)
  ok(nowClockTag(d) === '08:30', `nowClockTag(08:30) === '08:30'（实际 ${nowClockTag(d)}）`)
  ok(nowMinutes(d) === d.getHours() * 60 + d.getMinutes(), 'nowMinutes === 本地 h*60+m（本地时区 · 非 UTC）')
  // ⑥ 模块内不得出现 UTC ISO 当日键（"早 8 点前落昨天"的旧坑）
  //   ★ 必须先剥 `//` 行注释（模块头部就在讲"收编前用的是 toISOString"——不剥会把说明文字当违规）
  const tc = readFileSync(new URL('../src/teachingClock.mjs', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
  ok(!/toISOString/.test(tc), '★ teachingClock 不含 toISOString（UTC 零点为界的旧坑不存在）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
