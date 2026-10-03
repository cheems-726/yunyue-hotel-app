// RV · §33-V12（卡 §6 三靶 · 改后必红 · 还原必绿 · 按原 EOL 写回）
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const 跑 = () => {
  const r = spawnSync('node', ['tests/dataCompleteness.test.mjs'], { cwd: APP, encoding: 'utf8' })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}
let 全过 = true
const 靶 = (label, 文件, 改, 断言词) => {
  const raw = readFileSync(文件)
  const 原始 = raw.toString('utf8')
  try {
    const 改后 = 改(原始)
    if (改后 === 原始) { console.log(`     ❌ ${label}：改动未生效`); 全过 = false; return }
    writeFileSync(文件, 改后)
    const r = 跑()
    const 红 = r.code !== 0 && r.out.includes(断言词)
    writeFileSync(文件, raw)   // ★ 还原写 raw 原字节
    const 还 = 跑()
    const 绿 = 还.code === 0
    if (!(红 && 绿)) 全过 = false
    console.log(`     ${红 && 绿 ? '✓' : '✗'} ${label}：改后红=${红} · 还原绿=${绿}`)
  } finally { writeFileSync(文件, raw) }
}

const Site = join(APP, 'src', 'siteLocations.mjs')

// ① 删某店 source ⇒ 必红（② 每店带 source）
靶('RV-1 删竞品店 source', Site,
  s => s.replace("source: 'Trip.com(tw,?curr=CNY) 2026-09-27'", "confidence2: 'high'"),
  '每店带 source')

// ② 改看板格数（区位数）⇒ 必红（① 区位数 === 26）
靶('RV-2 破坏区位数（锦江区删名触发 undefined）', Site,
  s => s.replace("attrs:{客流:5,房价:5,租金:5,竞争:5,人力:4,波动:2}", "attrs:{房价:5,租金:5,竞争:5,人力:4,波动:2}"),
  '区位数')

// ③ 学生端字号回退 ⇒ 必红（uiTokens ⑩ · 复用 _rv-33v10b RV-6 已覆盖 ⇒ 此处直接验证 uiTokens 关联）
{
  const App = join(APP, 'src', 'App.jsx')
  const raw = readFileSync(App)
  const 原始 = raw.toString('utf8')
  try {
    writeFileSync(App, 原始.replace("fontSize: 16, marginBottom: 12 }} onClick={() => chooseRole('student')}>我是学生</button>",
                                     "fontSize: 13, marginBottom: 12 }} onClick={() => chooseRole('student')}>我是学生</button>"))
    const r1 = spawnSync('node', ['tests/uiTokens.test.mjs'], { cwd: APP, encoding: 'utf8' })
    r1.out = (r1.stdout || '') + (r1.stderr || '')
    const 红 = r1.status !== 0 && r1.out.includes('fontSize 白名单')
    writeFileSync(App, raw)
    const r2 = spawnSync('node', ['tests/uiTokens.test.mjs'], { cwd: APP, encoding: 'utf8' })
    r2.out = (r2.stdout || '') + (r2.stderr || '')
    const 绿 = r2.status === 0
    if (!(红 && 绿)) 全过 = false
    console.log(`     ${红 && 绿 ? '✓' : '✗'} RV-3 学生端字号回退 13px（uiTokens ⑩）：改后红=${红} · 还原绿=${绿}`)
  } finally { writeFileSync(App, raw) }
}

console.log(`\n判定：${全过 ? '✓ V12 RV 全过（3 靶）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
