// V132 §1 · 走完认领（6 步都做取舍；decision/sign 两步填理由）
// 供 v75 / verify-capital / v80 三条走查共用 —— 走不通就抛错，**不许静默跳过**。
export async function 走完认领(page, sleep = (ms) => new Promise(r => setTimeout(r, ms))) {
  for (let i = 0; i < 12; i++) {
    // ① 每一步先做取舍（第一项）+ 需要时写一句理由
    await page.evaluate(() => {
      const o = document.querySelector('[data-claim-opt]')
      if (o) o.click()
      const ta = document.querySelector('[data-claim-reason]')
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(ta, '现金紧，先保开业，再逐步把品质补上。')
        ta.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await sleep(250)
    // ② 点「确认本步取舍」或「完成认领」；被禁用 ⇒ 立刻抛错（把卡点原文带出来）
    const 结果 = await page.evaluate(() => {
      const finish = [...document.querySelectorAll('button')].find(x => !x.disabled && x.textContent.includes('完成认领'))
      if (finish) { finish.click(); return 'done' }
      const n = [...document.querySelectorAll('button')].find(x => !x.disabled && /确认本步取舍|下一步|确认无误/.test(x.textContent))
      if (n) { n.click(); return 'next' }
      const disabled = [...document.querySelectorAll('button')].find(x => x.disabled && /先做出本步取舍|先做出取舍|请先选择经营模式/.test(x.textContent))
      return disabled ? 'blocked:' + disabled.textContent.trim() : 'none'
    })
    if (结果 === 'done') {
      await sleep(700)
      return true
    }
    if (String(结果).startsWith('blocked:') || 结果 === 'none') throw new Error('认领卡住（第 ' + (i + 1) + ' 步）：' + 结果)
    await sleep(600)
  }
  throw new Error('认领 12 步内未走完')
}
