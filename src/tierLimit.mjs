// §31.2-A1 ③：引擎侧【等级限制真强制】—— 超档品牌进入结算 ⇒ 显式拒绝
//
// ── 出处 ────────────────────────────────────────────────────────
//   需求 §1.2-6「小镇/低消费区禁止高端酒店落地」· §3.2-1「低地段开高端店必亏」
//   审计 D83-c：原先只有前端横幅（BrandSelection 只渲染 · handleBrandClick 不校验 · settle 无校验）
//   ⇒ 三层强制的第三层：**结算入口**也校验（防止任何路径绕过前端把超档组合写进存档）
//
// ── 口径（包内默认 · 待用户确认）────────────────────────────────
//   §31.2-A1 默认 **(a) 前端禁选 + 引擎拒绝**。拒绝方式：throw（显式报错，绝不静默降级 ——
//   静默降级 = "声明了但没有真的发生"）。档次映射：
//     档次1 经济型（汉庭/你好/海友/宜必思/汉庭快捷等 level 含「经济」）
//     档次2 中档（全季/桔子 · level 含「中档」）
//     档次3+ 中高端/高端/奢华（level 含 中高档/高档/奢华）
//   区域上限：客流 ≤2 → 1 档；3 → 2 档；≥4 → 5 档（与 BrandSelection.maxTier 同一公式）。
export function 区域档次上限(客流) {
  const f = Number(客流) || 3
  return f >= 4 ? 5 : (f >= 3 ? 2 : 1)
}
export function 品牌档次序号(brand) {
  if (!brand) return null
  const lv = String(brand.level || '')
  if (/奢华/.test(lv)) return 5
  if (/高档/.test(lv) && !/中高档/.test(lv)) return 4
  if (/中高档|精选/.test(lv)) return 3
  if (/中档|中端/.test(lv)) return 2
  if (/经济/.test(lv)) return 1
  return null   // 未知档位 ⇒ 不校验（未知 ≠ 违规 · 不臆造）
}
export function 校验等级限制({ site, brand }) {
  const 客流 = site && site.attrs ? site.attrs.客流 : site && site.客流
  if (客流 == null || !brand) return   // 缺数据 ⇒ 不判（不臆造）
  const 上限 = 区域档次上限(客流)
  const 档 = 品牌档次序号(brand)
  if (档 != null && 档 > 上限) {
    throw new Error(`[等级限制] 超档开店被拒绝：${brand.name} 为第 ${档} 档，而 ${site.district ?? '该区域'}（客流 ${客流} 档）上限为第 ${上限} 档（低消费区开高端酒店必亏 · 需求 3.2-1）`)
  }
}
