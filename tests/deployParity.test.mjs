// V115-① 判据（R113-3 正解）：**线上 bundle 必须与本地 dist 逐字节一致**
//   做法：抓入口页 → 找 assets/index-*.js → 取回 → sha256 与本地 dist 同名文件比
//   · 名字不同 ⇒ 红（本地又改了没部署）
//   · 名字相同、字节不同 ⇒ 红（被手改/上传损坏）
//   · 取不到（离线/入口不可达）⇒ 打印 SKIP 并退出 0 —— **不许静默绿**（会明确看到 SKIP）
//   反例 RV：手动改线上包 1 字节 ⇒ 必红。
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const 入口 = ['http://121.196.196.37/', 'https://test.2026911301.xyz/']
const sha = (buf) => createHash('sha256').update(buf).digest('hex')
const 找包 = (html) => {
  const m = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html || '')
  return m ? m[1] : null
}

if (!existsSync('dist/index.html')) { console.error('✗ 请先 npm run build'); process.exit(1) }
const 本html = readFileSync('dist/index.html', 'utf8')
const 本包 = 找包(本html)
if (!本包) { console.error('✗ 本地 dist/index.html 里找不到 assets/index-*.js'); process.exit(1) }
const 本buf = readFileSync('dist/assets/' + 本包)
const 本sha = sha(本buf)

let 线上 = null
for (const u of 入口) {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(8000), redirect: 'follow' })
    if (!r.ok) continue
    const html = await r.text()
    const 包名 = 找包(html)
    if (!包名) continue
    const 基 = u.endsWith('/') ? u : u + '/'
    const r2 = await fetch(基 + 'assets/' + 包名, { signal: AbortSignal.timeout(20000) })
    if (!r2.ok) continue
    const buf = Buffer.from(await r2.arrayBuffer())
    线上 = { 入口: u, 包名, sha: sha(buf), 字节: buf.length }
    break
  } catch (e) { /* 换下一个入口 */ }
}

console.log('══ V115-① 线上 = 本地（bundle sha256）══')
console.log(`  本地：${本包} · ${本buf.length} B · ${本sha}`)

if (!线上) {
  console.log('  SKIP —— 入口不可达（离线/测试机不通）；**不是绿**，部署前必须复跑')
  console.log('结果: 0 通过 / 0 失败（SKIP）')
  process.exit(0)
}

console.log(`  线上：${线上.包名} · ${线上.字节} B · ${线上.sha}  （${线上.入口}）`)

const 名同 = 线上.包名 === 本包
const 字节同 = 线上.sha === 本sha
const 通过 = 名同 && 字节同

if (!名同) console.log(`  ✗ 包名不同 ⇒ 本地改过但**没部署**（本地 ${本包} vs 线上 ${线上.包名}）`)
else if (!字节同) console.log('  ✗ 包名相同但字节不同 ⇒ 线上被手改/上传损坏')
else console.log('  ✓ 逐字节一致（D163 ④ 成立）')

console.log(`结果: ${通过 ? 1 : 0} 通过 / ${通过 ? 0 : 1} 失败`)
process.exit(通过 ? 0 : 1)
