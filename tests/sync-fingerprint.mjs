// V16批2b · sync-fingerprint —— 四处收尾指纹 + 门禁数字行 机械写入（幂等 · CRLF 感知）
// 用法：node tests/sync-fingerprint.mjs          （从 git + _last-gate.json 实读 · 写四处）
//       node tests/sync-fingerprint.mjs --check  （只查不写 · 不一致 exit 1）
// 幂等：连跑两次无差异。
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = join(APP, '..')
const CHECK = process.argv.includes('--check')

const git = (args) => {
  const r = spawnSync('git', args, { cwd: APP, encoding: 'utf8', shell: false, windowsHide: true })
  return r.status === 0 ? (r.stdout || '').trim() : null
}
const head = git(['rev-parse', '--short', 'HEAD'])
const 未推 = Number(git(['rev-list', '--count', 'origin/main..HEAD']))

let gate = {}
try { gate = JSON.parse(readFileSync(join(APP, 'tests', '_last-gate.json'), 'utf8')) } catch (e) {}
const full通过 = gate.full ? gate.full.通过 : '?'
const fast通过 = gate.fast ? gate.fast.通过 : '?'
const 原始失败 = gate.原始失败 != null ? gate.原始失败 : '?'

const 指纹新 = `收尾指纹：HEAD ${head} · 未推 **${未推}**`
const full原始失败 = (gate.full && gate.full.原始失败 != null) ? gate.full.原始失败 : 原始失败
const fast原始失败 = (gate.fast && gate.fast.原始失败 != null) ? gate.fast.原始失败 : '?'
const 数字新 = `全量 **${full通过} 通过 / 0 失败（其中 ${full原始失败} 为已知红原始失败）** · 快检 **${fast通过}/0（其中 ${fast原始失败} 为已知红原始失败）**`

// ★ D147 补：数值目标（非"收尾指纹"文件，但同样会被门禁数字判据比对）
const 数字目标 = [
  { p: join(APP, 'AGENTS.md'), 名: 'AGENTS.md（§2 状态行）' },
  { p: join(ROOT, '1-总纲与进度', '长效任务总表（总纲·开工先读）.md'), 名: '长效任务总表（§7 守门行）' },
]
for (const t of 数字目标) {
  try {
    let x = readFileSync(t.p, 'utf8')
    const 前 = x
    x = x.replace(/(快检 \*\*)\d+(\s*\/\s*0)/g, `$1${fast通过}$2`)
    x = x.replace(/(全量 \*\*)\d+( 通过 \/ 0 失败)/g, `$1${full通过}$2`)
    if (x !== 前) { if (CHECK) { console.log(`  [check] ${t.名} 需更新`); 不一致++ } else { writeFileSync(t.p, x, 'utf8'); console.log(`  ✓ ${t.名} 数字已刷（full ${full通过} · fast ${fast通过}）`) } }
    else console.log(`  - ${t.名} 数字已一致`)
  } catch (e) { console.error('  ✗ ' + t.名, e.message) }
}

const 文件 = [
  join(ROOT, '9-夜间自动化', '夜间开工闸门.txt'),
  join(ROOT, '9-夜间自动化', 'night-run-log.md'),
  join(ROOT, '4-审计与报告', '全日过审包-20260929.md'),
  join(ROOT, '4-审计与报告', '会话交接卡.md'),
]

let 不一致 = 0
const 指纹旧_re = /收尾指纹：HEAD [0-9a-f]+ · 未推 \*\*\d+\*\*/

for (const p of 文件) {
  let s
  try { s = readFileSync(p, 'utf8') } catch (e) { console.error(`✗ 读不到 ${p}`); 不一致++; continue }
  const 保留EOL = s.includes('\r\n') ? '\r\n' : '\n'
  let modified = false

  // 1. 指纹行
  if (指纹旧_re.test(s)) {
    const 新s = s.replace(指纹旧_re, 指纹新)
    if (新s !== s) { s = 新s; modified = true }
  } else {
    console.error(`  ⚠ ${p.split('\\').pop()}: 未找到指纹行（需人工核）`)
    不一致++
  }

  // 2. 门禁数字行（全日过审包 / 会话交接卡⑥ · 含全量/快检通过数）
  const 数字行旧_re = /(> \*\*门禁数字\*\*（V14批1 单一口径）|node tests\/run-all\.mjs\s+→ )\*\*[\d,]+ 通过 \/ [\d,]+ 失败（其中 \d+ 为已知红原始失败）\*\*/
  if (数字行旧_re.test(s)) {
    // 按旧格式定位，只换里面的数
    s = s.replace(/(\*\*)[\d,]+ 通过 \/ [\d,]+ 失败（其中 \d+ 为已知红原始失败）(\*\*)/, (m) => m) // 不动（门禁数字行在下方单独处理）
  }

  if (modified) {
    if (CHECK) { console.log(`  [check] ${p.split('\\').pop()} 需更新`); 不一致++ }
    else { writeFileSync(p, s, 'utf8'); console.log(`  ✓ ${p.split('\\').pop()} 指纹已刷`) }
  } else {
    console.log(`  - ${p.split('\\').pop()} 指纹已一致`)
  }
}

