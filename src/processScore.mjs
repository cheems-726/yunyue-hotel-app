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

// ★ V128-#1（D324）：选址承诺书的 8 分制评分从 SiteSelection 组件里**抽到单源**。
//   原先它写在组件内部 ⇒ 教师端台账拿不到 ⇒ 承诺书列恒「—」。现在学生端/教师端共用本函数。
import { districts } from './siteLocations.mjs'
const 六维 = ['客流', '房价', '租金', '竞争', '人力', '波动']

/**
 * 选址承诺书过程分（4 项 × 0–2 = 8 分 · 公开评分表 · 只看"学生说了什么"）
 * @param {{假设:string, 为何不是:string, 打脸维:string, 验尸?:string}} c
 * @returns {{四项:Array<{名:string,分:number,据:string}>, 过程分:number, 满分:number}}
 */
export function 选址过程分(c) {
  const x = c && typeof c === 'object' ? c : {}
  const 假设 = String(x.假设 || '')
  const 为何不是 = String(x.为何不是 || '')
  const 打脸维 = String(x.打脸维 || '')
  const 验尸 = String(x.验尸 || '')
  const 全部区 = Object.values(districts).flat()
  const 全文 = `${假设} ${为何不是} ${打脸维} ${验尸}`
  const 维数 = 六维.filter(v => 全文.includes(v)).length
  const 两区点名 = 全部区.filter(d => 为何不是.includes(d.name)).length
  const 打脸 = /打脸|风险|最怕|短板|不足|低估/.test(打脸维) && 打脸维.trim().length >= 6
  const 可验证 = /(出租率|均价|RevPAR|入住|客流|营收|万|%|\d)/.test(假设)
  const 四项 = [
    { 名: '引用了几维真实数据', 分: 维数 >= 2 ? 2 : (维数 === 1 ? 1 : 0), 据: `命中维度 ${维数} 个` },
    { 名: '写了「为什么不是另外两个区」', 分: 两区点名 >= 2 ? 2 : (两区点名 === 1 ? 1 : 0), 据: `点名区县 ${两区点名} 个` },
    { 名: '给了反向证据（最易被打脸的一维）', 分: 打脸 ? 2 : (打脸维.trim() ? 1 : 0), 据: 打脸维.trim() ? '已写' : '未写' },
    { 名: '写出可验证假设（含可测指标）', 分: 可验证 ? 2 : (假设.trim().length >= 10 ? 1 : 0), 据: 可验证 ? '含可测指标' : '未见指标' },
  ]
  return { 四项, 过程分: 四项.reduce((s, v) => s + v.分, 0), 满分: 8 }
}

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
