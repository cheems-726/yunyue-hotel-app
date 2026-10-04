// RV · §33-V2 强制移交（≥3 靶 · 改后必红 → 还原必绿）
// 靶① 去掉移交入口渲染（删 App.jsx 横幅条件）⇒ handover.test [④] 必红
// 靶② 去掉留痕写入（onOperatorLog 调用改空操作）⇒ handover.test [④ 留痕] 必红
// 靶③ 混写代提交人/责任人（mountProxy 改成单字段 uid）⇒ handover.test [②] 必红
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const 跑 = () => spawnSync('node', ['tests/handover.test.mjs'], { cwd: APP, encoding: 'utf8', timeout: 120000 })
let 全过 = true
const 判 = (ok, label) => { if (!ok) 全过 = false; console.log(`     ${ok ? '✓' : '✗'} ${label}`) }

const APPF = join(APP, 'src', 'App.jsx')
const HF = join(APP, 'src', 'handover.mjs')
const appRaw = readFileSync(APPF, 'utf8')
const hRaw = readFileSync(HF, 'utf8')

try {
  // 靶① 去入口
  writeFileSync(APPF, appRaw.replace('⚠️ 本项由', '本项由（RV）'), 'utf8')
  let r = 跑()
  判(r.status !== 0, `靶① 删移交入口横幅 ⇒ 红（exit=${r.status}）`)
  writeFileSync(APPF, appRaw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶① 还原 ⇒ 绿（exit=${r.status}）`)

  // 靶② 去留痕
  writeFileSync(APPF, appRaw.replace(/onOperatorLog\(\{ type: 'handover'/, "onOperatorLog({ /* RV */ type: 'handover-x'"), 'utf8')
  r = 跑()
  判(r.status !== 0, `靶② 删 handover 留痕写入 ⇒ 红（exit=${r.status}）`)
  writeFileSync(APPF, appRaw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶② 还原 ⇒ 绿（exit=${r.status}）`)

  // 靶③ 混写两字段
  writeFileSync(HF, hRaw.replace('return { ...entries, [decisionId]: { decisionId, by_uid, owner_uid, at } }',
    'return { ...entries, [decisionId]: { decisionId, by_uid, at } }'), 'utf8')
  r = 跑()
  判(r.status !== 0, `靶③ 代提交人/责任人混写成单字段 ⇒ 红（exit=${r.status}）`)
  writeFileSync(HF, hRaw, 'utf8')
  r = 跑()
  判(r.status === 0, `靶③ 还原 ⇒ 绿（exit=${r.status}）`)
} finally {
  writeFileSync(APPF, appRaw, 'utf8')
  writeFileSync(HF, hRaw, 'utf8')
}

console.log(`\n判定：${全过 ? '✓ V2 RV 三靶全过' : '❌ RV 失败'}`)
process.exit(全过 ? 0 : 1)
