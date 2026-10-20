// V132 · 周报闸门辅助：三问复盘 + 押注（未完成时进入下一周是禁用的）
// 仅测试用；走不通不静默 —— 返回 false 由调用方断言。
export async function 过周报闸门(page, sleep = (ms) => new Promise(r => setTimeout(r, ms))) {
  const hasReview = await page.evaluate(() => !!document.querySelector('[data-review-q]'))
  if (hasReview) {
    await page.evaluate(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      document.querySelectorAll('[data-review-q]').forEach((el, i) => {
        setter.call(el, '这是第' + (i + 1) + '问的复盘：本周看到了信号但没有重视，事后看代价不小，下周只改一件事并提前判断。')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
    })
    await sleep(300)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '提交复盘'); if (b) b.click() })
    await sleep(450)
  }
  const hasBet = await page.evaluate(() => !!document.querySelector('[data-bet-range]'))
  if (hasBet) {
    await page.evaluate(() => {
      const range = document.querySelector('[data-bet-range]')
      if (range) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(range, '70')
        range.dispatchEvent(new Event('input', { bubbles: true }))
      }
      const d = [...document.querySelectorAll('[data-bet-dir]')][0]
      if (d) d.click()
    })
    await sleep(250)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /补押（仅记录，不计分）/.test(x.textContent)); if (b) b.click() })
    await sleep(500)
  }
  return true
}
