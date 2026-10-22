// V144 §2 · 教师端六组一句话（格式化 / 不排名 / 数字来自行数据）
import { 六组一句话 } from '../src/teacherSixLines.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
console.log('▶ V144 · 六组一句话')
const rows = [
  { name: '酒管2401 · 第1组 · 云悦望江店', netOp: -8.9, gop: 28.1, revenue: 106.4, occ: 76.5, rating: 3.115, oneTime: 60.8, historyCount: 12 },
  { name: '酒管2401 · 第2组 · 云悦春熙店', netOp: -9.2, gop: 26.7, revenue: 110.3, occ: 88.6, rating: 3.19, oneTime: 60.8, historyCount: 12 },
  { name: '未结算组', gop: 0, revenue: 0, occ: 0, rating: 0, oneTime: 0, historyCount: 0 },
]
const 行 = 六组一句话(rows)
ok(行.length === 2, '无结算组被过滤')
ok(行[0].includes('12 周经营净利 -8.9 万') && 行[0].includes('净利率 -8%') && 行[0].includes('出租率 76.5%') && 行[0].includes('好评率 62%') && 行[0].includes('开店投入 60.8 万'), `第一行格式完整（${行[0]}）`)
ok(!/排名|第\s*1\s*名|冠军/.test(行.join('\n')), '不含排名/名次字样')
ok(行.join('\n').split('\n').length === 2, '每组一行（纯文本可复制）')
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
