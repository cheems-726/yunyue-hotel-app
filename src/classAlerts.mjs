// V171 · 教师端课堂预警纯层 —— 只读 + 提示 · 零网络 · 阈值集中一处（老师可调）
// 数据来源全部标注字段（卡 §1"逐条可点开看依据"）；严重度 ①② 优先。

/** 阈值常量（集中一处 · 只许在这里调） */
export const 阈值 = {
  初始资金: 1490000,          // 资金异常基准（game_states 初始 capital）
  资金异常单周净利: -50000,    // 单周净利 < 此值 ⇒ 异常
  资金异常比例: 0.8,           // 资金 < 初始 × 比例 ⇒ 异常
  差评堆积条数: 3,             // 本周待处理差评 ≥ 3
  好评骤降百分点: 15,          // 本周好评率 < 上周 − 15pp
  未决策宽限日: 5,             // 周内第 5 天仍 0 决策 ⇒ ①
  决策不足日: 6,               // 周内第 6 天 1–5 项 ⇒ ②（明天不能结算）
  决策总数: 18,                // 每周应做决策数
}

/** 规则清单（id 固定 · 供告警历史与 RV 定位） */
export const 规则表 = [
  { id: 'A1', 名称: '本周未决策', 严重度: 1 },
  { id: 'A2', 名称: '决策不足', 严重度: 1 },
  { id: 'A3', 名称: '资金异常', 严重度: 2 },
  { id: 'A4', 名称: '差评堆积', 严重度: 2 },
  { id: 'A5', 名称: '好评率骤降', 严重度: 3 },
  { id: 'A6', 名称: '本周无动静', 严重度: 3 },
]

const 已过 = (dayIndex, 日) => dayIndex >= 日

/**
 * 课堂告警计算（只读）
 * @param {object} p
 *   groups  [{ 组名, uid, state, week }]  —— state 为 game_states.state（history/doneDecisions/capital）
 *   dayIndex 周内第几天（1–7 · dayToWeekDay(权威日)）
 *   当前周   全班统一教学周
 * @returns {Array<{组名, uid, 规则, id, 详情, 依据}>} ①② 优先，同级按组名
 */
export function 课堂告警({ groups = [], dayIndex = 1, 当前周 = 0, 组名映射 = {} }) {
  const out = []
  for (const g of groups) {
    const st = g.state || {}
    const hs = Array.isArray(st.history) ? st.history : []
    const 末周 = hs[hs.length - 1] || null
    const 上周 = hs[hs.length - 2] || null
    const done = st.doneDecisions && typeof st.doneDecisions === 'object' ? Object.keys(st.doneDecisions).length : null
    const 决策数 = done != null ? done : (末周 ? Number(末周['决策数'] || 末周.doneCount) || 0 : 0)
    const 组名 = 组名映射[g.uid] || g.组名 || g.name || g.uid
    const push = (id, 详情, 依据) => {
      const r = 规则表.find(x => x.id === id)
      out.push({ 组名, uid: g.uid, 规则: r.名称, id, 严重度: r.严重度, 详情, 依据 })
    }
    // ① 本周未决策（决策数=0 且已到第 5 天）
    if (决策数 === 0 && 已过(dayIndex, 阈值.未决策宽限日)) {
      push('A1', `本周决策 0/${阈值.决策总数}（第 ${dayIndex} 天）`, 'state.doneDecisions 键数 = 0 · dayToWeekDay(权威日)')
    }
    // ② 决策不足（1–5 项且已到第 6 天 ⇒ 明天不能结算）
    else if (决策数 > 0 && 决策数 < 6 && 已过(dayIndex, 阈值.决策不足日)) {
      push('A2', `本周仅 ${决策数} 项（< 6）· 明天不能结算`, `state.doneDecisions 键数 = ${决策数} · dayToWeekDay(权威日)`)
    }
    // ③ 资金异常
    if (typeof st.capital === 'number') {
      const 单周净利 = 末周 ? Number(末周.netProfit) || 0 : null
      if (单周净利 != null && 单周净利 < 阈值.资金异常单周净利) {
        push('A3', `上周净利 ${单周净利.toLocaleString()} 元（< ${阈值.资金异常单周净利.toLocaleString()}）`, 'history[末].netProfit')
      } else if (st.capital < 阈值.初始资金 * 阈值.资金异常比例) {
        push('A3', `资金 ${st.capital.toLocaleString()} 元（< 初始 80% = ${Math.round(阈值.初始资金 * 阈值.资金异常比例).toLocaleString()}）`, 'state.capital · 阈值.初始资金×0.8')
      }
    }
    // ④ 差评堆积（本周待处理 ≥ 3 · handleStats.pending 字段在才判）
    if (末周 && 末周.handleStats && Number(末周.handleStats.pending) >= 阈值.差评堆积条数) {
      push('A4', `本周待处理差评 ${末周.handleStats.pending} 条（≥ ${阈值.差评堆积条数}）`, 'history[末].handleStats.pending')
    }
    // ⑤ 好评率骤降（本周 < 上周 − 15pp · finalGoodRate 为百分数数值）
    if (末周 && 上周 && 末周.finalGoodRate != null && 上周.finalGoodRate != null) {
      const 降 = Number(上周.finalGoodRate) - Number(末周.finalGoodRate)
      if (降 > 阈值.好评骤降百分点) {
        push('A5', `好评率 ${Number(上周.finalGoodRate)}% → ${Number(末周.finalGoodRate)}%（降 ${Math.round(降)}pp）`, 'history[末-1].finalGoodRate vs history[末].finalGoodRate')
      }
    }
    // ⑥ 本周无动静（本周没有任何登录/更新记录 —— 以 updated_at 早于本周开始为代理判据 · 如实标注）
    if (g.updated_at && 当前周 > 0) {
      const 更新 = new Date(g.updated_at)
      const now = new Date()
      const 间隔天 = Math.floor((now - 更新) / 86400000)
      if (间隔天 >= 7) {
        push('A6', `最近一次云端更新在 ${Math.round(间隔天)} 天前（本周无任何动静）`, 'game_states.updated_at（登录记录无留存 · 以更新时间为代理判据）')
      }
    }
  }
  const sev = Object.fromEntries(规则表.map(r => [r.id, r.严重度]))
  return out.sort((a, b) => (sev[a.id] - sev[b.id]) || a.组名.localeCompare(b.组名))
}

/** 课堂节奏（§2：第 N 周 · 第 D/7 天 · 已决策组数/6 · 距结算还需 M 组达标） */
export function 课堂节奏({ groups = [], dayIndex = 1, 当前周 = 0 }) {
  const 达标线 = 6
  let 已决策 = 0
  for (const g of groups) {
    const st = g.state || {}
    const done = st.doneDecisions && typeof st.doneDecisions === 'object' ? Object.keys(st.doneDecisions).length : 0
    if (done >= 达标线) 已决策++
  }
  return {
    周: 当前周, 天: dayIndex, 总天数: 7,
    已决策组数: 已决策, 总组数: groups.length,
    距结算还需: Math.max(0, groups.length - 已决策),
    达标线,
    依据: 'state.doneDecisions ≥ ' + 达标线 + ' 视为达标',
  }
}
