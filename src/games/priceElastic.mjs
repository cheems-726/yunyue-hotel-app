// V152 §3 · 价格弹性猜数（纯函数 · 出题/判分不碰 state、不进结算）
//
// 定位（卡）：交决策前 2 分钟热身 —— "再涨 10%，出租率会掉到多少？"
// 数据：只写 state.游戏记录（V133 契约的记录键）；断网可玩（不 fetch、不读 Date.now 出题）。
//
// 铁律：确定性 —— 同一 seed 出同一题（公平性与全班可比性的同族纪律；不掷 Math.random）。
// 弹性模型（教学简化版，页面会标注"教学模型"）：涨价 10% ⇒ 出租率掉 4–18 个百分点（选项间距拉开防歧义）。

/** 线性同余伪随机（与引擎 seededRandom 同式；本地实现避免 import 引擎） */
function rng(seed) {
  let s = Math.round(Number(seed) || 1) % 2147483647
  if (s <= 0) s += 2147483646
  return function () {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * 出一题
 * @param {{seed?:number, 定价?:number, 出租率?:number}} 入参 全部可选；给 seed 即确定
 * @returns {{题干:string, 定价:number, 上周出租率:number, 涨幅:'10%', 选项:[number,number,number], 正确:0|1|2, 解析:string}}
 *   选项/正确 都是从 0 开始的数组下标；出租率单位 = 百分数（0–100 整数）
 */
export function 出题({ seed = 1, 定价: 定价入参, 出租率: 出租率入参 } = {}) {
  const r = rng((Number(seed) || 1) * 7919 + 101)
  const 定价 = Number.isFinite(Number(定价入参)) && Number(定价入参) >= 100
    ? Math.round(Number(定价入参))
    : (160 + Math.floor(r() * 14) * 10)   // 160–290 元 · 14 档（题干随定价变化）
  const 上周出租率 = Number.isFinite(Number(出租率入参)) && Number(出租率入参) > 0 && Number(出租率入参) <= 100
    ? Math.round(Number(出租率入参))
    : 45 + Math.floor(r() * 40)   // 45–84%
  const 掉幅 = 4 + Math.floor(r() * 15)          // 掉 4–18 个百分点
  const 正确值 = Math.max(0, 上周出租率 - 掉幅)
  // 干扰项：±8~15pp，去重、夹进 0–100；与正确值至少差 2pp（防"两个选项都对"）
  const 干扰 = []
  let 候选 = [正确值 + 8 + Math.floor(r() * 8), 正确值 - 8 - Math.floor(r() * 8)]
  for (const c of 候选) {
    let v = Math.max(0, Math.min(100, Math.round(c)))
    while (干扰.some(x => Math.abs(x - v) < 3) || Math.abs(v - 正确值) < 3) v += 3
    干扰.push(Math.max(0, Math.min(100, v)))
  }
  const 选项 = [正确值, ...干扰]
  // 洗牌（Fisher–Yates · 用同一 r ⇒ 确定性）
  for (let i = 选项.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[选项[i], 选项[j]] = [选项[j], 选项[i]]
  }
  const 正确 = 选项.indexOf(正确值)
  return {
    题干: `上周出租率 ${上周出租率}%。本周定价 ${定价} 元。如果再涨 10%（到 ${Math.round(定价 * 1.1)} 元），出租率会掉到多少？`,
    定价,
    上周出租率,
    涨幅: '10%',
    选项: 选项.map(v => v + '%'),
    正确,
    解析: `教学模型：涨价 10% ⇒ 出租率掉约 ${掉幅} 个百分点（${上周出租率}% → ${正确值}%）。` +
      `真实弹性随客群/竞品/季节变化 —— 高价位段涨价掉的更多，淡季盲目降价也换不来等比客流。`,
  }
}

/**
 * 判分
 * @returns {{对:boolean, 正确:number, 选:number}} 对错 + 下标
 */
export function 判分(题, 选) {
  const i = Math.round(Number(选))
  if (!(i >= 0 && i <= 2)) return { 对: false, 正确: 题.正确, 选: -1 }
  return { 对: i === 题.正确, 正确: 题.正确, 选: i }
}

/** 记录键（写进 state.游戏记录 的形状；不进结算、不进台账） */
export const 游戏ID = 'price-elastic'
export function 空记录() { return { [游戏ID]: 0 } }
export function 加一次(记录 = {}) { return { ...记录, [游戏ID]: (Number(记录 && 记录[游戏ID]) || 0) + 1 } }
