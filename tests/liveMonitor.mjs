// 演示前实时监控（2026-11-10 · 面向 14:30 校领导展示）
//
// 一条命令跑完：静态可达性 + 后端健康 + 学生离线演示全流程 + 教师离线演示首屏
// 输出：每项 ✓/✗，任一 ✗ ⇒ exit 1（供 cron/循环盯）
// 运行：node tests/liveMonitor.mjs [--quick]
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

const BASE = process.env.MON_BASE || 'http://121.196.196.37/'
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].find(p => existsSync(p))
const QUICK = process.argv.includes('--quick')
const 禁用词 = ['待补', '无公开来源', '无法核算', '无法估算', '装不下', '成本不完整', '缺数据', '未采', '不计费', '演示设定']

let pass = 0, fail = 0
const 问题 = []
const ok = (c, n, x = '') => {
  if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; 问题.push(n + (x ? ' :: ' + String(x).slice(0, 200) : '')); console.log('  ✗ ' + n + (x ? '  [' + String(x).slice(0, 200) + ']' : '')) }
}
const 时间 = () => new Date().toLocaleTimeString('zh-CN', { hour12: false })

async function main() {
  console.log(`\n=== 监控 ${时间()} · ${BASE} ===`)

  // ① 静态可达性
  let html = ''
  try { const r = await fetch(BASE, { cache: 'no-store' }); ok(r.ok, `入口 HTTP ${r.status}`); html = await r.text() } catch (e) { ok(false, '入口不可达', e.message) }
  const entry = /src="([^"]*assets\/index-[^"]+\.js)"/.exec(html)?.[1]
  ok(!!entry, 'index.html 引用入口包', entry || html.slice(0, 80))
  if (entry) {
    const url = new URL(entry, BASE).href
    const r2 = await fetch(url, { cache: 'no-store' }).catch(() => null)
    ok(!!r2 && r2.ok, `入口包可下载（${entry}）`)
    if (r2 && r2.ok) {
      const js = await r2.text()
      const 命中 = 禁用词.filter(w => js.includes(w))
      ok(命中.length === 0, `线上包禁用词 0（命中：${命中.join('/') || '无'}）`)
    }
  }
  ok(/manifest\.json/.test(html), 'manifest 引用在')
  const sw = await fetch(new URL('sw.js', BASE).href).catch(() => null)
  ok(!!sw && sw.ok, 'sw.js 可达')
  const health = await fetch(new URL('auth/v1/health', BASE).href).catch(() => null)
  ok(!!health && (health.ok || health.status === 401), `Auth 健康端点 ${health ? health.status : '不可达'}`)

  if (QUICK) return 收尾()
  if (!EDGE) { console.log('  ⏭ 无浏览器可执行文件，跳过 UI 段'); return 收尾() }

  // IP + http：Chromium 默认 HTTPS-First 会把 http://IP 升级成 https://IP（证书不匹配 ⇒ 拦截）
  //   监控里关掉升级；真实设备若被升级，按 README 的「继续访问」步骤操作。
  const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--disable-features=HttpsUpgrades,HTTPS-FirstMode,HttpsFirstBalancedModeAutoEnable'] })
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } })
  const page = await ctx.newPage()
  const 控制台错误 = []
  page.on('pageerror', e => 控制台错误.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') 控制台错误.push('console: ' + m.text()) })
  const 失败请求 = []
  page.on('requestfailed', r => { if (!/favicon/.test(r.url())) 失败请求.push(r.url().slice(0, 120) + ' ' + (r.failure()?.errorText || '')) })

  const 点 = (t) => page.evaluate(t2 => {
    const els = [...document.querySelectorAll('button, span, div, a')].reverse()
    const el = els.find(x => x.textContent.trim() === t2) || els.find(x => x.textContent.includes(t2))
    if (el) { el.click(); return true }
    return false
  }, t)
  const 文本 = () => page.evaluate(() => document.body.innerText)

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
    let t = await 文本()
    ok(t.length > 30 && /云悦酒店/.test(t), '首屏渲染（非白屏）', t.slice(0, 60))
    ok(!/旧站点|登录不了/.test(t) || !/你打开的是旧站点/.test(t), '无旧站横幅（用 IP 入口）')

    // 学生离线演示
    await 点('我是学生'); await page.waitForTimeout(300)
    await 点('离线演示'); await page.waitForTimeout(300)
    await 点('进入演示'); await page.waitForTimeout(1200)
    t = await 文本()
    ok(t.length > 50 && !/离线演示模式/.test(t), '学生端进入成功', t.slice(0, 80))
    const 页们 = []
    const 记 = async (n) => { const x = await 文本(); 页们.push({ n, x, 命中: 禁用词.filter(w => x.includes(w)) }) }
    await 记('学生首页')
    for (let i = 0; i < 10; i++) {
      const c = (await 点('下一步')) || (await 点('继续')) || (await 点('确认')) || (await 点('开始')) || (await 点('我选好了'))
      if (!c) break
      await page.waitForTimeout(500)
      await 记('演示第' + (i + 1) + '步')
    }
    const 坏 = 页们.filter(p => p.命中.length)
    ok(坏.length === 0, `学生流程禁词 0（${页们.length} 页）`, 坏.map(p => p.n + ':' + p.命中.join('/')).join(' '))

    // 教师离线演示（新上下文，避免串会话）
    const page2 = await ctx.newPage()
    await page2.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 })
    const 点2 = (t2) => page2.evaluate(tt => {
      const els = [...document.querySelectorAll('button, span, div, a')].reverse()
      const el = els.find(x => x.textContent.trim() === tt) || els.find(x => x.textContent.includes(tt))
      if (el) { el.click(); return true }
      return false
    }, t2)
    await 点2('我是老师'); await page2.waitForTimeout(300)
    await 点2('离线演示'); await page2.waitForTimeout(300)
    await 点2('进入演示'); await page2.waitForTimeout(1800)
    const tt = await page2.evaluate(() => document.body.innerText)
    ok(tt.length > 50, '教师端进入成功', tt.slice(0, 60))
    const 教师命中 = 禁用词.filter(w => tt.includes(w))
    ok(教师命中.length === 0, `教师首屏禁词 0（${教师命中.join('/') || '无'}）`)
    ok(!/学期已满 12 周/.test(tt), '第 1 周班级不显示「学期已满」（班级隔离）', tt.match(/学期已满[^\n]*/)?.[0] || '')
    // 周次单一来源：标题「当前第 N 周」与「课堂预警（第 M 周」必须一致
    {
      const w1 = /当前第 (\d+) 周/.exec(tt)?.[1]
      const w2 = /课堂预警（第 (\d+) 周/.exec(tt)?.[1]
      ok(!w1 || !w2 || w1 === w2, `教师端周次一致（标题第${w1 ?? '?'}周 / 预警第${w2 ?? '?'}周）`)
    }
    await page2.close()
  } catch (e) {
    ok(false, 'UI 流程异常', e.message)
  } finally {
    const 真错误 = 控制台错误.filter(x => !/favicon|Download the React DevTools|net::ERR_ABORTED/.test(x))
    ok(真错误.length === 0, `无 JS 运行时错误（${真错误.length}）`, 真错误.slice(0, 3).join(' | '))
    const 真失败 = 失败请求.filter(x => !/favicon|analytics/.test(x))
    ok(真失败.length === 0, `无失败请求（${真失败.length}）`, 真失败.slice(0, 3).join(' | '))
    await browser.close().catch(() => {})
  }
  收尾()
}

function 收尾() {
  console.log(`\n结果 ${时间()}：${pass} 通过 / ${fail} 失败`)
  if (问题.length) console.log('问题：\n- ' + 问题.join('\n- '))
  process.exit(fail === 0 ? 0 : 1)
}

main()
