// R109-2 防复发：**离线（无登录会话）时云写入必须不发请求**。
//   背景（实测取证 2026-10-15）：V109 新加的选址落库在无会话时仍发
//   `POST /rest/v1/decision_log` ⇒ RLS 拒（401 · code 42501 "new row violates row-level
//   security policy"）⇒ ① 控制台留 401（`verify-live-review-ui` 把它当失败 · 3 红里的 2 条）
//   ② 上层只能谎报"网络问题"（实际是没登录）—— 正是 R109 要治的「离线不假活着」。
//   判据两条（缺一即红）：
//     ① 静态：`saveDecisionLog` 里 `from('decision_log').insert` **之前**必须有会话门（getSession + 提前返回）
//     ② 行为：置入"fetch 一被调用就报错"的探针 ⇒ 无会话调用 `saveDecisionLog`
//            必须 0 次 fetch 且返回 `{ ok:false, 离线:true }`（写-读回 · D278 口径）
import { readFileSync } from 'node:fs'

const bad = []
const f = 'src/supabaseClient.js'
const raw = readFileSync(f, 'utf8')

// ① 静态：insert 之前有会话门
{
  const 起 = raw.indexOf('export async function saveDecisionLog')
  const 插 = raw.indexOf(".from('decision_log')", 起)
  const 门 = raw.indexOf('有会话()', 起)
  if (起 === -1) bad.push(`${f}: 找不到 saveDecisionLog`)
  else if (插 === -1) bad.push(`${f}: saveDecisionLog 里找不到 .from('decision_log')`)
  else if (门 === -1 || 门 > 插) bad.push(`${f}: saveDecisionLog 在会话门之前就发 insert（离线会裸发请求 ⇒ 401）`)
}

// ② 行为：无会话 ⇒ 0 次 fetch + { ok:false, 离线:true }
{
  const 原fetch = globalThis.fetch
  let fetch次数 = 0
  globalThis.fetch = (...a) => { fetch次数++; return Promise.reject(new Error('离线不该发请求: ' + a[0])) }
  try {
    const { saveDecisionLog } = await import('../src/supabaseClient.js')
    const r = await saveDecisionLog({ userId: 'u-离线', groupKey: 'g', week: 1, decisionId: 'R109-2', answer: '甲', feedback: '乙' })
    if (fetch次数 !== 0) bad.push(`离线调用 saveDecisionLog 仍发了 ${fetch次数} 次 fetch（应 0 次）`)
    if (!(r && r.ok === false && r.离线 === true)) bad.push(`离线返回应为 { ok:false, 离线:true }，实得 ${JSON.stringify(r)}`)
    console.log(`  行为探针：fetch 实调 ${fetch次数} 次 · 返回 ${JSON.stringify(r)}`)
  } catch (e) {
    bad.push(`行为探针异常：${(e && e.message) || e}`)
  } finally { globalThis.fetch = 原fetch }
}

// ③ 两处调用点：失败提示不得为空兜（V98-⑤ 同源），且离线/网络分级
{
  const 阿 = readFileSync('src/App.jsx', 'utf8')
  const 空兜 = /saveDecisionLog\([\s\S]{0,900}?\.catch\(\(\) => \{\}\)/.test(阿)
  if (空兜) bad.push('src/App.jsx: saveDecisionLog 存在空 catch 兜（用户看不到失败）')
  if (!/saveDecisionLog\([\s\S]{0,900}?离线/.test(阿)) bad.push('src/App.jsx: 无 saveDecisionLog 的「离线」分级提示（把没登录说成网络问题）')
}

console.log('══ R109-2 防复发：离线云写入不发请求 ══')
for (const b of bad.slice(0, 5)) console.log('  ✗ ' + b)
const 检查数 = 4   // ① 静态会话门 ② 0 次 fetch ③ 返回离线标记 ④ 调用点分级提示
const 通过 = Math.max(0, 检查数 - bad.length)
console.log(bad.length === 0 ? 'PASS —— 会话门在 insert 之前 · 离线 0 次 fetch · 返回 { ok:false, 离线:true } · 提示分级' : `FAIL —— ${bad.length} 处`)
console.log(`结果: ${通过} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
