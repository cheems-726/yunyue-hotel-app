#!/usr/bin/env node
// V138 §1.1 · 云悦部署四步（把 2026-10-22「指错后端」事故的手工修法固化成流程）
//
//   ① build          npm run build（exit≠0 即中止）
//   ② 同源改写       MODE=origin NEW_KEY=<anon> node _v102_rewrite.mjs（内置回读断言）
//   ③ 入口包改名     node _v137_rename_entry.mjs（内容变了但文件名不变 ⇒ immutable/SW 永远拿旧包）
//   ④ 上传 + 校验    tar → scp → 解包 → 逐字节 sha256 → 旧云端地址残留必须 0
//
// 用法：
//   NEW_KEY=<anon key> node scripts/server/deploy.mjs              # 四步全跑（真部署）
//   NEW_KEY=<anon key> node scripts/server/deploy.mjs --build-only # 只跑 ①②③（复现线上构建/本地自检）
//   --skip-build                                                   # 跳过 ①（dist 已是目标构建）
//
// 环境变量：
//   NEW_KEY / YUNYUE_ANON_KEY   匿名 key（必填；不落在仓库里）
//   YUNYUE_HOST                 默认 121.196.196.37
//   YUNYUE_SSH_KEY              默认 <repo>/_ssh/aliyun-ecs-yunyue
//   YUNYUE_WEB_DIR              默认 /var/www/html
//
// 红线（V138）：任何一步失败 ⇒ 非 0 退出；成功必须打印「入口包名 / 云端残留 0 / sha256 一致」三行。
import { execSync, spawnSync } from 'node:child_process'
import { 扫描声明, checkMigrations, 结论文本 } from './migrationCheck.mjs'   // ★ V155 §1：第⑥步迁移检查（纯层）
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOST = process.env.YUNYUE_HOST || '121.196.196.37'
const KEY = process.env.YUNYUE_SSH_KEY || (existsSync(join(APP, '_ssh', 'aliyun-ecs-yunyue')) ? join(APP, '_ssh', 'aliyun-ecs-yunyue') : join(APP, '..', '_ssh', 'aliyun-ecs-yunyue'))
const WEB = process.env.YUNYUE_WEB_DIR || '/var/www/html'
const ANON = process.env.NEW_KEY || process.env.YUNYUE_ANON_KEY || ''
const BUILD_ONLY = process.argv.includes('--build-only') || process.env.DEPLOY_BUILD_ONLY === '1'
const SKIP_BUILD = process.argv.includes('--skip-build')
const OLD_HOST = 'jgytwxaeeezmdbxfsyvs'

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
function die(msg) { console.error('✗ ' + msg); process.exit(1) }
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: APP, encoding: 'utf8', shell: false, windowsHide: true, ...opts })
  if (r.error) die(`${cmd} 执行失败：${r.error.message}`)
  if (r.status !== 0) die(`${cmd} ${args.join(' ')} 退出码 ${r.status}\n${(r.stderr || r.stdout || '').slice(0, 800)}`)
  return (r.stdout || '').trim()
}
function step(n, name) { console.log(`\n▶ ${n} ${name}`) }

