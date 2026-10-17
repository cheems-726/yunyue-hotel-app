// V115-③ 判据：数据入口**禁止手写 select 列清单**（R114-1 第二次栽在同一类）
//   规则：`src/*.js|jsx|mjs` 里 `.select('…')` 的字符串只能是 `*`（或引用共享常量 COLS.…）
//   反例 RV：把任一处改回 `.select('user_id, state')` ⇒ 本套件红。
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const bad = []
let 检查数 = 0
const ok = (cond, msg) => { 检查数++; if (!cond) bad.push(msg) }

const 文件 = readdirSync('src').filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
let 命中 = 0
for (const f of 文件) {
  const s = readFileSync(join('src', f), 'utf8')
  // 剥掉注释，避免注释里的示例误判
  const 净 = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const m of 净.matchAll(/\.select\(\s*(['"])([^'"]*)\1\s*\)/g)) {
    命中++
    const cols = m[2].trim()
    const 合规 = cols === '*' || /^COLS\./.test(cols)
    ok(合规, `${f}: .select('${cols.slice(0, 40)}') —— 必须用 '*' 或 COLS 常量（禁止手写列清单）`)
  }
}

// 数据入口必须真的存在（防止"全删了也算绿"）
{
  const sc = readFileSync('src/supabaseClient.js', 'utf8')
  ok(/export async function fetchAllGameStates/.test(sc), '数据入口 fetchAllGameStates 仍存在')
  ok(/export async function fetchAllProfiles/.test(sc), '数据入口 fetchAllProfiles 仍存在')
}

console.log('══ V115-③ 禁止手写 select 列清单 ══')
console.log(`  扫描 ${文件.length} 个模块 · 发现 ${命中} 处 .select(...)`)
for (const b of bad.slice(0, 8)) console.log('  ✗ ' + b)
console.log(`结果: ${检查数 - bad.length} 通过 / ${bad.length} 失败`)
process.exit(bad.length === 0 ? 0 : 1)
