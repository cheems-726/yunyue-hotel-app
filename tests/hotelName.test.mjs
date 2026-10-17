import { readFileSync } from 'node:fs'
// V114-P1 判据：酒店名（2–12 字 · 空名挡 · 重名挡 · 三处显示统一口径由 组显示() 提供）
import { 校验酒店名, 查重, 已有名字, 组显示, 名字最短, 名字最长 } from '../src/hotelName.mjs'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

ok(校验酒店名('').ok === false, '空名必须不合格')
ok(校验酒店名('   ').ok === false, '全空白必须不合格')
ok(校验酒店名('店').ok === false, `少于 ${名字最短} 字不合格`)
ok(校验酒店名('云悦锦江店').ok === true, '正常名字应合格')
ok(校验酒店名('云 悦').ok === false, '含空格不合格')
ok(校验酒店名('x'.repeat(名字最长 + 1)).ok === false, `超过 ${名字最长} 字不合格`)

// 查重
const 已有 = [{ name: '云悦锦江店', 组: '酒管2401|1' }, { name: '云悦春熙店', 组: '酒管2401|2' }]
ok(查重('云悦锦江店', 已有).重名 === true, '重名必须被识别')
ok(查重('云悦锦江店', 已有).组 === '酒管2401|1', '重名应指出是哪一组')
ok(查重('云悦高新店', 已有).重名 === false, '不重名应放行')

// 从 game_states 行提取已有名字
{
  const rows = [{ group_name: '酒管2401|1', state: { hotelName: '云悦锦江店' } }, { group_name: '酒管2401|2', state: {} }, { group_name: '', state: { hotelName: '野行店' } }]
  const 名s = 已有名字(rows)
  ok(名s.length === 2, `应提取 2 个已用名（空名不算）· 实得 ${名s.length}`)
  ok(名s.some(x => x.name === '野行店'), '有名字的行都要收进查重集合（宁严勿松）')
}

// 三处显示统一口径
ok(组显示({ groupNo: 3, hotelName: '云悦锦江店', 成员: ['张三', '李四'] }) === '第3组 · 云悦锦江店 · 张三、李四', '组显示格式应为 第N组 · 酒店名 · 成员')
ok(组显示({ groupNo: 3 }) === '第3组', '缺项不写占位（不编）')

// ── ④ 三处同源（静态）：顶栏 / 周报标题 / 教师端总览都读同一个字段 hotelName
{
  const app = readFileSync('src/App.jsx', 'utf8')
  const wr = readFileSync('src/WeeklyReport.jsx', 'utf8')
  const td = readFileSync('src/TeacherDashboard.jsx', 'utf8')
  ok(app.includes("hotelName || (property ? property.name"), '学生顶栏：酒店名优先（缺则回退物业名）')
  ok(wr.includes("hotelName ? hotelName + ' · ' : ''"), '周报标题：同一 hotelName 作前缀')
  ok(td.includes("hotelName: s.hotelName || ''") && td.includes("' · ' + s.hotelName"), '教师端总览：第N组 · 酒店名（同一字段）')
}

console.log('══ V114-P1 酒店名 ══')
console.log(`  规则 ${名字最短}–${名字最长} 字 · 空名/重名/空格都挡 · 格式「第N组 · 酒店名 · 成员」`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
