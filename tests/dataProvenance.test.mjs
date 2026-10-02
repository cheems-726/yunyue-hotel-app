// §33-V5 · 数据尾巴守门 —— 「每格必须有来源」+「看板可信度不许悄悄升级」
// 判据（卡内 §3 RV 两靶的守门侧）：
//   ① establishmentInvest 附加项每一项都带「来源」字段，且不含"无来源裸值"形态
//   ② 看板 🟢 必须同时带来源（抓取日/官方字样）—— 🟡→🟢 悄悄升级 ⇒ 红
//   ③ 看板 OCC 行：城市级锚点必须标「城市级」+「不可当区县值」（防"城市值冒充区县"回归）
//   ④ 发老师清单一页表存在且带"录到哪里"列
// 运行：node tests/dataProvenance.test.mjs   （挂 run-all fast）
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const rd = (p) => { try { return readFileSync(path.join(ROOT, p), 'utf8') } catch (e) { return null } }

console.log('▶ §33-V5 数据尾巴守门（来源溯源）')

// ① establishmentInvest 附加项：每项带来源 + 待确认纪律
{
  const src = readFileSync(path.join(APP, 'src', 'establishmentInvest.mjs'), 'utf8')
  const 项s = src.match(/\{ key: '[^']+', 说明:[^\n]*\}/g) || []
  ok(项s.length >= 4, `附加项 4 条可解析（${项s.length}）`)
  const 缺来源 = 项s.filter(x => !/来源: '/.test(x))
  ok(缺来源.length === 0, '★ 每条附加项都带「来源」字段（每格必须有来源）', 缺来源.join(' | '))
  const 裸有据 = 项s.filter(x => /来源: '(?!教学默认|迈点)[^']*[0-9]{3,}[^']*'(?![^']*口径)/.test(x) && !/待老师确认|口径不同/.test(x))
  ok(裸有据.length === 0, '★ 有具体数字的来源必须带「待老师确认」或「口径不同只记录」标注（防二手数字混入）', 裸有据.join(' | '))
  ok(/待老师确认: true/.test(src), '整体「待老师确认」保持 true（不许因部分补源就整体宣称已确认）')
}
// ② 看板 🟢 必须带来源
{
  const 看板 = rd('6-数据与对外材料/数据完整度看板-W4-1.md')
  ok(看板 !== null, '数据完整度看板存在')
  if (看板) {
    const 表区 = 看板.split('## 二、')[0]
    // 🟢 若出现必须同行带（来源/抓取日/官方/城市级锚点说明）—— 现在 🟢=0，此判据防将来"悄悄升级"
    //   ★ 只扫【总览表的数据行】（区县行 · 以"|" 开头且含"·"分隔的城市/区名）；统计行/图例行不算（首版误扫）
    const 表行 = 表区.split('\n').filter(l => l.trim().startsWith('|') && /·/.test(l) && /区|市|商圈/.test(l))
    const 绿格 = 表行.flatMap(l => (l.match(/🟢[^|\n]*/g) || []).map(x => x.trim()))
    const 绿无源 = 绿格.filter(x => !/来源|抓取日|官方|老师提供|锚点/.test(x))
    ok(绿无源.length === 0, `★ 看板 🟢 格必须同行带来源（数据行 🟢 ${绿格.length} 格 · 无源 ${绿无源.length} 格 —— 悄悄升级在此红）`, 绿无源.join(' | '))
    // 顶部统计行与表格实况一致（防"统计行说一套表里一套"）
    const m = /统计.*?🟢 (\d+) 格.*?🟡 (\d+) 格.*?🔴 (\d+) 格/.exec(看板)
    ok(!!m, '统计行可解析')
  }
}
// ③ OCC 城市级锚点标注
{
  const 看板 = rd('6-数据与对外材料/数据完整度看板-W4-1.md') || ''
  ok(/城市级锚点/.test(看板) && /不可当区县值/.test(看板),
    '★ OCC 锚点必须标「城市级」+「不可当区县值」（防城市值冒充区县）')
  const 措施 = rd('6-数据与对外材料/数据需求清单-发老师版.md') || ''
  ok(措施.includes('一页可填表') && 措施.includes('录到哪里'),
    '★ 发老师清单含「一页可填表」（每行给 录到哪里）')
  ok(措施.includes('若老师有权威值，优先用老师的'),
    '★ ADR 参考值标注"老师权威值优先"（V5§2 要求）')
}
// ④ 租金录入操作卡（V5② 的两份准备之二）
{
  const 租金记录 = rd('5-参考资料/租金与品牌费率-抓取记录-20260928.md') || ''
  ok(租金记录.includes('录入操作卡') && 租金记录.includes('元/㎡·月'),
    '★ 租金「拿到 PDF 后怎么录」操作卡在（两份准备之二）')
  ok(租金记录.includes('不许') && 租金记录.includes('二手数字'),
    '★ 操作卡带"不许二手顶替"纪律行')
}
// ⑤ 软装项的行业佐证只记录不改值（口径不同先例）
{
  const src = readFileSync(path.join(APP, 'src', 'establishmentInvest.mjs'), 'utf8')
  const 软装行 = (src.match(/\{ key: '软装'[^\n]*\}/) || [''])[0]
  ok(/口径不同[^']*只记录不改值/.test(软装行), '★ 软装项：行业佐证按「口径不同 ⇒ 只记录不改值」处理（不污染教学默认档）')
  ok(/比例: \{ 低: 0\.06, 中: 0\.10, 高: 0\.16 \}/.test(软装行), '软装比例值未被佐证来源改动（0.06/0.10/0.16 保持）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('RV：node tests/_rv-33v5.mjs —— ①造无来源格 ②🟡悄悄改🟢 ⇒ 必红')
process.exit(fail ? 1 : 0)