// 3. 门禁数字行（全日过审包 + 交接卡 ⑥ 段 · 快检/全量通过数机械写入）
if (!CHECK) {
  const 过审包 = join(ROOT, '4-审计与报告', '全日过审包-20260929.md')
  try {
    let s = readFileSync(过审包, 'utf8')
    const 前 = s
    // ★ D147 修：措辞容差（原正则要求「为已知红原始失败」，实际文件写「已知红原始失败」⇒ 从不匹配却谎报 ✓）
    s = s.replace(/(快检 \*\*)\d+(\s*\/\s*0)/, `$1${fast通过}$2`)
    s = s.replace(/(全量[^\n]*?\*\*)\d+( 通过)/, `$1${full通过}$2`)
    if (s !== 前) { writeFileSync(过审包, s, 'utf8'); console.log(`  ✓ 过审包 数字行已刷（full ${full通过} · fast ${fast通过}）`) }
    else console.log('  - 过审包 数字行已一致')
  } catch (e) { console.error('  ✗ 过审包', e.message) }

  const 交接卡 = join(ROOT, '4-审计与报告', '会话交接卡.md')
  try {
    let s = readFileSync(交接卡, 'utf8')
    const EOL = s.includes('\r\n') ? '\r\n' : '\n'
    // ★ D145 补：⑥ 段【段内作用域】——① 段有历史基线（HEAD xxx 是发布时点·不许动）⇒ 只改 ⑥ 段
    const parts = s.split(/^(## .*)$/m)
    for (let i = 0; i < parts.length; i++) {
      if (/^##\s*⑥/.test(parts[i]) && i + 1 < parts.length) {
        parts[i + 1] = parts[i + 1]
          .replace(/(HEAD \`)[0-9a-f]{7,8}(\`)/g, `$1${head}$2`)                       // ⑥ 的 HEAD 引用
          .replace(/(git log origin\/main\.\.HEAD --oneline\s+→ \*\*未推 )\d+(\*\*)/, `$1${未推}$2`)  // ⑥ 的未推行
          .replace(/(node tests\/run-all\.mjs --fast --no-build   → \*\*)\d+(\/0)/, `$1${fast通过}$2`)
          .replace(/(node tests\/run-all\.mjs\s+→ \*\*)\d+( 通过 \/ 0 失败)/, `$1${full通过}$2`)
        i++
      }
    }
    const 前卡 = s
    s = parts.join('')
    if (s !== 前卡) { writeFileSync(交接卡, s, 'utf8'); console.log(`  ✓ 交接卡 数字行 + ⑥ 段 HEAD/未推已刷（full ${full通过} · fast ${fast通过} · HEAD ${head} · 未推 ${未推}）`) }
    else console.log('  - 交接卡 数字行 + ⑥ 段 已一致')
  } catch (e) { console.error('  ✗ 交接卡', e.message) }

  // 4. 入口文档 0-从这里开始.md（★ V17批2 补：docs-staleness --gate 判「状态段全量数字 === 门禁记录」，
  //    但本脚本此前没刷它 ⇒ full 数字每前进一次它就红一次 —— 与 AGENTS/过审包同类，机械刷新）
  //    ★ 行内「其中 N」用分档原始失败（V17批2 起 run-all 分档入记录）· 会漂的明细数（25/46 一类）改指记录
  const 入口 = join(ROOT, '0-从这里开始.md')
  try {
    let s = readFileSync(入口, 'utf8')
    const 前 = s
    s = s.replace(/(【门禁】全量 \*\*)\d+( 通过 \/ 0 失败（其中 )\d+( 为已知红原始失败）\*\*)/, `$1${full通过}$2${full原始失败}$3`)
    s = s.replace(/(· 快检 )\d+(\/0（其中 )\d+( 已知红原始失败）)/, `$1${fast通过}$2${fast原始失败}$3`)
    s = s.replace(/(记录 @`)[0-9a-f]{7,8}(`)/, `$1${head}$2`)
    s = s.replace(/⏳（\d+\/\d+=\d+\.?\d*%）/, '⏳（fail/pass 明细以 _last-gate.json 已知红明细为准）')
    if (s !== 前) { writeFileSync(入口, s, 'utf8'); console.log(`  ✓ 0-从这里开始 数字行已刷（full ${full通过}/${full原始失败} · fast ${fast通过}/${fast原始失败}）`) }
    else console.log('  - 0-从这里开始 数字行已一致')
  } catch (e) { console.error('  ✗ 0-从这里开始', e.message) }
}

if (CHECK && 不一致 > 0) process.exit(1)
console.log(CHECK ? `\n[check] ${不一致 > 0 ? '⏳ 需更新' : '✅ 全一致'}` : '\n✅ sync-fingerprint 完成（幂等 · 可重跑）')
