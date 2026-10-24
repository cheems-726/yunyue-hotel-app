// V133 · 游戏入口守门：注册表唯一/合法 · iframe 资源齐全 · 44px · 不写 state/不计分
// 运行：node tests/gamesLibrary.test.mjs   （挂 run-all fast）
import { readFileSync, existsSync } from 'node:fs'
import { 游戏库 } from '../src/games/registry.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync('src/' + f, 'utf8')

console.log('▶ V133 · 小游戏入口')

console.log('\n[①] 注册表：唯一 id · 合法形态 · iframe 入口存在')
{
  ok(Array.isArray(游戏库) && 游戏库.length >= 1, `至少 1 个游戏（实得 ${游戏库.length}）`)
  ok(new Set(游戏库.map(g => g.id)).size === 游戏库.length, 'id 唯一')
  for (const g of 游戏库) {
    ok(typeof g.名称 === 'string' && g.名称.length > 0, `${g.id}：有名称`)
    ok(typeof g.一句话 === 'string' && g.一句话.length > 0, `${g.id}：有一句话`)
    ok(['iframe', 'native'].includes(g.形态), `${g.id}：形态合法（${g.形态}）`)
    if (g.形态 === 'iframe') {
      ok(/^\/games\/[a-z0-9-]+\/index\.html$/.test(g.入口), `${g.id}：入口形如 /games/<id>/index.html`)
      const dir = 'public' + g.入口.replace('/index.html', '')
      ok(existsSync(dir + '/index.html') && existsSync(dir + '/styles.css') && existsSync(dir + '/game.js'), `${g.id}：index/styles/game 三件齐`)
      ok(existsSync(dir + '/vendor/three.min.js'), `${g.id}：vendor/three.min.js 随资源入库`)
    }
  }
}

console.log('\n[②] 移动端 44px（只改按钮尺寸）')
{
  const css = readFileSync('public/games/room-arrange/styles.css', 'utf8')
  ok(/\.seg button\{[^}]*min-height:44px/.test(css), '视图切换按钮 ≥44 高')
  ok(/\.btn\{[^}]*min-height:44px/.test(css), '换房/重置/完成按钮 ≥44 高')
  ok(/\.scroll-btn\{[^}]*width:44px/.test(css), '托盘左右箭头 ≥44 宽')
}

console.log('\n[③] App 接线：第5项「游戏」· 列表 · 全屏播放器 · 播放时隐藏 tabbar')
{
  const app = src('App.jsx')
  ok(/\{ key: 'games', icon: 'event\.holiday', label: '实训游戏' \}/.test(app), 'tabs 有第 5 项「实训游戏」')
  ok(/games: <GamesLibrary onPlay=\{set游戏进行中\}( 已玩=\{游戏记录\})? ?\/>/.test(app), 'pages 有 games 列表页（V152 可带已玩记录）')
  ok(/游戏进行中 && <GamePlayer 游戏=\{游戏进行中\} onClose|游戏进行中 && <GamePlayer 游戏=\{游戏进行中\} onBack/.test(app), '游戏进行中渲染全屏播放器')
  ok(/\{!游戏进行中 && \(/.test(app), '播放时隐藏 tabbar')
  const lib = src('GamesLibrary.jsx')
  ok(/游戏库\.map/.test(lib) && />开始<\/button>/.test(lib), '列表页只读 registry + 开始按钮')
  const player = src('GamePlayer.jsx')
  ok(/<iframe/.test(player) && /‹ 返回/.test(player), '播放器有 iframe + 返回')
  ok(/sandbox="allow-scripts allow-same-origin"/.test(player), 'iframe sandbox 受限（同源脚本）')
}

console.log('\n[④] 红线：不计分/不写 state/不进主包')
{
  const player = src('GamePlayer.jsx')
  const lib = src('GamesLibrary.jsx')
  ok(!/localStorage|fetch\(|supabase|saveGameState|settle\(/.test(player + lib), '入口/播放器不写存档、不调引擎')
  ok(!/from 'three'|three\.min/.test(lib + player), 'three.js 不进主包（只由 iframe 加载）')
  const app = src('App.jsx')
  ok(!/settle\(.*游戏|游戏.*settle\(/.test(app), '游戏不参与结算')
  const 资源 = ['index.html', 'styles.css', 'game.js'].map(f => readFileSync('public/games/room-arrange/' + f, 'utf8')).join('\n')
  ok(!/https?:\/\//.test(资源), '游戏资源无外链（断网可玩的前提）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
