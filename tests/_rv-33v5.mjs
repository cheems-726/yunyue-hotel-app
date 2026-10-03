// §33-V5 的**可执行**反向验证（RV）：数据溯源守门"能红"
//   RV-1 造无来源格：附加项软装行的「来源」字段删掉 ⇒ dataProvenance「每条附加项都带来源」必红；还原必绿
//   RV-2 悄悄升级：看板某区 ADR 格 🟡 改 🟢（不加来源）⇒「🟢 格必须同行带来源」必红；还原必绿
//   RV-3 (附) 城市冒充区县：把 OCC 行的「不可当区县值」删掉 ⇒ 必红；还原必绿
// 用法：node tests/_rv-33v5.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = path.resolve(APP, '..')
const INVEST = path.join(APP, 'src', 'establishmentInvest.mjs')
const 看板 = path.join(ROOT, '6-数据与对外材料', '数据完整度看板-W4-1.md')
const 测试 = path.join(APP, 'tests', 'dataProvenance.test.mjs')
const 跑 = () => {
  try { return { code: 0, out: execFileSync(process.execPath, [测试], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') } }
}
let 全过 = true
const 例 = (label, 文件, 旧, 新, 片段) => {
  const 原始 = readFileSync(文件, 'utf8')
  const 是CRLF = 原始.includes('\r\n')
  const 备份 = 是CRLF ? 原始.replace(/\r\n/g, '\n') : 原始
  try {
    if (!备份.includes(旧)) { console.log(`     ❌ 找不到靶子：${label}（期望片段：${旧.slice(0, 80)}）`); 全过 = false; return }
    writeFileSync(文件, (是CRLF ? 备份.replace(旧, 新).replace(/\n/g, '\r\n') : 备份.replace(旧, 新)))
    const r = 跑()
    const 掉红 = r.code !== 0 && r.out.includes(片段)
    writeFileSync(文件, 原始)
    const 还原 = 跑()
    const 复绿 = 还原.code === 0
    if (!(掉红 && 复绿)) 全过 = false
    console.log(`     ${掉红 && 复绿 ? '✓' : '✗'} ${label}：改后 exit=${r.code}（红=${掉红}）· 还原后 exit=${还原.code}（绿=${复绿}）`)
  } finally { writeFileSync(文件, 原始) }
}
console.log('【RV §33-V5】数据溯源守门（红→绿可逆）\n')
例('RV-1 造无来源格：删软装行「来源」字段',
  INVEST,
  "来源: '教学默认档位 · 待老师确认；★ 行业方向佐证：《中国酒店室内设计行业概览》（东方财富研报 2022-06）\"重软装轻硬装\"、家具成本占室内设计企业成本约 28% —— ★ 口径不同（企业成本构成 ≠ 占装修金额比）⇒ 只记录不改值（照\"开办费·迈点 5–9%\"先例）', 置信度: '低' },",
  "置信度: '低' },   // RV：来源字段被删",
  '每条附加项都带「来源」字段')
例('RV-2 悄悄升级：锦江区 ADR 🟡 → 🟢（不加来源）',
  看板,
  '| 成都·锦江区 | 🟡 | 🟡 450（n=1）',
  '| 成都·锦江区 | 🟡 | 🟢 450（n=1）',
  '🟢 格必须同行带来源')
例('RV-3 城市冒充区县：删「不可当区县值」警示',
  看板,
  '不可当区县值',
  '（RV：警示被删）',
  '不可当区县值')
console.log(`\n判定：${全过 ? '✓ RV 全过（3 条靶子：无来源/悄悄升级/城市冒充）' : '❌ 有靶子未按预期变红/还原'}`)
process.exit(全过 ? 0 : 1)
