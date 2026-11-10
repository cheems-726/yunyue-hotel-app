// D367 · 界面兜底文案（只给 UI 用：把「待补」换成可读数字）
// 纪律：值全部来自 demoFill.mjs 的档次设定表，本文件不新增任何数据。
import { DEMO_FILL, 演示值 } from './demoFill.mjs'
import { wan2 } from './metricDefs.mjs'   // 金额→万 的唯一换算点（stale-scale R6）

/** 元 → 「x.x 万」（无千分位，和现有 UI 风格一致） */
const 金额文 = (元) => (Number.isFinite(元) ? wan2(元) : '—')

/** 0.05 → 「5%」 */
const 费率文 = (率) => (Number.isFinite(率) ? (率 * 100).toFixed(率 * 100 % 1 === 0 ? 0 : 1) + '%' : '5%')

/**
 * 取某品牌某字段的可读文案；缺官方来源时用档次设定值。
 * 键：保证金 / 筹备费 / 管理费 / 加盟费 / 造价 / 房量 / ADR
 */
export function 兜底文案(品牌名, 键) {
  const v = 演示值(品牌名) || (DEMO_FILL ? null : null)
  const 值 = v || 演示值('全季') // 极端兜底：按中档
  switch (键) {
    case '保证金': return 金额文(值.保证金)
    case '筹备费': return 金额文(20000)
    case '管理费': return 费率文(值.管理费率) + '（月营收）'
    case '加盟费': return 金额文(值.加盟费单价) + '/间（下限' + 金额文(值.加盟费下限) + '）'
    case '造价': return 金额文(值.单房造价新建) + '/间'
    case '房量': return 值.最少房量 + ' 间起'
    case 'ADR': return '¥' + 值.ADR带
    default: return 金额文(值.保证金)
  }
}

