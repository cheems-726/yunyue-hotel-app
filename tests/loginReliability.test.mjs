// V129-R109 · 登录可靠性：连通预检 / 入口建议 / 四类错误分级 / 工号校验
// 运行：node tests/loginReliability.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 分类登录错误, 校验工号, 登录预检, 探测地址, 错误类型, 入口候选 } from '../src/loginReliability.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V129 · 登录可靠性（R109-1/R109-2）')

console.log('\n[①] 四类错误：文案 + 下一步 都在')
{
  const 网络 = 分类登录错误({ message: 'Failed to fetch', name: 'TypeError', 入口: 'http://x' })
  ok(网络.类型 === 错误类型.网络不可达, 'fetch 抛错 ⇒ 网络不可达')
  ok(/连不上服务器（http:\/\/x 不通）/.test(网络.文案), `网络文案含"连不上服务器（入口不通）"（实得：${网络.文案}）`)
  ok(!!网络.下一步 && /入口|离线演示/.test(网络.下一步), '网络：下一步含"换入口/离线演示"')

  const 凭证 = 分类登录错误({ message: 'Invalid login credentials', status: 400 })
  ok(凭证.类型 === 错误类型.凭证错误, '400 invalid_credentials ⇒ 凭证错误')
  ok(/工号或密码不对/.test(凭证.文案) && /大小写|空格/.test(凭证.文案), '凭证文案含"工号或密码不对（大小写/空格）"')
  ok(/旧口令立即失效/.test(凭证.下一步), '凭证：下一步含"旧口令立即失效"')

  const 服务器 = 分类登录错误({ message: 'Service Unavailable', status: 503, 重试次数: 2 })
  ok(服务器.类型 === 错误类型.服务器故障, '5xx ⇒ 服务器故障')
  ok(/服务器忙或故障/.test(服务器.文案) && /已重试 2 次/.test(服务器.文案), '服务器文案含"已重试 N 次"')
  ok(/重试/.test(服务器.下一步), '服务器：下一步含"重试"')

  const 格式 = 校验工号('teacher', '2024')
  ok(格式 === '教师工号应为 T+数字（如 T2024）', `工号格式：老师必须 T+数字（实得 ${格式}）`)
  ok(/T\+数字/.test(格式), '格式文案含"T+数字"')
  ok(校验工号('student', '20240101') === '' && 校验工号('teacher', 't2024') === '', '合法工号/学号放行')
}

console.log('\n[②] 连通预检：健康 → ok；A 不通 B 通 → 建议 B；全不通 → 全不通')
{
  const fake = (失败前缀 = [], 成功前缀 = []) => async (url) => {
    for (const s of 成功前缀) if (url.startsWith(s)) return { ok: true, status: 200 }
    for (const f of 失败前缀) if (url.startsWith(f)) throw new TypeError('Failed to fetch')
    throw new TypeError('Failed to fetch')
  }
  const a = await 登录预检({ supabaseUrl: 'https://db.x', origin: 'https://app.x', timeout: 50, fetchImpl: fake([], ['https://db.x']) })
  ok(a.状态 === 'ok' && a.supabaseOk === true, 'Supabase 健康 ⇒ 状态 ok（不打扰用户）')

  const b = await 登录预检({ supabaseUrl: 'https://db.x', origin: 'https://app.x', timeout: 50, fetchImpl: fake([], ['http://121.196.196.37']) })
  ok(b.状态 === '入口可用' && b.可用入口 === 'http://121.196.196.37', `Supabase 不通 + B 通 ⇒ 建议 B（实得 ${b.可用入口}）`)
  ok(b.入口s.length === 3, '三个入口都探测了（A/B/C）')

  const c = await 登录预检({ supabaseUrl: 'https://db.x', origin: 'https://app.x', timeout: 50, fetchImpl: fake() })
  ok(c.状态 === '全不通' && c.可用入口 === null, '三个入口都不通 ⇒ 全不通（不是密码问题）')
  ok(/不是密码问题/.test(c.说明), '全不通的说明写明"不是密码问题"')

  const 超时 = await 探测地址('https://slow.x', { timeout: 30, fetchImpl: (url, opt) => new Promise((_, rej) => { opt.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))) }) })
  ok(超时.ok === false && 超时.status === 0, '探测超时 ⇒ 结构化失败（不抛错）')
  const 入口 = 入口候选('https://app.x')
  ok(入口.length === 3 && 入口[0].url === 'https://app.x', '入口候选 = A 当前 + B/C 备选（只作建议）')
}

console.log('\n[③] 登录页接线（静态）：挂载即预检 · 错误带下一步 · trim 不回退')
{
  const app = readFileSync('src/App.jsx', 'utf8')
  ok(/登录预检\(\{ supabaseUrl: SUPABASE_URL, origin:/.test(app), '★ 登录页挂载即调 登录预检（不等点登录）')
  ok(/useEffect\(\(\) => \{[\s\S]{0,400}登录预检\(/.test(app), '预检在 useEffect 里（挂载即跑）')
  ok(/下一步：\{errorNext\}/.test(app), '错误区渲染「下一步」')
  ok(/错误类型\.服务器故障[\s\S]{0,200}重试/.test(app), '服务器故障给「重试」按钮（保留已填内容）')
  ok(/错误类型\.网络不可达/.test(app) && /改用可用入口/.test(app), '网络不可达给「改用可用入口」按钮')
  ok(/<预检横幅 预检=\{预检\}/.test(app), '选择身份页也显示预检横幅（点登录之前）')
  ok(/setStep\('demo'\)/.test(app) && /离线演示/.test(app), '离线演示入口仍在（预检失败不阻塞）')
  // ★ 密码首尾空格仍能登录（V106-D2④ 不回退）：两处都必须 trim
  const 登录trim = (app.match(/signInWithPassword\(\{ email, password: String\(password\)\.trim\(\) \}\)/g) || []).length
  const 注册trim = (app.match(/signUp\(\{ email, password: String\(password\)\.trim\(\) \}\)/g) || []).length
  ok(登录trim === 1 && 注册trim === 1, `登录/注册都保留 trim（实得 ${登录trim}/${注册trim}）`)
  ok(/校验工号\(role, id\)/.test(app), '工号校验走 loginReliability 单源')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
