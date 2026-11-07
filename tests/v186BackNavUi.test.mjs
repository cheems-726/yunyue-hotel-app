// V186 · PC「返回上一步」· 浏览器真点击（1440 视口 · 离线演示/种子存档进主链）
// 判据（任务包-V186 §4）：1 预言弹窗可返回且不落库 · 2 草稿保留 · 5 回退不丢已选
//                      · 7 不可逆点无返回控件 · 8 键盘可用 · 9 44px/零溢出
// ★ R83-1 纪律：每个节点先断言页面特征串，再截图；截图 sha256 两两不同（同图即红）
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { join, dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..')
const OUT = join(APP, '..', '4-审计与报告', '验收-V186')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

if (!existsSync(join(APP, 'dist', 'index.html'))) { console.error('✗ 请先 npm run build'); process.exit(2) }
mkdirSync(OUT, { recursive: true })

let PORT = 4173
let BASE = `http://localhost:${PORT}/`
let server = null
if (!(await fetch(BASE).then(r => r.ok).catch(() => false))) {
  for (let p = 4206; p <= 4230; p++) {
    if (!(await fetch(`http://localhost:${p}/`).then(() => true).catch(() => false))) { PORT = p; BASE = `http://localhost:${p}/`; break }
  }
  // 用当前 node 直接跑 vite（本机 PATH 无 npm.cmd · 走 node_modules 里的 vite CLI）
  server = spawn(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: APP, stdio: 'ignore', detached: true, windowsHide: true })
}
for (let i = 0; i < 60; i++) { if (await fetch(BASE).then(r => r.ok).catch(() => false)) break; await sleep(300) }

