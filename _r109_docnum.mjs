// R109-文档数字回写：从 _last-gate.json 实读 fast 值，回写四处文档（幂等 · 可重复跑）
import { readFileSync, writeFileSync } from 'node:fs'

const rec = JSON.parse(readFileSync('tests/_last-gate.json', 'utf8'))
const fast = rec.fast.通过, raw = rec.fast.原始失败
const full = rec.full.通过, fullRaw = rec.full.原始失败
console.log(`实读：fast ${fast}/0（原始失败 ${raw}）· full ${full}/0（原始失败 ${fullRaw}）`)

const 处 = [
  ['D:/教学app/hotel-app/AGENTS.md',
    /快检 \*\*\d+ \/ 0（其中 \d+ 为已知红原始失败）\*\*/,
    `快检 **${fast} / 0（其中 ${raw} 为已知红原始失败）**`],
  ['D:/教学app/1-总纲与进度/长效任务总表（总纲·开工先读）.md',
    /快检 \*\*\d+\/0\*\*（其中 \d+ 为已知红原始失败）/,
    `快检 **${fast}/0**（其中 ${raw} 为已知红原始失败）`],
  ['D:/教学app/4-审计与报告/全日过审包-20260929.md',
    /快检 \*\*\d+\/0（其中 \d+ 已知红原始失败）\*\*/,
    `快检 **${fast}/0（其中 ${raw} 已知红原始失败）**`],
  ['D:/教学app/4-审计与报告/会话交接卡.md',
    /--fast --no-build\s+→ \*\*\d+\/0（其中 \d+ 已知红原始失败）\*\*/,
    `--fast --no-build   → **${fast}/0（其中 ${raw} 已知红原始失败）**`],
]

let 改 = 0
for (const [f, re, 新] of 处) {
  const s = readFileSync(f, 'utf8')
  if (!re.test(s)) { console.log(`  ✗ 未命中：${f}`); continue }
  const out = s.replace(re, 新)
  if (out !== s) { writeFileSync(f, out); 改++ }
  console.log(`  ✓ ${f.split('/').pop()} → ${新.slice(0, 40)}…`)
}
console.log(`改动 ${改} 处`)
