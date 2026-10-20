// V130 §2 · 服务器九项只读巡检（run-all 入口）
//   做法：把 scripts/server/opscheck.sh 经 ssh 送到测试机，在服务器上以 --local 跑一遍，
//         回读九项结论 + 标准尾行。**同一份脚本**既能在服务器上直接跑，也能被本入口驱动。
//   · 连不上（无密钥 / 无网 / 机器不通）⇒ 打印 SKIP 并 exit 0 —— **SKIP 必须打印，不许静默绿**
//   · 连上了但某项 ✗ ⇒ exit 1（红）
//   · 本入口自身不写任何文件、不改服务器任何状态（脚本本身是只读契约）
// 用法：node tests/opscheck.test.mjs
// 环境变量：YUNYUE_SSH_KEY（私钥路径）· YUNYUE_HOST · YUNYUE_DOMAIN
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = path.join(ROOT, 'scripts', 'server', 'opscheck.sh')
const HOST = process.env.YUNYUE_HOST || '121.196.196.37'

const 候选密钥 = [
  process.env.YUNYUE_SSH_KEY,
  path.join(ROOT, '..', '_ssh', 'aliyun-ecs-yunyue'),
  path.join(homedir(), '.ssh', 'aliyun-ecs-yunyue'),
].filter(Boolean)
const KEY = 候选密钥.find((p) => existsSync(p))

console.log('══ V130 · 服务器九项只读巡检（scripts/server/opscheck.sh）══')

if (!existsSync(SCRIPT)) {
  console.log(`✗ 找不到巡检脚本：${SCRIPT}`)
  console.log('结果: 0 通过 / 1 失败')
  process.exit(1)
}
if (!KEY) {
  console.log('  SKIP —— 本机没有 SSH 私钥（YUNYUE_SSH_KEY / _ssh/aliyun-ecs-yunyue 都不存在）；**不是绿**')
  console.log('结果: 0 通过 / 0 失败（SKIP）')
  process.exit(0)
}

// Windows 检出是 CRLF ⇒ 送入服务器前统一成 LF（否则 bash 报 $'\r': command not found）
const 脚本 = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n')
const args = [
  '-i', KEY,
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=10',
  '-o', 'StrictHostKeyChecking=accept-new',
  `root@${HOST}`,
  'bash -s -- --local',
]
const t0 = Date.now()
const r = spawnSync('ssh', args, { input: 脚本, encoding: 'utf8', timeout: 180000, windowsHide: true })
const out = (r.stdout || '') + (r.stderr || '')
const secs = ((Date.now() - t0) / 1000).toFixed(1)

// ssh 自身失败（255）= 连不上 ⇒ SKIP（不是绿，部署/上机前必须复跑）
if (r.error || r.status === 255) {
  const why = r.error ? r.error.message : String(out).split('\n').filter(Boolean).slice(-1)[0]
  console.log(`  SKIP —— SSH 连不上 ${HOST}（${why || '未知原因'}）；**不是绿**，上机前必须复跑`)
  console.log('结果: 0 通过 / 0 失败（SKIP）')
  process.exit(0)
}

const 尾行 = /结果:\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/.exec(out)
process.stdout.write(out.endsWith('\n') ? out : out + '\n')
if (!尾行) {
  console.log('✗ 巡检脚本没有输出标准尾行「结果: N 通过 / M 失败」⇒ 按失败计（不许静默绿）')
  console.log(`结果: 0 通过 / 1 失败`)
  process.exit(1)
}
const pass = Number(尾行[1])
const fail = Number(尾行[2])
console.log(`  （耗时 ${secs}s · 主机 ${HOST}）`)
process.exit(fail === 0 && r.status === 0 ? 0 : 1)
