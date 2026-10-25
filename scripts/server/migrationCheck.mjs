// V155 §1 · 迁移检查纯函数层 —— 扫 supabase-migration-*.sql 抽声明、与库内实况比对
// deploy.mjs 第 ⑥ 步调用（checkMigrations）；本模块零 IO（fs 由调用方喂），可在 Node 直接单测。
//
// 三类声明（卡 §1）：
//   add column if not exists <col>  ⇒ 期望列存在（表 = 本文件内最近一个 alter table public.<t> / create table public.<t>）
//   create table if not exists public.<t> ⇒ 期望表存在
//   create policy <p> on <t>        ⇒ 期望策略存在（缺失只告警 —— policy 判级 warn）

/**
 * 扫描单个迁移文件文本 ⇒ 声明列表
 * @returns {Array<{file:string, kind:'column'|'table'|'policy', table:string, name:string, level:'block'|'warn'}>}
 */
export function 扫描声明(file, text) {
  const 声明 = []
  const 剥注释 = String(text)
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .split('\n')
    .map(l => l.replace(/--[^\n]*$/, ''))
    .join('\n')
  let 最近表 = null
  for (const raw of 剥注释.split('\n')) {
    const l = raw.trim()
    const 表命中 = /(?:alter table|create table if not exists|create table)\s+(?:public\.)?([a-zA-Z_][\w]*)/i.exec(l)
    if (表命中 && !/add column/i.test(l)) 最近表 = 表命中[1]
    let m = /add column\s+if not exists\s+([a-zA-Z_][\w]*)/i.exec(l)
    if (m && 最近表) { 声明.push({ file, kind: 'column', table: 最近表, name: m[1], level: 'block' }); continue }
    m = /create table\s+if not exists\s+(?:public\.)?([a-zA-Z_][\w]*)/i.exec(l)
    if (m) { 最近表 = m[1]; 声明.push({ file, kind: 'table', table: m[1], name: m[1], level: 'block' }); continue }
    m = /create policy\s+"?([^"\s]+)"?\s+on\s+(?:public\.)?([a-zA-Z_][\w]*)/i.exec(l)
    if (m) 声明.push({ file, kind: 'policy', table: m[2], name: m[1], level: 'warn' })
  }
  return 声明
}

/**
 * 与库内实况比对
 * @param {Array<声明>} 声明们
 * @param {{columns:Set<string>, tables:Set<string>, policies:Set<string>}} 库实况 （键 = 表名.列名 / 表名 / 表名.策略名）
 * @returns {{applied:number, missing:Array<声明>, warned:Array<声明>}}
 */
export function checkMigrations(声明们, 库实况) {
  const missing = [], warned = []
  let applied = 0
  for (const d of (声明们 || [])) {
    const 键 = `${d.table}.${d.name}`
    const 有 = d.kind === 'column' ? 库实况.columns.has(键)
      : d.kind === 'table' ? 库实况.tables.has(d.table)
      : 库实况.policies.has(键)
    if (有) applied++
    else if (d.level === 'warn') warned.push(d)
    else missing.push(d)
  }
  return { applied, missing, warned }
}

/** 人类可读结论（deploy 打印用） */
export function 结论文本({ applied, missing, warned }, 总数) {
  if (!missing.length && !warned.length) return `迁移 ✓ 已应用 ${applied}/${总数} 项`
  const 行 = []
  if (missing.length) 行.push(`迁移 ✗ 缺失 ${missing.length} 项：` + missing.map(d => `${d.table}.${d.name}（${d.file}）`).join('、'))
  if (warned.length) 行.push(`迁移 ⚠ 策略缺失 ${warned.length} 项（只告警）：` + warned.map(d => `${d.table}.${d.name}`).join('、'))
  return 行.join('\n')
}
