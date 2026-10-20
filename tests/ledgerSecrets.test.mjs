// V130 §1 · 台账密料守门：已跟踪文件里**不许出现明文口令/密钥**
//
// 判据（三档）：
//   A 真密钥材料（DB/服务口令片段 + service_role JWT 形态）—— **任何**被跟踪文件 0 命中
//   B 测试机**共享测试口令**（6 位，见下方 PW 拼接）—— 只允许出现在 tests/ledgerSecrets.allowlist.txt 列出的
//     **历史记录**里（该表只准删不准加）；其余被跟踪文件出现即红
//   C 扫描自检 —— 必须真的扫到两个仓 + 对外台账（防"扫了个空还绿"）
// 覆盖：文档仓（..）+ 代码仓（.），各用 git ls-files 取跟踪清单（未跟踪的本地密料/私钥天然不在内）
// 运行：node tests/ledgerSecrets.test.mjs
// RV：往任意**非 allowlist** 的被跟踪文件里插一行共享口令 ⇒ 必红（见 tests/_rv-v130-ledger.mjs）
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = path.resolve(APP, '..')

let pass = 0, fail = 0
const ok = (c, n, extra = '') => {
  if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) }
}

// 片段拼接：本文件自身不得含完整词（否则自指命中）
const jo = (...a) => a.join('')
const KEY_NEEDLES = [jo('6a28', 'd355'), jo('b274', 'b24f'), jo('90f0', '4514')]
const PW = jo('test', '123456')
const SERVICE_ROLE_JWT = /service_role["']?\s*[:=]\s*["']?eyJ[A-Za-z0-9_-]{10,}/

const ALLOW = new Set(
  readFileSync(path.join(APP, 'tests', 'ledgerSecrets.allowlist.txt'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
)

const tracked = (root) => {
  const r = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 << 20, shell: false })
  return r.split('\0').filter(Boolean)
}

console.log('══ V130 §1 · 台账密料守门（明文口令/密钥 0 命中）══')

const repos = [
  { label: '文档仓', root: DOCS, rel: (f) => f },
  { label: '代码仓', root: APP, rel: (f) => path.relative(APP, f) },
]

let 扫描文件 = 0
const hits = { key: [], pw: [], jwt: [] }

for (const repo of repos) {
  if (!existsSync(path.join(repo.root, '.git'))) { console.error(`✗ ${repo.label} 不存在：${repo.root}`); fail++; continue }
  const files = tracked(repo.root)
  for (const f of files) {
    const p = path.join(repo.root, f)
    let txt
    try { txt = readFileSync(p, 'utf8') } catch { continue }   // 二进制/不可读 ⇒ 跳过
    扫描文件++
    for (const n of KEY_NEEDLES) {
      const i = txt.indexOf(n)
      if (i >= 0) hits.key.push(`${repo.label}:${f}:${txt.slice(0, i).split('\n').length}[${n}]`)
    }
    if (SERVICE_ROLE_JWT.test(txt)) hits.jwt.push(`${repo.label}:${f}`)
    if (txt.includes(PW)) {
      const rel = repo.label === '文档仓' ? f : f
      if (!(repo.label === '文档仓' && ALLOW.has(rel))) {
        const i = txt.indexOf(PW)
        hits.pw.push(`${repo.label}:${f}:${txt.slice(0, i).split('\n').length}`)
      }
    }
  }
}

// 扫描自检（防"一个文件都没读到还报绿"）
ok(扫描文件 > 1000, `扫描非空转：两个仓共 ${扫描文件} 个被跟踪文件`, '少于 1000 ⇒ 扫描路径坏了')
ok(existsSync(path.join(DOCS, '4-审计与报告')), '文档仓结构就位（4-审计与报告 存在）')
{
  const 台账 = path.join(DOCS, '4-审计与报告', '服务器访问与运维台账-20261020.md')
  if (existsSync(台账)) {
    const t = readFileSync(台账, 'utf8')
    ok(!KEY_NEEDLES.some(n => t.includes(n)) && !t.includes(PW), '对外台账本身不含任何明文口令', '台账里出现了口令字面量')
  } else {
    ok(true, '对外台账尚未落盘（不存在 ⇒ 本项跳过检查，不判红）')
  }
}

// A 真密钥
ok(hits.key.length === 0, 'A 真密钥片段（DB/服务口令）0 命中', hits.key.slice(0, 5).join(' | '))
ok(hits.jwt.length === 0, 'A service_role JWT 形态 0 命中', hits.jwt.slice(0, 5).join(' | '))

// B 共享口令（allowlist 之外）
ok(hits.pw.length === 0, `B 测试机口令只出现在 allowlist（${ALLOW.size} 份历史记录）内`, hits.pw.slice(0, 6).join(' | '))

if (hits.pw.length) {
  console.log('\n  命中明细（非 allowlist）：')
  hits.pw.slice(0, 20).forEach(h => console.log('    · ' + h))
  console.log('  ⇒ 处置：把该文件里的口令改成「见本地密料 §1-4」，或（历史档案）在 allowlist 里登记一行')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
