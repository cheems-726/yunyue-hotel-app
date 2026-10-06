// V58 · RPG named 数值字面（3.1-1）· 单源派生表
// ★ 纪律：全部从现有引擎量派生（不新增数值源 · 不碰评分权重口径）——每一项 = 引擎字段 + 显示名 + 范围 + 读取函数。
//   消费方：界面（选址/经营页）与文档直接调 readRpgLiterals()，改动只改此文件。
import { ATTR_INIT, qualityOf } from './attrs.js'
import { parseRooms } from './settlement.js'

// 四项 ↔ 引擎字段 ↔ 显示名 ↔ 范围（对照表本体 · 需求 3.1-1）
export const RPG_LITERALS = [
  {
    名称: '硬件评分', 显示: (state) => `${qualityOf(state)} / 100`,
    引擎字段: 'attrs.quality（属性池品质 · 含装修档初始值与每周自然衰减）', 范围: '20–100（衰减下限 20）',
    说明: '硬件/卫生维 —— 装修/软装投资抬起点位，怠于维护逐周衰减。',
    派生: 'qualityOf(attrs) · src/attrs.js:335',
  },
  {
    名称: '人员配置', 显示: (state) => `${qualityOf(state) >= 60 ? '满编水准' : '缺编'}（士气 ${state.morale ?? ATTR_INIT.morale} / 100）`,
    引擎字段: 'attrs.morale + decisions.shifts（排班）', 范围: '20–100（士气）· 排班二选一',
    说明: '人员维 —— 满编保服务抬士气与服务上限；精简省成本压成本但直接 −6% 入住率（V48①）。',
    派生: 'morale 直读 + shifts 分支 · src/attrs.js · settlement.js:446',
  },
  {
    名称: '商圈热度', 显示: (site) => `客流 ${site.客流 ?? 3} / 5 档`,
    引擎字段: 'site.客流（选址六维之一定档）→ cityFlow = 1+(档−3)×0.20', 范围: '1–5 档（0.60–1.40 客流乘数）',
    说明: '商圈维 —— 选址即定，叠加季节/天气/事件为当期需求。',
    派生: 'siteLocations 六维 · settlement.js:269 cityFlow',
  },
  {
    名称: '客源承载力', 显示: (brand) => `${parseRooms(brand?.standard)} 间`,
    引擎字段: 'parseRooms(brand.standard)（品牌房量门槛 · 与结算同源）', 范围: '50–80 间（品牌带）',
    说明: '承载维 —— 每周可售房晚 = 房量 × 7；出租率 = 已售 ÷ 可售。',
    派生: 'parseRooms 单源 · settlement.js:697',
  },
]

// 一次性读取（界面传 state/site/brand 即得四项字面）
export function readRpgLiterals({ state, site, brand }) {
  const out = {}
  for (const item of RPG_LITERALS) {
    try {
      if (item.名称 === '硬件评分') out[item.名称] = item.显示(state)
      else if (item.名称 === '人员配置') out[item.名称] = item.显示(state)
      else if (item.名称 === '商圈热度') out[item.名称] = item.显示(site || {})
      else out[item.名称] = item.显示(brand)
    } catch (e) { out[item.名称] = '—' }
  }
  return out
}
