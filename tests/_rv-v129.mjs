// V129 反例验证（RV）：逐条拿掉修复 ⇒ 对应守门必红；还原 ⇒ 复绿
// 运行：node tests/_rv-v129.mjs      （evidence 脚本，不进 run-all）
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const 跑 = (file, args = []) => {
  try {
    const out = execFileSync(process.execPath, [path.join(APP, file), ...args], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const 试一例 = (label, 文件, 旧, 新, 套件, args = []) => {
  const p = path.join(APP, 文件)
  const 备份 = readFileSync(p, 'utf8')
  if (!备份.includes(旧)) { console.log(`  ❌ 找不到靶子：${label}`); return false }
  try {
    writeFileSync(p, 备份.replace(旧, 新))
    const r = 跑(套件, args)
    const 掉红 = r.code !== 0
    writeFileSync(p, 备份)
    const 复绿 = 跑(套件, args).code === 0
    console.log(`  ${掉红 && 复绿 ? '✓' : '✗'} ${label}：拿掉后 exit=${r.code}（红=${掉红}）· 还原后绿=${复绿}`)
    return 掉红 && 复绿
  } finally {
    writeFileSync(p, 备份)
  }
}

console.log('【RV-V129】逐条靶子（每次只改一处 · 逐次还原）\n')
const 例s = []

// §5 HEAD 自包含（RV 用 --drop 复现原始缺口）
{
  const r = 跑('tests/headSelfContained.test.mjs', ['--drop', 'src/dailyQuests.mjs'])
  const 绿 = 跑('tests/headSelfContained.test.mjs').code === 0
  console.log(`  ${r.code !== 0 && 绿 ? '✓' : '✗'} #5 HEAD 自包含：摘掉 dailyQuests ⇒ exit=${r.code}（应红）· 还原后绿=${绿}`)
  例s.push(r.code !== 0 && 绿)
}

// §1 预检
例s.push(试一例('#1a 登录页不跑预检', 'src/App.jsx',
  '登录预检({ supabaseUrl: SUPABASE_URL, origin:',
  '登录预检({ supabaseUrl: SUPABASE_URL, originX:', 'tests/loginReliability.test.mjs'))

// §3 SW：API 回退缓存（假活着）
例s.push(试一例('#3a sw 对 /rest 回退缓存', 'public/sw.js',
  'if (API_RE.test(pathname)) return',
  'if (false) return', 'tests/swPolicy.test.mjs'))

// §2 错误分级
例s.push(试一例('#2a 400 并回网络错误', 'src/loginReliability.mjs',
  "if (st === 0 || name === 'TypeError'",
  "if (st === 0 || st === 400 || name === 'TypeError'", 'tests/loginReliability.test.mjs'))
例s.push(试一例('#2b 密码 trim 被删（旧行为回退）', 'src/App.jsx',
  'signInWithPassword({ email, password: String(password).trim() })',
  'signInWithPassword({ email, password: String(password) })', 'tests/loginReliability.test.mjs'))

console.log(`\n结果: ${例s.filter(Boolean).length} / ${例s.length} 条 RV 成立`)
process.exit(例s.every(Boolean) ? 0 : 1)
