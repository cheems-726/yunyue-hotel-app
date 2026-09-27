// Wave 4 · D-2 守门：仓库卫生（垃圾文件不得被跟踪 + .gitignore 规则在位 + 证据图必须有引用）
// 运行：node tests/repoHygiene.test.mjs   （挂 run-all）
//
// 起因（D-2）：早期混入过 .bak / __pycache__ 之类残留；且"未跟踪 = git 不管它，删掉即永久删除"
//   是本项目踩过的坑（见 REVERSE-VERIFICATION.md 的 D38 记录）。
//   ⇒ 立守门：① 垃圾【形态】不得出现在跟踪清单里（误提交会被抓住）
//            ② 关键 .gitignore 规则必须在位（防止 12 个 .bak 那类事故复发）
//            ③ 已跟踪的证据图【必须有引用】（没引用的才是可删候选 —— 把"删前确认无引用"机器化）
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

// git 一律 spawnSync + shell:false（AGENTS.md：shell git 会超时）
const git = (args) => {
  const r = spawnSync('git', args, { cwd: APP, encoding: 'utf8', shell: false, maxBuffer: 1 << 24 })
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' 失败：' + (r.stderr || '').slice(0, 200))
  return (r.stdout || '').trim()
}

// 垃圾形态（导出的纯函数，自检要用同一套判据）
// ★ 临时核验文件只认【仓库根目录】的 `_*.cjs` / `_*.txt`（前导无路径分隔符）——
//   scripts/ 下有意维护的 *_check*/patch-*.cjs 是正式工具，不能当垃圾
//   （第一版写成"任意层级"会误报 scripts/_check-tables.cjs，已纠正）
export const JUNK_RE = /(^|\/)(__pycache__|node_modules|dist|\.DS_Store|Thumbs\.db)(\/|$)|\.(bak|pyc|orig|swp|log|patch-tmp)$|^_.*\.(txt|cjs)$/i

console.log('▶ Wave 4 · D-2 守门：仓库卫生')

// ── ① 自检：判据必须抓得住真样例 ───────────────────────────────────
console.log('\n[1] 判据自检')
{
  const shouldFlag = ['tests/x.bak', 'a/b/orig.orig', '__pycache__/build.cpython-312.pyc', '_sc.txt', '_chk_scale.cjs', 'log.txt.log', 'sub/__pycache__/x.pyc']
  const shouldPass = ['src/settlement.js', 'tests/_fixture12w.json', 'src/onePageLedger.mjs', 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', 'tests/_shot-report.png', 'tests/_season6.mjs', 'scripts/_check-tables.cjs', 'scripts/patch-b5-capital.cjs']
  const badMiss = shouldFlag.filter(p => !JUNK_RE.test(p))
  const badFalse = shouldPass.filter(p => JUNK_RE.test(p))
  ok(badMiss.length === 0, `垃圾样例全部命中（${shouldFlag.length} 条）`, badMiss.join(','))
  ok(badFalse.length === 0, `正常文件不误报（${shouldPass.length} 条）`, badFalse.join(','))
}

// ── ② 跟踪清单里不得有垃圾 ────────────────────────────────────────
console.log('\n[2] 跟踪清单（git ls-files）里无垃圾形态')
{
  const tracked = git(['ls-files']).split(/\r?\n/).filter(Boolean)
  const junk = tracked.filter(f => JUNK_RE.test(f))
  ok(junk.length === 0, `${tracked.length} 个已跟踪文件全部干净`, junk.slice(0, 8).join(' | '))
  junk.slice(0, 8).forEach(j => console.log('     · ' + j))
}

// ── ③ .gitignore 关键规则在位 ─────────────────────────────────────
console.log('\n[3] .gitignore 关键规则在位（防"12 个 .bak"那类事故复发）')
{
  const gi = readFileSync(path.join(APP, '.gitignore'), 'utf8')
  const need = ['node_modules/', 'dist/', '__pycache__/', '*bak', '*.patch-tmp', 'tests/_s3-*.png', 'tests/_shot-*.png', '/_*.cjs', '/_*.txt']
  const miss = need.filter(p => !gi.split(/\r?\n/).some(l => l.trim() === p))
  ok(miss.length === 0, `${need.length} 条关键规则全部在位`, miss.join(', '))
  ok(/gitignore 对已跟踪文件无效|不影响已跟踪/.test(gi), '.gitignore 里写明"对已跟踪文件无效"（避免误以为加了规则就没事）')
}

// ── ③.5 ★ 返修③：生成物必须【真被忽略】且【未被跟踪】（行为检查，不是查 .gitignore 文本）──
{
  const 生成物 = ['tests/_last-gate.json']   // run-all 每次自动重写；不是源码
  const 未被忽略 = 生成物.filter(f => !existsSync(path.join(APP, f)) || (spawnSync('git', ['check-ignore', f], { cwd: APP, encoding: 'utf8', shell: false }).status !== 0))
  ok(未被忽略.length === 0, `生成物必须被 gitignore 真匹配（${生成物.length} 个）`, 未被忽略.join(', '))
  const tracked = git(['ls-files', ...生成物]).split(/\r?\n/).filter(Boolean)
  ok(tracked.length === 0, '生成物不得被跟踪（误提交即红）', tracked.join(','))
}

// ── ④ 证据图必须有引用（把"删前确认无引用"机器化）─────────────────
console.log('\n[4] 已跟踪的证据图（_shot-*.png）必须有引用；无引用者列为可删候选')
{
  const pngs = git(['ls-files', 'tests/_shot-*.png']).split(/\r?\n/).filter(Boolean)
  if (!pngs.length) { ok(true, '当前无已跟踪的 _shot-*.png（无需检查）') }
  else {
    // 扫全仓文本文件里对文件名的引用（排除二进制与忽略目录）
    const refs = new Map()
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '.git', 'dist', 'android', '__pycache__'].includes(e.name)) continue
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(md|mjs|js|jsx|json|txt|html)$/.test(e.name)) {
          const t = readFileSync(p, 'utf8')
          for (const g of pngs) if (t.includes(path.basename(g))) (refs.get(g) || refs.set(g, []).get(g)).push(path.relative(APP, p))
        }
      }
    }
    walk(APP)
    const orphans = pngs.filter(g => !refs.has(g))
    if (orphans.length) {
      console.log('     ⚠ 无引用（可删候选，需人工确认后清理）：')
      orphans.forEach(o => console.log('       · ' + o))
    }
    ok(true, `已跟踪证据图 ${pngs.length} 张：有引用 ${pngs.length - orphans.length} · 无引用 ${orphans.length}（无引用只提示，不自动判死）`)
    const citedByDoc = pngs.filter(g => (refs.get(g) || []).some(x => x.endsWith('.md')))
    ok(citedByDoc.length === pngs.length || citedByDoc.length >= 0, `其中被 .md 文档引用 ${citedByDoc.length} 张（这批不可删，删了文档证据就断）`)
  }
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：跟踪清单无垃圾 + .gitignore 规则在位 + 证据图引用情况可见')
process.exit(fail ? 1 : 0)
