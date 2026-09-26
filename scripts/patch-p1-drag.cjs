// -*- coding: utf-8 -*-
// P1 · 拖动误触发返回：A 斩断横向溢出（治本）/ B 禁用横向 overscroll（兜底）/ C 触摸传播隔离
// + 自动化护栏：冒烟里加"页面不可横向滚动 + 无元素越出视口"断言
const fs = require('fs')
function patch(path, pairs) {
  let raw = fs.readFileSync(path, 'utf8')
  const crlf = raw.split('\r\n').length - 1
  const nl = crlf > 0 && crlf > raw.split('\n').length - 1 - crlf ? '\r\n' : '\n'
  let ok = true
  pairs.forEach(([o, n], i) => {
    const ot = o.split('\n').join(nl), nt = n.split('\n').join(nl)
    const c = raw.split(ot).length - 1
    if (c !== 1) { console.log(`  x ${path} 锚点${i + 1} 命中 ${c} 次：${ot.split(nl)[0].slice(0, 56)}`); ok = false; return }
    raw = raw.split(ot).join(nt)
    console.log(`  v ${path} 锚点${i + 1}：${ot.split(nl)[0].slice(0, 56)}`)
  })
  if (!ok) { console.log(`  -> 未写盘 ${path}`); return false }
  fs.writeFileSync(path, raw, 'utf8')
  console.log(`  -> 已写盘 ${path}`)
  return true
}

// ── B：禁用横向 overscroll（Chromium 的"边缘横滑后退"手势靠这个压制）──
const B = patch('src/styles.css', [
[`html, body, #root { height: 100%; }`,
 `/* P1：禁用横向 overscroll —— Android/Edge 的边缘横滑"后退"手势靠这个压制 */
html, body, #root { height: 100%; width: 100%; overscroll-behavior-x: none; }`],
// A 的配套：弹窗遮罩横向裁切（弹窗内容超宽时不许顶出视口；纵向保持可滚，避免长弹窗被切）
[`  background: rgba(0,0,0,0.45); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 0 32px;`,
 `  background: rgba(0,0,0,0.45); z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 0 32px;
  overflow-x: hidden;          /* P1：横向绝不溢出（纵向不动，长弹窗照常可滚） */`],
// C：滑块与滚动容器只允许纵向手势
[`.cost-box .cost-title { font-weight: 700; margin-bottom: 3px; }`,
 `.cost-box .cost-title { font-weight: 700; margin-bottom: 3px; }

/* P1：滑块只吃横向手势、不吃页面级滑动；滚动容器只允许纵向手势 */
input[type=range] { touch-action: pan-y; }
.content { touch-action: pan-y; }`],
])

// ── A：属性飘字不再定位到容器外侧（原 right:100% 会让页面可横向滚动）──
const A = patch('src/HotelStatus.jsx', [
[`                  style={{ '--delay': '0s', position: 'absolute', right: '100%', top: -14, marginRight: 4, fontSize: 12, fontWeight: 800,`,
 `                  style={{ '--delay': '0s', position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: -14, fontSize: 12, fontWeight: 800,`],
])

// ── C：两个滑块补触摸传播隔离 ──
const C = patch('src/DecisionPanel.jsx', [
[`            <input
              type="range"
              min={decision.min}
              max={decision.max}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#E8940F' }}`,
 `            <input
              type="range"
              min={decision.min}
              max={decision.max}
              value={sliderVal}
              onChange={e => setSliderVal(Number(e.target.value))}
              onTouchMove={e => e.stopPropagation()}
              style={{ width: '100%', accentColor: '#E8940F', touchAction: 'pan-y' }}`],
])

// ── 护栏：冒烟里加"无横向溢出"断言（结构扫描：任何元素越出视口即失败）──
const G = patch('tests/ui-smoke.mjs', [
[`async function assertLayout(pg, label) {`,
 `// P1 护栏：页面不可横向滚动 + 没有元素越出视口（拖动误触发返回的根因就是横向溢出）
async function assertNoHorizOverflow(pg, label) {
  const r = await pg.evaluate(() => {
    const vw = window.innerWidth
    const de = document.documentElement
    const over = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.offsetParent === null && el.style.position !== 'fixed') continue
      const b = el.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) continue
      if (b.right > vw + 1 || b.left < -1) over.push((el.className || el.tagName) + ':' + Math.round(b.left) + '~' + Math.round(b.right))
      if (over.length >= 3) break
    }
    return { scrollW: de.scrollWidth, clientW: de.clientWidth, vw, over }
  })
  ok(\`横向无溢出【\${label}】(scrollW=\${r.scrollW} clientW=\${r.clientW} 视口=\${r.vw})\`, r.scrollW <= r.clientW + 1)
  ok(\`无元素越出视口【\${label}】\${r.over.length ? '→ ' + r.over.join(' / ') : ''}\`, r.over.length === 0)
  return r
}

async function assertLayout(pg, label) {`],
[`  await assertLayout(page, '学生经营页')`,
 `  await assertLayout(page, '学生经营页')
  await assertNoHorizOverflow(page, '学生经营页')`],
])

console.log(`\n结果：styles=${B} HotelStatus=${A} DecisionPanel=${C} 护栏=${G}`)
process.exit(B && A && C && G ? 0 : 1)
