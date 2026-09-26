// -*- coding: utf-8 -*-
// ✅项④：修 App.jsx:378 资金卡双重扣成本 + B5（补传 prevCapital / bizMode，并把资金收敛为唯一权威值）
// 约束：只 commit 不 push；不动任何"实时对账/调整额"相关代码（方向已变更）
const fs = require('fs')
const path = 'src/App.jsx'
let raw = fs.readFileSync(path, 'utf8')
const crlf = raw.split('\r\n').length - 1
const nl = crlf > 0 && crlf > raw.split('\n').length - 1 - crlf ? '\r\n' : '\n'
let ok = true
function rep(oldS, newS, tag) {
  const ot = oldS.split('\n').join(nl), nt = newS.split('\n').join(nl)
  const c = raw.split(ot).length - 1
  if (c !== 1) { console.log('  x ' + tag + ' 命中 ' + c + ' 次'); ok = false; return }
  raw = raw.split(ot).join(nt)
  console.log('  v ' + tag)
}

// ① 资金卡：不再自己算（原式把已含在 profit 里的 totalExpenses 又减了一次），改读唯一权威 state
rep(
`        const cap = 500000 - history.reduce((a, h) => a + (h.totalExpenses || 0), 0) + history.reduce((a, h) => a + (h.profit || 0), 0)`,
`        // 资金唯一权威 = state.capital（由 settle 返回写回）。
        // 🔴 原式 500000 − ΣtotalExpenses + Σprofit 属双重扣成本：profit 已扣除 totalCost（含 weeklyExpenses），
        //    再减一次 totalExpenses → 学生看到的资金被系统性低估（实测第1周差 6,981 = 当周 totalExpenses）
        const cap = capital`,
'资金卡改读权威值')

// ② capital state：从存档恢复（老档无 capital → 500000 + Σ历史利润，平滑迁移，避免一次性跳变）
// ③ 新增 bizMode state（旧档缺省 direct，与当前行为一致 → 老班零变化）
rep(
`  const [capital, setCapital] = useState(500000) // 初始资金50万`,
`  // 资金唯一权威（settle 返回后写回）；旧档无该字段时按"50万 + 历史累计利润"平滑起算
  const [capital, setCapital] = useState(
    typeof saved.capital === 'number' ? saved.capital : 500000 + (saved.history || []).reduce((a, h) => a + (h.profit || 0), 0)
  )
  // 经营模式：认领页选择（direct 自主直营 / ota 平台合作）。旧档缺省 direct —— 与当前引擎默认一致，老班成绩零变化
  const [bizMode, setBizMode] = useState(saved.bizMode === 'ota' ? 'ota' : 'direct')`,
'capital/bizMode state')

// ④ 存档：带上 capital + bizMode（本机持久化）
rep(
`      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs }))
    } catch (e) {}
  }, [user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed, attrs])`,
`      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs, capital, bizMode }))
    } catch (e) {}
  }, [user, location, brand, property, established, doneDecisions, report, week, history, finished, welcomed, attrs, capital, bizMode])`,
'本机存档加 capital/bizMode')

// ⑤ 云端同步载荷 + ⑥ 云端恢复分支
rep(
`  const cloudState = { location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs }`,
`  const cloudState = { location, brand, property, established, estChoices, doneDecisions, report, week, history, finished, welcomed, attrs, capital, bizMode }`,
'云端载荷加 capital/bizMode')
rep(
`          setEstChoices(cloudSaved.estChoices || null)
          setDoneDecisions(cloudSaved.doneDecisions || {})`,
`          setEstChoices(cloudSaved.estChoices || null)
          setDoneDecisions(cloudSaved.doneDecisions || {})
          if (typeof cloudSaved.capital === 'number') setCapital(cloudSaved.capital)
          if (cloudSaved.bizMode) setBizMode(cloudSaved.bizMode === 'ota' ? 'ota' : 'direct')`,
'云端恢复 capital/bizMode')

// ⑦ B5：结算补传 prevCapital + bizMode（此前都没传 → 资金每周重置、模式永远按 direct 算）
rep(
`    const result = settle({ site, brand, decisions: doneDecisions, week, pendingNegatives, prevGoodRate, crisisResponse, resolvedCount, attrs, liveNegCount, livePosCount })`,
`    // B5：补传 prevCapital（否则资金每周从 50 万重算、"资金链断裂/预警"永不触发）
    //     + bizMode（否则认领页选的"平台合作"在引擎侧永远走不到，帮助页承诺的 15% 佣金与流量加成失效）
    const result = settle({ site, brand, decisions: doneDecisions, week, pendingNegatives, prevGoodRate, crisisResponse, resolvedCount, attrs, liveNegCount, livePosCount, prevCapital: capital, bizMode })`,
'B5 补传两参数')

// ⑧ 结算后把权威资金写回 state（与 R0 属性写回同一处）
rep(
`    if (result.attrsAfter) setAttrs(result.attrsAfter)`,
`    if (result.attrsAfter) setAttrs(result.attrsAfter)
    if (typeof result.capital === 'number') setCapital(result.capital)   // 资金唯一权威：引擎返回即权威`,
'结算后写回资金')

// ⑨ 认领页选的经营模式此前被丢弃（Claim 已传上来，App 只取了 property）→ 存储它
rep(
`  function handleClaimComplete(result) {
    setProperty(result.property)
    setEstablished(false)
  }`,
`  function handleClaimComplete(result) {
    if (result.property) setProperty(result.property)          // 完成认领（第二步）
    if (result.mode) setBizMode(result.mode === 'ota' ? 'ota' : 'direct')  // 认领第一步选的经营模式（此前被丢弃 → B5 根因）
    setEstablished(false)
  }`,
'handleClaimComplete 收下 mode')

if (!ok) { console.log('  -> 未写盘（整体重跑）'); process.exit(1) }
fs.writeFileSync(path, raw, 'utf8')
console.log('  -> 已写盘 ' + path)
