// T2.3 / Phase E1 · 教学日历时钟验收
// 运行：node tests/teachingClock.test.mjs
// 判据（§十七·六 E1）：早 8 点前 / 晚 23 点后，dateKey 与教学日历日一致；★ 对外数值零变化
import { teachingDayKey, teachingDayNo, teachingDayOfMonth, inTeachingHours, TEACHING_DAY_START_HOUR } from '../src/teachingClock.mjs'
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

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
