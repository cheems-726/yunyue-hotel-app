# -*- coding: utf-8 -*-
# 冒烟补 B2/B3 回归断言：我的页 ✏️ 改名 —— 弹窗能开 + 改名生效
import io
p = 'tests/ui-smoke.mjs'
s = io.open(p, encoding='utf-8', newline='').read()
anchor = "  await assertLayout(page, '学生我的')"
assert s.count(anchor) == 1, s.count(anchor)
block = anchor + """

  // B2/B3 回归：改名入口（我的页 ✏️）必须真的可用
  // 原缺陷：弹窗 state/JSX 在 Business、入口却在 Profile → 点 ✏️ 直接 ReferenceError（"点了没反应"）
  {
    const nameBefore = await page.evaluate(() => (JSON.parse(localStorage.getItem('hotel-sim-state') || '{}').user || {}).name || '')
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find(d => /✏️改名/.test(d.textContent) && d.style.cursor === 'pointer')
      if (el) el.click()
    })
    await sleep(600)
    ok('改名弹窗可打开（我的页 ✏️）', (await text(page)).includes('修改真实姓名'))
    await page.evaluate(() => {
      const inp = document.querySelector('input[placeholder*="真实姓名"]')
      if (!inp) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(inp, '冒烟改名测试')
      inp.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await sleep(300)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '保存' && x.className.includes('btn-confirm'))
      if (b) b.click()
    })
    await sleep(1000)
    const nameAfter = await page.evaluate(() => (JSON.parse(localStorage.getItem('hotel-sim-state') || '{}').user || {}).name || '')
    ok(`改名生效并落盘（${nameBefore || '未命名'} → ${nameAfter}）`, nameAfter === '冒烟改名测试')
  }"""
s = s.replace(anchor, block)
io.open(p, 'w', encoding='utf-8', newline='').write(s)
print('冒烟已补 B2/B3 断言')
