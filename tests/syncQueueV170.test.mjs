// V170 · 弱网提交队列纯层单测 + 演示隔离静态断言（判据①②③ 的本地等价）
import { readFileSync } from 'node:fs'
import { 入队, 出队, 补交, 退避, 超时信号, QUEUE_KEY } from '../src/syncQueue.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V170 · 弱网与离线（纯层）')
{
  // 判据①：断网提交 3 项 ⇒ 队列 3；补交 ⇒ 清空
  let q = []
  for (let i = 1; i <= 3; i++) q = 入队(q, { key: 'g1:week' + i, kind: 'save', week: i })
  ok(q.length === 3, '断网 3 项 ⇒ 队列 3')
  // 幂等：同 key 再入队 ⇒ 覆盖不重复计
  q = 入队(q, { key: 'g1:week3', kind: 'save', week: 3 })
  ok(q.length === 3 && q.find(x => x.key === 'g1:week3').次数 === 2, '同 key 再入队 ⇒ 覆盖且计次数（防重复结算口径）')
  // 联网补交：全成功 ⇒ 清空
  let 落盘 = null
  const r1 = await 补交(q.map(it => ({ ...it, exec: async () => true })), rest => { 落盘 = rest })
  ok(r1.剩余.length === 0 && r1.成功 === 3 && r1.失败 === false, '联网补交 3/3 ⇒ 队列清空（判据①正向）')
  // 中途失败 ⇒ 停在该条保序（弱网再次断）
  const 顺序 = []
  const r2 = await 补交([
    { key: 'a', exec: async () => { 顺序.push('a'); return true } },
    { key: 'b', exec: async () => { 顺序.push('b'); return false } },
    { key: 'c', exec: async () => { 顺序.push('c'); return true } },
  ], rest => { 落盘 = rest })
  ok(顺序.join(',') === 'a,b' && r2.剩余.length === 2 && r2.剩余[0].key === 'b', '补交失败 ⇒ 停在失败条、后序保序不丢（判据①半）')
  ok(出队(q, 'g1:week1').length === 2, '出队按 key 移除')
  ok(退避(0) === 1000 && 退避(1) === 3000, '指数退避 1s/3s（§2）')
  ok(typeof QUEUE_KEY === 'string' && QUEUE_KEY.length > 0, 'QUEUE_KEY 常量导出（localStorage 持久键）')
  // §2 超时信号
  ok(超时信号(8000) instanceof AbortSignal || 超时信号(8000) === undefined, '超时信号可用（8s · AbortSignal.timeout）')

  // 接线静态断言（App 侧）
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/data-sync-queue-bar/.test(app) && /待同步 \{待同步\.length\} 项/.test(app), '顶部待同步条 + 计数（§1 可视）')
  ok(/data-sync-retry/.test(app), '「立即重试」按钮在（§1 手动补交）')
  ok(/setInterval\(\(\) => \{ 补交全部\(\) \}, 15000\)/.test(app), '15 秒自动补交调度')
  ok(/window\.addEventListener\('online'/.test(app), 'online 事件补交')
  ok(!/云端同步失败，进度已保存在本机，请检查网络/.test(app), '不再弹"失败请重试"（§1 要求入队代替）')
  ok(/演示模式 · 数据不上云/.test(app) && /data-demo-banner/.test(app), '演示模式常驻条（§3）')
  ok(/localStorage\.removeItem\(STORAGE_KEY\)/.test(app) && /切回真实登录 ⇒ 清演示数据/.test(app), '切回真实登录 ⇒ 清演示痕迹（§3）')
  const cl = readFileSync(new URL('../src/supabaseClient.js', import.meta.url), 'utf8')
  ok(/signal: 超时信号\(8000\)/.test(cl), 'saveGameStateNow 8 秒超时（§2）')
  // §3 判据① 静态形态：演示路径（cloud=false）所有云写闸都在 user.cloud 之后
  ok(/if \(!user\?\.cloud \|\| !user\?\.uid \|\| restoring \|\| 云端恢复中\) return/.test(app), '演示模式（cloud=false）不进任何云写路径（RV：去掉拦截 ⇒ 本断言红）')
  const reg = readFileSync(new URL('./run-all.mjs', import.meta.url), 'utf8')
  ok(/syncQueueV170/.test(reg), 'run-all 已挂本套件')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
