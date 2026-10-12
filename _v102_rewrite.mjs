// V102 T3：把 dist 产物里的线上 Supabase 指向测试机（不改 src，仅改构建产物）
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'dist/assets'
const OLD_URL = 'https://jgytwxaeeezmdbxfsyvs.supabase.co'
const OLD_KEY = 'sb_publishable_bIXR5wi0l43WcRUsa0di0Q_2nVhdsU8'
const NEW_URL = process.env.NEW_URL || 'http://121.196.196.37'
const NEW_KEY = process.env.NEW_KEY
if (!NEW_KEY) { console.error('缺少 NEW_KEY'); process.exit(1) }

const count = (s, sub) => s.split(sub).length - 1
let files = 0, points = 0
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.js')) continue
  const p = join(DIR, f)
  const before = readFileSync(p, 'utf8')
  const c1 = count(before, OLD_URL), c2 = count(before, OLD_KEY)
  let s = before.split(OLD_URL).join(NEW_URL).split(OLD_KEY).join(NEW_KEY)
  if (s !== before) { writeFileSync(p, s); console.log(`  ${f}: url x${c1}, key x${c2}`); files++; points += c1 + c2 }
}
console.log(`替换：文件 ${files} 个 / 替换点 ${points} 个`)
for (const f of readdirSync(DIR)) {
  if (!f.endsWith('.js')) continue
  const s = readFileSync(join(DIR, f), 'utf8')
  if (s.includes('supabase.co')) console.log(`  ⚠ 仍含线上地址: ${f}`)
  if (s.includes(NEW_URL)) console.log(`  ✓ 指向测试机: ${f}`)
}
