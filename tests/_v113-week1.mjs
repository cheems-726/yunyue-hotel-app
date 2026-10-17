// V113-1.4 共享 helper：填第 1 周反思（不填 ⇒ 「进入下一周」按钮 disabled）
//   ★ 用原生 value setter + input 事件（React 受控组件只认这个），与既有走查脚本同法
export async function 填第1周反思(page, 文本 = '我忽略了：只看租金没看竞品密度，且把旺季价格用在淡季，导致第 1 周出租率偏低') {
  const 填了 = await page.evaluate((t) => {
    const area = [...document.querySelectorAll('textarea')].find(x => x.getAttribute('data-reflect') === '1')
    if (!area) return false
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(area, t)
    area.dispatchEvent(new Event('input', { bubbles: true }))
    area.blur()
    return true
  }, 文本)
  await new Promise(r => setTimeout(r, 300))
  return 填了
}
