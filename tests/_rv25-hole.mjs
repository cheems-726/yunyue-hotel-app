// §25.1 洞复现：§四 第三列 vs longRun126 钉子（自己实核决策端的发现）
import { readFileSync } from 'node:fs'
const R = 'D:/教学app/4-审计与报告/'
const 钉 = {}
{
  const t = readFileSync('D:/教学app/hotel-app/tests/longRun126.test.mjs', 'utf8').replace(/\/\/.*$/gm, '')
  const m = /钉子 = \{([^}]+)\}/.exec(t)
  for (const [, k, v] of m[1].matchAll(/'([^']+)':\s*(\d+)/g)) 钉[k] = Number(v)
}
const 学期 = {}
{
  const t = readFileSync('D:/教学app/hotel-app/tests/semesterRun12.test.mjs', 'utf8').replace(/\/\/.*$/gm, '')
  const m = /钉子 = \{([^}]+)\}/.exec(t)
  for (const [, k, v] of m[1].matchAll(/'([^']+)':\s*(\d+)/g)) 学期[k] = Number(v)
}
const txt = readFileSync(R + '数值平衡与口径总览-20260929.md', 'utf8')
const i = txt.indexOf('学期末资金（12 周 · 教学引用）')
const rows = txt.slice(i, i + 2500).split('\n').filter(l => l.startsWith('| ') && l.includes('型'))
const 名序 = ['1勤奋型', '2省钱型', '3中间型', '4躺平型', '5激进型', '6逆袭型']
console.log('组别        第二列(学期文档)   学期钉值     第三列(18周文档)   长稳钉值     判定')
let 三列错 = 0
rows.forEach((line, idx) => {
  const 名 = 名序[idx]
  const nums = [...line.matchAll(/(\d{1,3}(?:,\d{3}){2,})/g)].map(m => Number(m[1].replace(/,/g, '')))
  const [c2, c3] = nums
  const ok2 = c2 === 学期[名], ok3 = c3 === 钉[名]
  if (!ok3) 三列错++
  console.log(`${名.padEnd(8)} ${String(c2).padEnd(16)} ${String(学期[名]).padEnd(12)} ${String(c3).padEnd(17)} ${String(钉[名]).padEnd(12)} ${ok2 ? '学期✅' : '学期❌'} ${ok3 ? '长稳✅' : '长稳❌'}`)
})
console.log(`\n第三列错 = ${三列错}/6`)