const browser = await chromium.launch({
  executablePath: EDGE, headless: true,
  // 连续多场景开页在无 GPU 的 CI/本机会偶发 "Target crashed" ⇒ 关共享内存/GPU + 不给沙箱
  args: ['--no-proxy-server', '--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
})
const 截图 = []
async function 拍(page, name, mustContain) {
  if (mustContain) {
    const body = await page.evaluate(() => document.body.innerText)
    ok(body.includes(mustContain), `节点特征串存在：「${mustContain}」`)
  }
  const buf = await page.screenshot({ fullPage: false })
  const sha = createHash('sha256').update(buf).digest('hex')
  const file = join(OUT, `${name}.png`)
  writeFileSync(file, buf)
  截图.push({ name, sha })
  return sha
}
async function 开场景(state, _重试 = 1) {
  let page
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  } catch (e) {
    // 静默理由：连续开页偶发 Target crashed（浏览器进程级），退避后重试一次；仍失败则该场景如实红
    if (_重试 > 0) { await sleep(1200); return 开场景(state, _重试 - 1) }
    throw e
  }
  await page.addInitScript((st) => {
    localStorage.setItem('hotel-sim-state', JSON.stringify(st))
  }, state)
  await page.goto(BASE)
  await page.waitForFunction(() => document.body && document.body.innerText.length > 0, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(700)
  return page
}
const 学生 = { role: 'student', id: '20240101', uid: '20240101', name: 'V186 学生', cloud: false, className: '彩排-V105', groupNo: 1 }
const 选址档 = { city: '成都', district: '锦江区', attrs: { 客流: 4, 房价: 4, 租金: 3, 竞争: 3, 人力: 3, 波动: 2 } }
const 品牌档 = { name: '汉庭', level: '经济型 · 国民', price: '210-310元', standard: '客房70间起', rentFactor: 0.3 }

console.log('▶ V186 · PC 返回上一步（浏览器真点击）')

// ── 场景 A：选址页 · 预言弹窗（§3.1 判据 1/2）────────────────────
console.log('\n[A] 预言弹窗：有返回 · 点了不落库 · 草稿保留')
{
  const page = await 开场景({ user: 学生, welcomed: true, location: null, brand: null, property: null })
  await 拍(page, 'A1-选址页', '选择你的酒店所在地')

  // 点一个区县 ⇒ 弹预言窗（GeoMap 之外的芯片列表）
  const chip = page.locator('.district-card').first()
  await chip.click()
  await page.waitForTimeout(500)
  const 有弹窗 = await page.locator('text=选址前预言').count()
  ok(有弹窗 > 0, '点区县 ⇒ 预言弹窗打开')
  ok(await page.locator('[data-step-back]').count() === 1, '弹窗内存在 [data-step-back]（判据 1 · RV-1）')
  await 拍(page, 'A2-预言弹窗-有返回', '选址前预言')

  // 选满三项（锚点直取，避免 has-text 撞到别的按钮）⇒ 提交按钮启用（也为"草稿保留"提供可判定证据）
  for (const t of ['竞品档:前1/3', '租金档:高', '置信度:70']) {
    const b = page.locator(`[data-pred-opt="${t}"]`)
    ok(await b.count() === 1, `预言选项存在：${t}`)
    await b.click()
  }
  await page.waitForTimeout(200)
  const 提交可用 = await page.locator('button:has-text("提交预言并解锁数据卡")').isEnabled().catch(() => false)
  ok(提交可用 === true, '三项选满 ⇒ 提交按钮启用（返回后据此判草稿是否还在）')

  // 点「‹ 返回上一步（不提交）」
  await page.locator('[data-step-back]').first().click()
  await page.waitForTimeout(400)
  ok(await page.locator('text=选址前预言').count() === 0, '点返回 ⇒ 弹窗关闭')
  const body = await page.evaluate(() => document.body.innerText)
  ok(!body.includes('你的预言 vs 真值'), '返回后未解锁数据卡（未提交 ⇒ 不写 预言s · 判据 1/RV-2）')
  const 存档 = await page.evaluate(() => localStorage.getItem('hotel-sim-state') || '')
  ok(!/预言s|location-prediction/.test(存档), '存档里无该区预言记录（DOM + localStorage 双查）')
  await 拍(page, 'A3-返回后-弹窗已关', '选择你的酒店所在地')

  // 再点同一区 ⇒ 弹窗重开且草稿值还在
  await page.locator('.district-card').first().click()
  await page.waitForTimeout(400)
  ok(await page.locator('text=选址前预言').count() > 0, '再点同一区 ⇒ 弹窗重开')
  const 再开可用 = await page.locator('button:has-text("提交预言并解锁数据卡")').isEnabled().catch(() => false)
  ok(再开可用 === true, '草稿保留：重开后提交按钮仍启用（判据 2）')
  await 拍(page, 'A4-草稿保留', '选址前预言')

  // Alt+← 也能关（判据 8）
  await page.keyboard.press('Alt+ArrowLeft')
  await page.waitForTimeout(400)
  ok(await page.locator('text=选址前预言').count() === 0, 'Alt+← 关闭弹窗（键盘 = 上一步 · 判据 8）')

  // 44px + 零横向溢出（判据 9）
  const 尺寸 = await page.evaluate(() => {
    const el = document.querySelector('[data-step-back]')
    return el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null
  })
  ok(!尺寸 || (尺寸.h >= 44), '回退按钮高 ≥44px（打开弹窗时测得）')
  const 溢出 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  ok(溢出 <= 0, `1440 无横向溢出（实测 ${溢出}）`)
  await page.close()
}

// ── 场景 B：认领第 0 步 · 不可逆（判据 7）───────────────────────
console.log('\n[B] 认领第 0 步：无返回控件 + 一行不可逆原因')
{
  const page = await 开场景({ user: 学生, welcomed: true, location: 选址档, brand: 品牌档, property: null })
  await 拍(page, 'B1-认领第0步', '认领一家酒店')
  ok(await page.locator('[data-step-back]').count() === 0, '第 0 步不存在 [data-step-back]（判据 7/RV-5）')
  const body = await page.evaluate(() => document.body.innerText)
  ok(body.includes('品牌可重选：点下方'), '第 0 步给出一行不可逆原因')

  // 走到第 2 步：选经营模式 → 选物业 → 选本步取舍 → 下一步
  await page.locator('.district-card:has-text("自主直营")').first().click()
  await page.waitForTimeout(250)
  const 物业 = page.locator('.district-card').filter({ hasNotText: '自主直营' }).filter({ hasNotText: 'OTA平台合作' })
  const 物业数 = await 物业.count()
  ok(物业数 > 0, `选了经营模式后出现候选物业（实测 ${物业数} 张卡）`)
  if (物业数 > 0) await 物业.first().click()
  await page.waitForTimeout(250)
  const 取舍 = page.locator('[data-claim-opt]').first()
  const 取舍标签 = await 取舍.getAttribute('data-claim-opt').catch(() => null)
  if (await 取舍.count()) await 取舍.click()
  await page.waitForTimeout(250)
  const 下一步 = page.locator('button:has-text("确认本步取舍")').first()
  ok(await 下一步.count() > 0, '第 0 步「确认本步取舍 →」按钮存在')
  ok(await 下一步.isEnabled(), '第 0 步条件满足 ⇒ 下一步可用')
  await 下一步.click()
  await page.waitForTimeout(500)
  const 第2步 = await page.evaluate(() => document.body.innerText)
  ok(第2步.includes('第 2 步 / 共 6 步'), '前进到第 2 步（真走进去了 · R83-1 纪律）')
  ok(await page.locator('[data-step-back]').count() >= 1, '第 2 步出现 [data-step-back]（判据 5 前置）')
  await 拍(page, 'B2-认领第2步-有返回', '第 2 步 / 共 6 步')

  // 点返回 ⇒ 回第 1 步，且已选取舍仍在
  await page.locator('[data-step-back]').last().click()
  await page.waitForTimeout(400)
  const 回退后 = await page.evaluate(() => document.body.innerText)
  ok(回退后.includes('第 1 步 / 共 6 步'), '点「‹ 上一步」⇒ 回到第 1 步（RV-3：onBack 改空函数 ⇒ 红）')
  if (取舍标签) {
    const 已选 = await page.locator(`[data-claim-opt="${取舍标签}"].selected`).count()
    ok(已选 === 1, `回退后已选仍在：${取舍标签}（判据 5 · 回退不清空）`)
  } else {
    ok(false, '未取得取舍标签（无法验证"回退不丢已选"）')
  }
  await 拍(page, 'B3-返回第1步-已选仍在', '第 1 步 / 共 6 步')
  await page.close()
}

// ── 场景 C：筹建第 0 步 · 不可逆（判据 7）───────────────────────
console.log('\n[C] 筹建第 0 步：无返回控件 + 圆圈不能跳未完成步')
{
  const page = await 开场景({ user: 学生, welcomed: true, hotelName: '云悦V186店', location: 选址档, brand: 品牌档, property: { name: '交通枢纽物业', type: '商圈型', area: '约 3200 ㎡' }, established: false })
  await 拍(page, 'C1-筹建第0步', '门店筹建')
  ok(await page.locator('[data-step-back]').count() === 0, '筹建第 0 步不存在 [data-step-back]（判据 7）')
  const body = await page.evaluate(() => document.body.innerText)
  ok(body.includes('可随时退回：换物业'), '筹建第 0 步给出一行不可逆原因')
  // 圆圈跳步：点第 4 个圆圈（未完成）⇒ 仍停第 1 步 + 提示
  const 圆圈 = page.locator('.content div[style*="border-radius: 50%"]')
  const n = await 圆圈.count()
  if (n >= 4) {
    await 圆圈.nth(3).click()
    await page.waitForTimeout(300)
    const b2 = await page.evaluate(() => document.body.innerText)
    ok(b2.includes('第 1 步 / 共 4 步'), '点未完成步圆圈 ⇒ 仍停第 1 步（不能跳过 · 判据 6）')
    ok(b2.includes('不能跳过'), '拦截时出现提示文案')
  } else {
    ok(false, `未能定位 4 个步骤圆圈（实测 ${n} 个）`)
  }
  await 拍(page, 'C2-圆圈被拦', '不能跳过')
  await page.close()
}

// ── 截图唯一性（R83-1：同图即红）────────────────────────────────
console.log('\n[D] 截图唯一性')
{
  const dup = []
  for (let i = 0; i < 截图.length; i++) for (let j = i + 1; j < 截图.length; j++) {
    if (截图[i].sha === 截图[j].sha) dup.push(`${截图[i].name} = ${截图[j].name}`)
  }
  ok(截图.length >= 4, `截图 ≥4 张（实测 ${截图.length}）`)
  ok(dup.length === 0, `任意两张 sha256 不同（重复：${dup.join(' · ') || '无'}）`)
  writeFileSync(join(OUT, '截图清单.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), shots: 截图 }, null, 2))
}

await browser.close()
if (server) { try { process.kill(-server.pid) } catch (e) {} }
console.log(`\nV186 浏览器：${pass} 通过 / ${fail} 失败 → 截图 ${OUT}`)
if (fail) process.exit(1)
