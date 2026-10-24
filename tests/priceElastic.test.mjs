// V152 §3 · 价格弹性猜数（纯函数 + 记录契约 + 接线静态断言）
// 运行：node tests/priceElastic.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 出题, 判分, 游戏ID, 空记录, 加一次 } from '../src/games/priceElastic.mjs'
import { 游戏库 } from '../src/games/registry.mjs'
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

console.log('▶ V152 · 价格弹性猜数')
{
  // 确定性：同 seed 同题（公平性同族纪律）
  const a = 出题({ seed: 42 }), b = 出题({ seed: 42 })
  ok(JSON.stringify(a) === JSON.stringify(b), '同 seed 出同一题（确定性 · 不掷 Math.random）')
  const seen = new Set()
  let 选项全合法 = true, 正确在界内 = true
  for (let s = 1; s <= 200; s++) {
    const q = 出题({ seed: s })
    if (q.选项.length !== 3) 选项全合法 = false
    if (new Set(q.选项).size !== 3) 选项全合法 = false          // 三选项互不相同
    if (!(q.正确 >= 0 && q.正确 <= 2)) 正确在界内 = false
    const 正确值 = parseInt(q.选项[q.正确])
    if (!(正确值 >= 0 && 正确值 <= 100)) 正确在界内 = false
    if (q.上周出租率 < 45 || q.上周出租率 > 84) 选项全合法 = false
    seen.add(q.题干)
  }
  ok(选项全合法, '200 个 seed：选项恒 3 个、互不相同、都在 0–100%')
  ok(正确在界内, '正确下标恒在 0–2')
  ok(seen.size > 20, `题干有变化空间（200 seed ⇒ ${seen.size} 种题干）`)
  // 判分
  const q = 出题({ seed: 7 })
  ok(判分(q, q.正确).对 === true, '选正确 ⇒ 对')
  ok(判分(q, (q.正确 + 1) % 3).对 === false, '选错误 ⇒ 错')
  ok(判分(q, 9).对 === false && 判分(q, -1).选 === -1, '脏下标 ⇒ 判错（不抛异常）')
  // 记录契约（只写 游戏记录；不进结算）
  const r = 加一次(加一次(加一次(空记录())))
  ok(r[游戏ID] === 3, `玩一题记一次（3 次后 = ${r[游戏ID]}）`)
  ok(Object.keys(r).length === 1 && 游戏ID === 'price-elastic', '记录键只有本游戏的 id（不碰经营 state）')
  ok(加一次(null)[游戏ID] === 1, 'null 记录安全加一（不抛异常）')
  // 注册表：第二张卡、native、无 iframe 入口
  const g = 游戏库.find(x => x.id === 游戏ID)
  ok(游戏库.length === 2, `注册表第二张卡（共 ${游戏库.length} 张）`)
  ok(g && g.形态 === 'native' && !g.入口, 'native 形态（断网可玩 · 无 iframe 入口）')
  ok(g && Array.isArray(g.一句话) === false && g.一句话.length >= 10, '一句话介绍在位')
}

console.log('\n[接线静态断言]')
{
  const player = readFileSync(new URL('../src/GamePlayer.jsx', import.meta.url), 'utf8')
  ok(/形态 === 'native'/.test(player), 'GamePlayer 有 native 分支')
  const shell = readFileSync(new URL('../src/games/PriceElastic.jsx', import.meta.url), 'utf8')
  ok(/onRecord && onRecord\(/.test(shell), 'RV 锚：玩一题必调 onRecord（删掉这行 ⇒ 下面的记录接线断言链红）')
  ok(/data-elastic-opt/.test(shell) && /data-elastic-reveal/.test(shell), '选项/揭晓都有 data 锚（走查可点）')
  ok(/minHeight: 44/.test(shell) || /minHeight:52/.test(shell), '按钮 ≥44 高（390 移动端判据）')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ok(/onRecord=\{\(id\) => set游戏记录/.test(app), 'App 把游戏记录写进 state（判据②的接线）')
  ok(/已玩/.test(readFileSync(new URL('../src/GamesLibrary.jsx', import.meta.url), 'utf8')), '列表页显示「已玩 N 次」（记录可见 · 判据②展示侧）')
  const 纯源 = readFileSync(new URL('../src/games/priceElastic.mjs', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('')
  ok(!/fetch\(|Date\.now/.test(纯源), '纯函数零网络零时钟（断网可玩 · 剥注释后判）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