// ── ① build ─────────────────────────────────────────────────────────────
if (!SKIP_BUILD) {
  step('①', 'build（npm run build）')
  // Windows 下 spawnSync('npm') 找不到 npm.cmd（ENOENT）⇒ 直接调 Vite 入口，跨平台一致
  run(process.execPath, [join(APP, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { stdio: 'inherit' })
  if (!existsSync(join(APP, 'dist', 'index.html'))) die('build 后没有 dist/index.html')
} else {
  step('①', 'build（--skip-build 跳过）')
}

// ── ② 同源改写 ──────────────────────────────────────────────────────────
step('②', '同源改写（MODE=origin）')
if (!ANON) die('缺少 NEW_KEY / YUNYUE_ANON_KEY（anon key）')
run(process.execPath, ['_v102_rewrite.mjs'], { env: { ...process.env, MODE: 'origin', NEW_KEY: ANON } })
// 回读断言（与脚本内置断言的第二道保险）：旧云端地址必须归零
{
  let left = 0
  for (const f of readdirSync(join(APP, 'dist', 'assets')).filter(f => f.endsWith('.js'))) {
    left += readFileSync(join(APP, 'dist', 'assets', f), 'utf8').split(OLD_HOST).length - 1
  }
  if (left !== 0) die(`同源改写后旧云端地址仍残留 ${left} 处`)
  console.log('✓ 回读：旧云端地址 0 处')
}

// ── ③ 入口包改名 ────────────────────────────────────────────────────────
step('③', '入口包改名（内容 hash 后缀）')
run(process.execPath, ['_v137_rename_entry.mjs'])
const html = readFileSync(join(APP, 'dist', 'index.html'), 'utf8')
const m = /assets\/(index-[A-Za-z0-9_-]+\.js)/.exec(html)
if (!m) die('dist/index.html 里找不到入口包')
const entry = m[1]
const buf = readFileSync(join(APP, 'dist', 'assets', entry))
const sha = sha256(buf)
if (!/-[0-9a-f]{8}\.js$/.test(entry)) die(`入口包没有内容 hash 后缀：${entry}`)
console.log(`✓ 入口包：${entry}（${buf.length} B · ${sha.slice(0, 12)}…）`)

// ── ④ 上传 + 校验（--build-only 到此为止）────────────────────────────────
if (BUILD_ONLY) {
  console.log('\n▶ ④ 上传 + 校验（--build-only：未上传）')
  console.log(`✓ 入口包：${entry}`)
  console.log('✓ 云端残留：本地 0（未上传，线上未变更）')
  console.log(`✓ sha256：本地 ${sha.slice(0, 12)}…（--build-only 不比对线上）`)
  process.exit(0)
}

step('④', '上传 + 校验')
if (!existsSync(KEY)) die(`SSH 私钥不存在：${KEY}（用 YUNYUE_SSH_KEY 指定）`)
// 用相对路径打包：Windows 的 GNU tar 会把 `C:` 当远程主机（Cannot connect to C:）
const tgz = join(APP, '_deploy.tmp.tgz')
try {
  run('tar', ['-czf', '_deploy.tmp.tgz', '-C', 'dist', '.'])
  run('scp', ['-i', KEY, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', tgz, `root@${HOST}:/tmp/yunyue-deploy.tgz`])
  run('ssh', ['-i', KEY, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', `root@${HOST}`,
    `set -e; mkdir -p ${WEB}; tar -xzf /tmp/yunyue-deploy.tgz -C ${WEB}; rm -f /tmp/yunyue-deploy.tgz`])
  // ★ V154 批4 ③：旧包清理接进部署（第 ④ 步解包后跑 prune-assets，assets 只留在用 + 最近两批）
  run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
    `bash /opt/yunyue/scripts/prune-assets.sh 2>&1 | tail -3 || echo '（prune-assets 跳过：脚本未装）'`], { stdio: 'inherit' })

  const 远端sha = run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
    `sha256sum ${WEB}/assets/${entry} | awk '{print $1}'`])
  const 残留 = run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
    `grep -h -c '${OLD_HOST}' ${WEB}/assets/index-*.js 2>/dev/null | awk '{s+=$1} END{print s+0}'`])
  const 引用 = run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
    `grep -c 'assets/${entry}' ${WEB}/index.html`])

  if (远端sha !== sha) die(`sha256 不一致：本地 ${sha} · 线上 ${远端sha}`)
  if (String(残留) !== '0') die(`旧云端地址线上残留 ${残留} 处 ⇒ 学生登录会指错后端`)
  if (Number(引用) < 1) die(`线上 index.html 未引用新入口包 ${entry}`)

  // ★ V145 §2：第 ⑤ 步登录自检（红 ⇒ 部署失败，不许“部署成功但登录坏”）
  step('⑤', '登录自检 5/5（/opt/yunyue/scripts/loginSelfCheck.mjs）')
  run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`, 'node /opt/yunyue/scripts/loginSelfCheck.mjs'], { stdio: 'inherit' })

  // ★ V155 §1：第 ⑥ 步迁移检查 —— 扫 supabase-migration-*.sql 声明 ⇒ 查库 ⇒ 缺失即部署非 0 退出
  //   （D344：v152-continue.sql 随卡提交但列没建 ⇒ 续营开关静默走退化分支，测试全绿 = "绿着的坏"）
  step('⑥', '迁移检查（supabase-migration-*.sql ⇒ information_schema）')
  const MIG_ALLOW = process.env.MIGRATIONS_ALLOW_MISSING === '1'
  const 声明们 = (() => {
    const 迁移文件 = readdirSync(APP).filter(f => /^supabase-migration-.*\.sql$/.test(f)).sort()
    return 迁移文件.flatMap(f => 扫描声明(f, readFileSync(join(APP, f), 'utf8')))
  })()
  const 实况 = (() => {
    const sql = [
      "select 'col|'||table_name||'.'||column_name from information_schema.columns where table_schema='public'",
      "select 'tab|'||tablename from pg_tables where schemaname='public'",
      "select 'pol|'||schemaname||'.'||polname from pg_catalog.pg_policies where schemaname='public'",
    ].join(' union all ')
    const out = run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
      `sudo -u postgres psql -d yunyue -Atc "${sql}"`])
    const sets = { columns: new Set(), tables: new Set(), policies: new Set() }
    for (const l of String(out).split('\n')) {
      const [k, v] = l.trim().split('|')
      if (!v) continue
      if (k === 'col') sets.columns.add(v)
      else if (k === 'tab') sets.tables.add(v)
      else if (k === 'pol') sets.policies.add(v)
    }
    return sets
  })()
  const 结论 = checkMigrations(声明们, 实况)
  console.log('  ' + 结论文本(结论, 声明们.length).split('\n').join('\n  '))
  if (结论.missing.length && !MIG_ALLOW) {
    die(`迁移未应用（先在库上执行对应 .sql，或 MIGRATIONS_ALLOW_MISSING=1 紧急放行）`)
  }
  const 迁移注 = `${结论.applied}/${声明们.length} 已应用${结论.missing.length ? '（缺失 ' + 结论.missing.length + ' · 放行）' : ''}`
  // ★ V154 批4 ②：VERSIONS.md 台账（包名/sha256/时间/来源 · 服务器侧追加，verify-versions.sh 可核对）
  const 来源 = execSync('git rev-parse --short HEAD', { cwd: APP, encoding: 'utf8' }).trim()
  const 时间 = new Date().toISOString().replace('T', ' ').slice(0, 16)
  run('ssh', ['-i', KEY, '-o', 'BatchMode=yes', `root@${HOST}`,
    `printf '%s | frontend | ${WEB}/assets/${entry} | ${sha} | 来源 ${来源} | 迁移 ${迁移注} | DSH\n' >> /opt/yunyue/VERSIONS.md; tail -1 /opt/yunyue/VERSIONS.md`])

  console.log(`✓ 入口包：${entry}`)
  console.log('✓ 云端残留：0')
  console.log(`✓ sha256：线上=本地（${sha.slice(0, 12)}…）`)
  console.log('✓ 登录自检：5/5')
  console.log(`✓ 迁移：${迁移注}`)
  console.log(`✓ VERSIONS.md 已登记（${时间} · 来源 ${来源}）`)
} finally {
  try { rmSync(tgz, { force: true }) } catch { /* 静默理由：临时包清理失败不影响部署结论 */ }
}
