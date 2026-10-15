// V109：选址现在有「预言 + 承诺书」两道闸门（流程变更由 V109 卡授权）
// ⇒ 走查套件必须学会这两步，否则会卡在选址页（这不是放宽判据，是跟随新流程）
export async function 过选址闸门(page) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const txt = () => page.evaluate(() => document.body.innerText)

  // ① 选址前预言（**不填 ⇒ 数据卡解锁不了**）
  if ((await txt()).includes('选址前预言')) {
    await page.evaluate(() => {
      const hit = t => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === t); b && b.click() }
      hit('前1/3'); hit('高'); hit('70%')
    })
    await sleep(300)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('提交预言并解锁')); b && b.click() })
    await sleep(800)
    return { 预言: true }
  }
  return { 预言: false }
}

/** 承诺书（**不签 ⇒「确认选址」点不动**）—— 返回是否签署成功 */
export async function 签承诺书(page) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('写承诺书')); if (b) { b.click(); return true } return false })
  if (!opened) return false
  await sleep(700)
  await page.evaluate(() => {
    const tas = [...document.querySelectorAll('textarea')]
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    const vals = [
      '押「客流+租金双优」客群假设，目标出租率 75%（套件走查用）',
      '不选金牛区（租金高一档）也不选双流区（客流低一档）',
      '竞争维度最容易被竞品密度打脸',
      '无',
      '租金超预算 / 客流不及预期 / 竞品价格战',
    ]
    tas.forEach((el, i) => { set.call(el, vals[i] || ''); el.dispatchEvent(new Event('input', { bubbles: true })) })
  })
  await sleep(500)
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('签署承诺书')); b && b.click() })
  await sleep(800)
  return true
}

/** 两步一起走（点完区划卡之后、点「确认选址」之前调用）*/
export async function 过两道闸门(page) {
  const a = await 过选址闸门(page)
  const b = await 签承诺书(page)
  return { ...a, 承诺书: b }
}
