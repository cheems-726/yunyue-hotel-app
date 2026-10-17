// V114-P1 共享 helper：过「酒店命名页」（空名/重名过不去）
//   测试环境无云端会话 ⇒ 已有名字为空 ⇒ 给一个固定名字即可（真实查重逻辑由 hotelName 单测覆盖）
export async function 过命名页(page, 名字 = '云悦测试店') {
  const 在 = await page.evaluate(() => !!document.querySelector('input[placeholder*="云悦锦江店"]'))
  if (!在) return false
  await page.evaluate((n) => {
    const i = document.querySelector('input[placeholder*="云悦锦江店"]')
    if (!i) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(i, n)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }, 名字)
  await new Promise(r => setTimeout(r, 350))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => !x.disabled && /进入经营/.test(x.textContent))
    if (b) b.click()
  })
  await new Promise(r => setTimeout(r, 500))
  return true
}
