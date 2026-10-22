// 部署前把同源改写后的入口包**改名**（内容已变但原名不变 ⇒ 客户端 immutable 缓存 + SW 永远拿旧包）
// 做法：index-XXXX.js → index-XXXX-<内容短哈希>.js，并同步 index.html 引用
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const htmlPath = join(DIST, 'index.html')
let html = readFileSync(htmlPath, 'utf8')
const m = html.match(/assets\/(index-[A-Za-z0-9_-]+)\.js/)
if (!m) { console.error('未找到入口包'); process.exit(1) }

const oldName = `${m[1]}.js`
const p = join(DIST, 'assets', oldName)
const buf = readFileSync(p)
const h = createHash('sha256').update(buf).digest('hex').slice(0, 8)
const base = m[1]
// 已有后缀则替换，没有则追加
const newBase = /-[0-9a-f]{8}$/.test(base) ? base.replace(/-[0-9a-f]{8}$/, `-${h}`) : `${base}-${h}`
const newName = `${newBase}.js`

if (oldName === newName) { console.log('已是最新命名:', newName); process.exit(0) }
if (existsSync(join(DIST, 'assets', newName))) { console.log('目标已存在:', newName); process.exit(0) }

renameSync(p, join(DIST, 'assets', newName))
html = html.replaceAll(`assets/${oldName}`, `assets/${newName}`)
writeFileSync(htmlPath, html, 'utf8')

// 回读断言
const back = readFileSync(htmlPath, 'utf8')
if (!back.includes(`assets/${newName}`) || back.includes(`assets/${oldName}`)) {
  console.error('✗ 回读不一致'); process.exit(1)
}
console.log(`✓ 入口包改名为 ${newName}（内容 sha256 前 8 位）· index.html 已更新`)
