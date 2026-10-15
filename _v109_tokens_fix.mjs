// V109 · 修 uiTokens 两条回归（D308 抓到）
//   ① 裸 emoji：去掉 🔮 / ✍️ / 🏢（token 政策要求用 Icon 体系）
//   ② fontSize：13 不在白名单（≥16 正文 / 12 标签）⇒ 全部改 12
import { readFileSync, writeFileSync } from 'node:fs'
const f = 'src/SiteSelection.jsx'
let s = readFileSync(f, 'utf8')
const before = s
const 去 = ['🔮 ', '✍️ ', '🏢 ']
for (const e of 去) s = s.split(e).join('')
s = s.split('fontSize: 13').join('fontSize: 12')
s = s.split('fontSize={13}').join('fontSize={12}')
writeFileSync(f, s)
console.log('  去 emoji 命中:', 去.map(e => before.includes(e) ? e : null).filter(Boolean).join(' '))
console.log('  剩余 fontSize: 13 =', (s.match(/fontSize: 13/g) || []).length)
console.log('  文件已更新:', s !== before)
