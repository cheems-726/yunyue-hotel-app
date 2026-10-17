// V113-1.3 · 每步取舍句 + 终局《开店宣言》
//
// ── 设计（为什么单源在本机）──────────────────────────────────────────
//   · 理由/宣言属于**学生自己的承诺**，离线也要能写（教室里断网常见）⇒ 本机 localStorage 是**唯一真相源**
//   · 云端镜像：`saveDecisionLog`（有会话时把理由同步进 decision_log ⇒ 教师端 `fetchDecisionLogs` 可读；
//     无会话则跳过，不发注定 401 的请求 —— 与 R109-2 同一条纪律）
//   · 宣言**一次生成即冻结**：`写宣言` 已有 ⇒ 拒绝覆盖；带 ISO 时间戳（`at`），界面不提供编辑入口
//
// ── 判据（V113 §4-1.3）──────────────────────────────────────────────
//   理由落库且教师端可读（decision_log 镜像 + 本机存档）· 宣言带时间戳不可编辑
//   （本套件用注入了假存储的对象测这两条 ⇒ 不依赖浏览器）

export const 取舍项 = [
  { key: 'bizMode', 名: '经营模式', 提示: '为什么选这个经营模式，而不是另一种？' },
  { key: 'property', 名: '物业', 提示: '为什么选这家物业，而不是另外几家？' },
  { key: 'brand', 名: '品牌', 提示: '为什么选这个品牌，而不是同档的另外两个？' },
  { key: 'invest', 名: '投资档', 提示: '为什么这样分配投资档位，而不是把钱花在别的档上？' },
]

export const 理由最短 = 12   // 字数下限：逼出一句话，而不是"好"/"便宜"

const KEY = 'hotel-sim-reasons'
const DKEY = 'hotel-sim-declaration'

let 存储 = (typeof localStorage !== 'undefined' ? localStorage : null)

/** 注入存储（测试用；生产环境默认 localStorage） */
export function 设置存储(s) { 存储 = s || null }

function 读(k) {
  try { const raw = 存储 && 存储.getItem(k); return raw ? JSON.parse(raw) : null } catch (e) { return null }
}
function 写(k, v) {
  try { if (存储) 存储.setItem(k, JSON.stringify(v)); return true } catch (e) { return false }
}

export function 读理由() {
  const all = 读(KEY)
  return all && typeof all === 'object' ? all : {}
}

/** 写一条理由（覆盖允许：学生可以改自己的理由，直到生成宣言） */
export function 写理由(key, text) {
  const all = 读理由()
  const t = String(text == null ? '' : text).trim()
  all[key] = { text: t, at: new Date().toISOString(), 合格: t.length >= 理由最短 }
  写(KEY, all)
  return all[key]
}

export function 理由合格(s) {
  return String(s == null ? '' : s).trim().length >= 理由最短
}

/** 哪几项还没写够（教师端/宣言前置用） */
export function 缺哪些() {
  const all = 读理由()
  return 取舍项.filter(k => !理由合格(all[k.key] && all[k.key].text))
}

/** 全部理由就绪？（生成宣言的前置） */
export function 理由齐了吗() { return 缺哪些().length === 0 }

export function 读宣言() { return 读(DKEY) }

/**
 * 生成《开店宣言》（**只此一次** · 带时间戳 · 不可编辑）
 * @param {{预算分配:string, 最大赌注:string, 最怕:string}} p
 * @returns {{成功:boolean, 原因?:string, 宣言?:object}}
 */
export function 写宣言({ 预算分配, 最大赌注, 最怕 } = {}) {
  if (读宣言()) return { 成功: false, 原因: '宣言已生成，不可编辑（一次定终身）' }
  const 缺 = 缺哪些()
  if (缺.length) return { 成功: false, 原因: '还没写完取舍理由：' + 缺.map(x => x.名).join('、') }
  const 空 = [['预算分配', 预算分配], ['最大赌注', 最大赌注], ['最怕', 最怕]].filter(([, v]) => !String(v == null ? '' : v).trim())
  if (空.length) return { 成功: false, 原因: '宣言缺字段：' + 空.map(x => x[0]).join('、') }
  const d = {
    at: new Date().toISOString(),
    预算分配: String(预算分配).trim(),
    最大赌注: String(最大赌注).trim(),
    最怕: String(最怕).trim(),
    理由: 读理由(),
    版本: 1,
  }
  写(DKEY, d)
  return { 成功: true, 宣言: d }
}

export function 宣言合格(x) {
  return !!(x && typeof x.at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x.at)
    && String(x.预算分配 || '').trim() && String(x.最大赌注 || '').trim() && String(x.最怕 || '').trim())
}

/** 教师端/复盘用：把理由与宣言拉平成可读行（缺 ⇒ 明说"未填"，不补） */
export function 可读摘要() {
  const all = 读理由()
  const d = 读宣言()
  return {
    理由: 取舍项.map(k => ({ 项: k.名, 写了: 理由合格(all[k.key] && all[k.key].text), 文本: (all[k.key] && all[k.key].text) || '', at: (all[k.key] && all[k.key].at) || null })),
    宣言: d ? { at: d.at, 预算分配: d.预算分配, 最大赌注: d.最大赌注, 最怕: d.最怕 } : null,
    缺: 缺哪些().map(x => x.名),
  }
}

// ── V113-1.4 · 第 1 周反思（'我忽略了什么信号'）────────────────────────
//   存本机（离线可写）；合格 = 至少 理由最短 字。**这条可以卡**（客户端闸，不进服务端推进链）
const RKEY = 'hotel-sim-reflect'

export function 读反思(week) {
  const all = 读(RKEY) || {}
  return all[String(week)] || null
}

export function 写反思(week, text) {
  const all = 读(RKEY) || {}
  const t = String(text == null ? '' : text).trim()
  all[String(week)] = { text: t, at: new Date().toISOString(), 合格: 反思合格(t) }
  写(RKEY, all)
  return all[String(week)]
}

export function 反思合格(s) { return String(s == null ? '' : s).trim().length >= 理由最短 }

/** 第 1 周是否已反思（周报「进入下一周」的闸门用） */
export function 第1周反思完成() { return 反思合格((读反思(1) || {}).text) }

/** 清空（重开一局时用） */
export function 清空取舍() { 写(KEY, {}); 写(DKEY, null); 写(RKEY, {}) }
