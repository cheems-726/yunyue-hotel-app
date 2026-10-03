// RV · §33-V10b（≥3 靶 · 改后必红 · 还原必绿 · 按原 EOL 写回）
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const 跑 = () => {
  const r = spawnSync('node', ['tests/uiTokens.test.mjs'], { cwd: APP, encoding: 'utf8' })
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }
}
let 全过 = true
const 靶 = (label, 文件, 改, 断言词) => {
  const raw = readFileSync(文件)
  const 原始 = raw.toString('utf8')
  const 是CRLF = 原始.includes('\r\n')
  try {
    const 改后 = 改(原始)
    if (改后 === 原始) { console.log(`     ❌ ${label}：改动未生效（锚未命中）`); 全过 = false; return }
    writeFileSync(文件, 改后)
    const r = 跑()
    const 红 = r.code !== 0 && r.out.includes(断言词)
    writeFileSync(文件, raw) // ★ 还原写 raw 原字节（§33-V7-0.5①）
    const 还 = 跑()
    const 绿 = 还.code === 0
    if (!(红 && 绿)) 全过 = false
    console.log(`     ${红 && 绿 ? '✓' : '✗'} ${label}：改后红=${红} · 还原绿=${绿}`)
  } finally { writeFileSync(文件, raw) }
}

const App = join(APP, 'src', 'App.jsx')
const Css = join(APP, 'src', 'styles.css')

// ① 塞回裸 emoji 到 JSX 正文 ⇒ 必红（① 裸 emoji）
靶('RV-1 塞回裸 emoji（👋×3 进 App.jsx 欢迎标题）', App,
  s => s.replace('>云悦酒店</div>', '>云悦酒店 👋👋👋</div>'),
  '裸 emoji')

// ② 老师端断点锁回 480（删 >1025 解锁）⇒ 必红（④ 三档断点）
靶('RV-2 断点破坏（删 >1025 媒体块头）', Css,
  s => s.split('@media (min-width: 1025px) {').join('@media (min-width: 99999px) {'),
  '三档断点')

// ③ 删掉暗色媒体查询 ⇒ 必红（④b dark）
靶('RV-3 删暗色块', Css,
  s => s.replace('@media (prefers-color-scheme: dark)', '@media (prefers-color-scheme: darkx)'),
  'prefers-color-scheme: dark')

// ④ 塞回硬编码色值×3 ⇒ 必红（⑥ 色值 · 阈 2）
靶('RV-4 塞回硬编码色值（#FF0000×3）', App,
  s => s.replace('>云悦酒店</div>', '>云悦酒店<span style={{ color: \'#FF0000 #FF0000 #FF0000\' }} />'),
  '硬编码色值')

// ⑤（V12批0-4）把 Icon 槽位换回裸插值 {x.icon} ⇒ 必红（⑧ 键名漏出家族 · D133 缺陷）
{
  const Td = join(APP, 'src', 'TeacherDashboard.jsx')
  靶('RV-5 图标槽位退回裸插值（{d.icon}）', Td,
    s => s.replace("<span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name={d.icon} size={12} /> {d.name || lg.decision_id}</span>",
                   '<span style={{ fontWeight: 600 }}>{d.icon} {d.name || lg.decision_id}</span>'),
    '图标键名')
}

// ⑥（V12批6）学生端正文调回 13px ⇒ 必红（⑩ 字号白名单）
靶('RV-6 学生端正文调回 13px', App,
  s => s.replace("fontSize: 16, marginBottom: 12 }} onClick={() => chooseRole('student')}>我是学生</button>",
                 "fontSize: 13, marginBottom: 12 }} onClick={() => chooseRole('student')}>我是学生</button>"),
  'fontSize 白名单')

console.log(`\n判定：${全过 ? '✓ RV 全过（6 靶：emoji/锁断点/删dark/色值/键名漏出/字号回退）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
