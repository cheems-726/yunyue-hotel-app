// V117 · 过程分台账（**纯派生 · 只读 · 不改结算/不改四维评分**）
//
// ── 三列数据从哪来（全部已有，不新增计算）────────────────────────────
//   ① 选址承诺书：`SiteSelection` 的 过程分()（四项 ×0–2 = 8 分）—— 调用方传入数字
//   ② 每周归因：`attribution.判分()`（填了=1，命中再+1，每周 0–2）—— 调用方传入 [{填了,过程分}]
//   ③ 取舍理由：`choiceReasons.缺哪些()` 的反面（4 条各 1 分）—— 调用方传入已写的键数组
//
// ── 三条红线（写进代码，不只写文档）────────────────────────────────────
//   ① **不并入四维评分**：四维口径已冻结（W10），本台账独立存在
//   ② **缺数据显「—」，不补 0**："没交" ≠ "0 分"（0 分是罚，缺席是缺）
//   ③ **不做学生端排名**：本模块不排序、不输出名次（教师端只标"谁没填"）
//
// ── 分母不写死 ──────────────────────────────────────────────────────
//   满分 = 8（承诺书） + 2×已结算周数（归因） + 4（理由）⇒ 随学期进行而变

export const 结构 = { 承诺书满分: 8, 归因每周: 2, 理由满分: 4 }

const 限 = (v, max) => {
  if (v === null || v === undefined || v === '') return null   // ★ 缺数据 ≠ 0 分
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(max, n))
}

/**
 * 一行的过程分台账
 * @param {object} p
 * @param {number|null} p.承诺书 过程分() 的结果（0–8）；缺 ⇒ null
 * @param {Array<{填了:boolean, 过程分:number}>} p.归因 每周判分（缺周不传）
 * @param {string[]} p.理由 已写够字数的取舍理由键（≤4）
 * @returns {{承诺书:number|null, 归因:number|null, 理由条数:number|null, 合计:number|null, 满分:number, 缺:string[]}}
 */
export function 过程分台账({ 承诺书 = null, 归因 = [], 理由 = [] } = {}) {
  const 承诺 = 限(承诺书, 结构.承诺书满分)

  // 归因：**没有任何一周作答 ⇒ null**（缺数据 ≠ 0 分）；有作答 ⇒ 累加过程分
  const 周s = Array.isArray(归因) ? 归因.filter(x => x && typeof x === 'object') : []
  const 有作答 = 周s.some(x => x.填了)
  const 归因分 = 有作答 ? 周s.reduce((a, x) => a + (x.填了 ? (Number(x.过程分) || 0) : 0), 0) : null

  const 理由s = Array.isArray(理由) ? 理由.filter(Boolean) : []
  const 理由条数 = 理由s.length > 0 ? Math.min(结构.理由满分, 理由s.length) : null

  const 项 = [承诺, 归因分, 理由条数]
  const 缺 = []
  if (承诺 == null) 缺.push('选址承诺书')
  if (归因分 == null) 缺.push('每周归因')
  if (理由条数 == null) 缺.push('取舍理由')
  // ★ 任一项缺 ⇒ 合计 null（**不许把缺的当 0 加进去**，否则"缺席"看起来像"被扣分"）
  const 合计 = 项.every(v => v != null) ? 项.reduce((a, b) => a + b, 0) : null

  const 满分 = 结构.承诺书满分 + 结构.归因每周 * 周s.length + 结构.理由满分
  return { 承诺书: 承诺, 归因: 归因分, 理由条数, 合计, 满分, 缺 }
}

/**
 * CSV（教师端导出）：表头固定 · 行数 = 组数（§4-④）
 * @param {Array<{组:string, 酒店名:string, 台账:object}>} rows
 */
export function 台账CSV(rows = []) {
  const 头 = ['组', '酒店名', '①承诺书', '②归因', '③理由条数', '合计', '满分', '缺项']
  const 行 = (rows || []).map(r => {
    const t = (r && r.台账) || {}
    return [
      r && r.组, r && (r.酒店名 || ''), t.承诺书, t.归因, t.理由条数, t.合计, t.满分, (t.缺 || []).join('/'),
    ].map(v => {
      const s = v == null ? '—' : String(v)
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }).join(',')
  })
  return [头.join(','), ...行].join('\n')
}

/** 界面文案（红线①：这句必须显示 · §4-⑥ 有文案断言） */
export const 台账说明 = '过程分**不并入四维评分**（四维口径已冻结 W10）· 作课堂表现独立记录'
