// V113-1.1 共享 helper：过筹建预算闸
//   背景：预算闸生效后，默认「全中档」组合**必然超预算**（汉庭 70 间 657 万 > 600 万）⇒
//        所有走查套件选完「基准情景」后都必须**降一档**才能继续 —— 否则下一步按钮点不动。
//   口径：只做"如果有超支提示，就把装修降到低档"这一个动作（不改变任何断言）；
//        若页面上没有档位 chip（例如别的品牌/页面）⇒ 静默跳过，返回 false。
export async function 过预算闸(page, ms = 400) {
  const 有Chip = await page.evaluate(() => !!document.querySelector('[data-tier="装修"][data-val="低"]'))
  if (!有Chip) return false
  const 超支 = await page.evaluate(() => /超出预算/.test(document.body.innerText))
  if (!超支) return true
  await page.evaluate(() => { const c = document.querySelector('[data-tier="装修"][data-val="低"]'); if (c) c.click() })
  await new Promise(r => setTimeout(r, ms))
  return true
}
