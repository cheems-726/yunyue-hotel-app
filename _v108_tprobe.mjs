// V108-S2 探针：教师端「排名」页到底显示什么（查 S3 教师侧"各组资金"命不中 0/6 的原因）
import { chromium } from 'playwright-core'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b = await chromium.launch({ executablePath: EDGE, headless: true })
const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
await p.goto('http://121.196.196.37/'); await p.waitForLoadState('domcontentloaded')
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForLoadState('domcontentloaded'); await sleep(1300)
await p.evaluate(() => { const x = [...document.querySelectorAll('button, span')].find(e => e.textContent.includes('我是老师')); x && x.click() }); await sleep(400)
await p.evaluate(() => {
  const ins = [...document.querySelectorAll('input')]
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(ins[0], 't2024'); ins[0].dispatchEvent(new Event('input', { bubbles: true }))
  s.call(ins[1], 'test123456'); ins[1].dispatchEvent(new Event('input', { bubbles: true }))
  const btn = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '登录' && !x.disabled); btn && btn.click()
})
for (let k = 0; k < 20; k++) { await sleep(500); if ((await p.evaluate(() => document.body.innerText)).includes('学生')) break }
await sleep(1800)
const 标签 = await p.evaluate(() => [...document.querySelectorAll('button,div,span')].map(e => e.textContent.trim()).filter(t => /排名|总览|看板|分组|事件/.test(t) && t.length < 12).slice(0, 10))
console.log('教师端可点标签:', JSON.stringify(标签))
await p.evaluate(() => { const x = [...document.querySelectorAll('button,div,span')].find(e => e.textContent.trim() === '排名'); x && x.click() })
await sleep(2500)
const t = await p.evaluate(() => document.body.innerText)
console.log('点「排名」后文本前 600：')
console.log(t.replace(/\s+/g, ' ').slice(0, 600))
await p.screenshot({ path: 'D:/教学app/4-审计与报告/V108-检查取证/S-02-教师端-排名.png', fullPage: true })
await b.close()
