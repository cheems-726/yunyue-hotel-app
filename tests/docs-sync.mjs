// M5 · 文档同步守卫（防"文档滞后 → 误判未做 → 返工"）
//
// 起因：已发生 3 次返工，其中至少 2 次根因是【代码变了、文档没同步】：
//   · 交接文档写"C 第一期 dayEngine 未完成"，实际 src/dayEngine.js 已存在
//   · 《需求要点统合》标 6 项"未完成"，实际全部已做
//
// 本脚本做两件事：
//   ① 【事实对照】逐条验证"关键事实"，比对文档里的说法 —— 不符就报
//   ② 【新鲜度】比较 src/ 与关键文档的 mtime —— 代码比文档新就报
//
// 用法：node tests/docs-sync.mjs          检查并报告（默认）
//       node tests/docs-sync.mjs --json   机器可读输出
// 退出码：0 = 文档与代码一致；1 = 发现不同步（需更新文档）

import fs from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { 数字匹配, 抽数字 } from './_docsSyncCompare.mjs'   // A1 返修①②：数字比对唯一实现点
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP = path.resolve(__dirname, '..')
const ROOT = path.resolve(APP, '..')
const JSON_OUT = process.argv.includes('--json')

const readIf = p => { try { return fs.readFileSync(p, 'utf8') } catch { return null } }
const exists = p => fs.existsSync(p)

// 🔴 W4-6 补覆盖（2026-09-27）：本脚本此前只盯 3 份文档 ⇒ 会话交接卡 / 索引 / 现行目录其余任务包
//    全在监控之外。而"做完即更新交接卡"是 R1 纪律 ⇒ 交接卡落后时门禁照样绿 = **假绿近亲（BL-11 族）**。
//    本处新增两类覆盖：① 新鲜度清单扩容（含"现行"目录全部 .md）② 交接卡与 HEAD 的一致性事实断言。
// A1：取"## <标记>"段的正文（到下一个 --- 或 ## 为止）
function 段(card, mark) {
  const lines = String(card).split(/\r?\n/)
  const i = lines.findIndex(l => new RegExp("^##\\s*" + mark).test(l))
  if (i < 0) return ""
  const rest = lines.slice(i + 1)
  const j = rest.findIndex(l => /^##\s|^---\s*$/.test(l))
  return (j < 0 ? rest : rest.slice(0, j)).join("\n")
}
// A1：读"最近一次门禁记录"（run-all 每次跑自动重写；缺失 = 首次，不判）
function 门禁记录() {
  try { return JSON.parse(readIf(path.join(APP, "tests", "_last-gate.json")) || "{}") } catch { return {} }
}
function gitCount(args) {
  const r = spawnSync("git", args, { cwd: APP, encoding: "utf8", shell: false })
  return r.status === 0 ? Number((r.stdout || "").trim()) : null
}

function gitShortHead() {
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: APP, encoding: 'utf8', shell: false })
    return (r.status === 0 ? (r.stdout || '').trim() : null)
  } catch { return null }
}
// ★ §25.2②（2026-09-29 · D68-e）：未推计数 —— 首选 git 权威解（`rev-list --count origin/main..HEAD`）；
//   git 不可用/超时的环境下**必须仍有答案**，故从 `logs/HEAD`（reflog）尾部回退计数：
//   从 HEAD 往回数 `commit:` 行，**剔除 `reset: moving to HEAD` 之类非提交行**（决策端实读就踩到：15 − 1 = 14）。
function 未推计数() {
  const n = gitCount(['rev-list', '--count', 'origin/main..HEAD'])
  if (n != null && Number.isFinite(n)) return n
  // 回退（git 不可用/超时）：从 reflog 往回数，**数到 origin/main 的提交为止**。
  // ★ 实测踩坑：第一版回退**没有终止条件** ⇒ 把整个 reflog 的历史全数进来（数字巨大 ⇒ 判据永远红）。
  try {
    const head = gitShortHead()
    const log = readIf(path.join(APP, '.git', 'logs', 'HEAD')) || ''
    if (!head || !log) return null
    // origin/main 的哈希：先 refs 文件，再 packed-refs
    let 远端 = (readIf(path.join(APP, '.git', 'refs', 'remotes', 'origin', 'main')) || '').trim()
    if (!远端) {
      const packed = readIf(path.join(APP, '.git', 'packed-refs')) || ''
      const m = /^([0-9a-f]{40})\s+refs\/remotes\/origin\/main$/m.exec(packed)
      远端 = m ? m[1] : ''
    }
    if (!远端) return null
    const 行s = log.split('\n').filter(Boolean).reverse()
    let 数 = 0
    for (const l of 行s) {
      const m = /^([0-9a-f]{40})\s+([0-9a-f]{40})\s+(.*)$/.exec(l)
      if (!m) continue
      if (m[2] === 远端) break                  // ★ 到达 origin/main ⇒ 停止（这才是"未推"的边界）
      if ((m[3].split('\t')[1] || '').startsWith('commit')) 数++
    }
    return 数
  } catch { return null }
}
// ★ §25.2（D68-e）：收尾指纹 —— 四处收尾文件必须写同一对 (HEAD, 未推)，且 === 实读。
//   判据【只认这一个机器可读片段】：`HEAD <hash> · 未推 <N>`（紧邻才算 ⇒ 老段里 "HEAD x · 全量 … · 未推 y" 不会误命中）
function gitOut2(args) {
  const r = spawnSync('git', args, { cwd: APP, encoding: 'utf8', shell: false })
  return r.status === 0
}
function 指纹(文本) {
  // ★ 优先取【语义化指纹行】（`收尾指纹：HEAD … · 未推 …`）—— §28.1 实测教训：
  //   交接卡 ① 段有【决策端写的基线行】（HEAD d8d2808 · 未推 12 · 那是**发布时点**，不是当前值），
  //   取"首个 HEAD 片段"会命中它 ⇒ 判据把"历史基线"当成"当前指纹" ⇒ 永远红。
  //   ⇒ 指纹行必须**显式标注**（收尾文件里写 `★ 收尾指纹：HEAD … · 未推 …`），判据只认它。
  const m = /收尾指纹：HEAD\s*`?([0-9a-f]{7,40})`?\s*·\s*未推\s*\**\s*(\d+)/.exec(文本 || '')
  if (m) return { head: m[1], 未推: Number(m[2]) }
  return null   // 没写指纹行 ⇒ 红（判据不能被"省略/混在别处"绕过 —— 见原注释）
}
// 监控文档清单：三份原有 + 交接卡 + 索引 + 现行目录全部任务包
function monitoredDocs() {
  const list = [
    path.join(ROOT, '1-总纲与进度', '交接文档-新会话必读.md'),
    path.join(ROOT, '1-总纲与进度', '决策登记册.md'),
    path.join(ROOT, '2-任务包', '现行', '总任务包-设计落地与数据补全.md'),
    path.join(ROOT, '4-审计与报告', '会话交接卡.md'),
    path.join(ROOT, '0-从这里开始.md'),
  ]
  const dir = path.join(ROOT, '2-任务包', '现行')
  try {
    for (const f of fs.readdirSync(dir)) if (f.endsWith('.md')) list.push(path.join(dir, f))
  } catch { /* ignore */ }
  return list.filter(exists)
}

function walk(dir, exts, acc = [], depth = 0) {
  if (depth > 6) return acc
  let es = []
  try { es = fs.readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of es) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, exts, acc, depth + 1)
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full)
  }
  return acc
}

function newestMtime(files) {
  let max = 0, which = null
  for (const f of files) {
    try {
      const m = fs.statSync(f).mtimeMs
      if (m > max) { max = m; which = f }
    } catch { /* ignore */ }
  }
  return { mtime: max, file: which }
}

function grepCount(dir, pattern, exts = ['.js', '.jsx', '.mjs']) {
  const files = walk(dir, exts)
  let n = 0
  const re = new RegExp(pattern)
  for (const f of files) {
    const t = readIf(f)
    if (t && re.test(t)) n++
  }
  return n
}

// ── 关键事实对照表 ────────────────────────────────────────────────
// 每条 = 一个"代码里的事实" + "文档里可能的旧说法"
// 维护约定：发现新的"文档与代码不符"案例，就加一条
const FACTS = [
  {
    name: '第一期 dayEngine 已存在',
    actual: () => exists(path.join(APP, 'src', 'dayEngine.js')),
    docSays: '第一期未完成 / C 未完成',
    docs: ['1-总纲与进度/交接文档-新会话必读.md', '1-总纲与进度/项目进度总纲.md'],
  },
  {
    name: '职位体系已上线',
    actual: () => grepCount(path.join(APP, 'src'), 'role_in_group') > 0,
    docSays: '模块五 🔴 0% 未开始',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '教师批注功能已上线',
    actual: () => grepCount(path.join(APP, 'src'), 'saveTeacherNote') > 0,
    docSays: '模块六 ❌ 未做',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '资金扣减与破产判定已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'isBankrupt') > 0,
    docSays: '模块四 未真正扣减资金',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '三类事件（请假/故障/爆单）已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'holidaySurge') > 0,
    docSays: '模块三 缺员工请假/设备故障',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: '承德/重庆数据已录入',
    actual: () => {
      const t = readIf(path.join(APP, 'src', 'siteLocations.mjs')) || ''
      return t.includes('承德') && t.includes('重庆')
    },
    docSays: '模块一 承德/重庆待录入',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    name: 'OTA 模式引擎差异化已实现',
    actual: () => grepCount(path.join(APP, 'src'), 'otaCommissionRate') > 0,
    docSays: '模块二 引擎未区分（两者结算逻辑相同）',
    docs: ['1-总纲与进度/需求要点统合-现状对照.md'],
  },
  {
    // 🔴 Phase D/C2（2026-09-27）：dayEngine 已接进 settlement（周值拆 7 天，零变化）。
    //    本守卫原为"尚未接线"（expect:true），其注释写明"若变 false → 文档要更新" ⇒ 本夜按新事实翻转期望。
    name: 'dayEngine 已接线（Phase D/C2 起 · settlement → simulateWeek）',
    actual: () => {
      const files = walk(path.join(APP, 'src'), ['.js', '.jsx'])
      for (const f of files) {
        if (path.basename(f) === 'dayEngine.js') continue
        const t = readIf(f)
        if (t && /(from|require\()\s*['"].*dayEngine/.test(t)) return true
      }
      return false
    },
    docSays: 'settlement 内部已调用 simulateWeek（Phase D/C2）',
    docs: [],
    expect: true,   // 期望为 true：若变 false，说明接线被回退 → 需说明原因
  },
  {
    // 🔴 W4-6：R1 纪律是"做完即更新交接卡"——此前没有任何守门盯着它（交接卡不在本脚本的监控清单里）。
    //   本事实断言：交接卡的起点校验段必须引到【当前 HEAD 短哈希】⇒ 卡落后于提交即报红。
    name: '会话交接卡已跟上最新提交（起点校验含 HEAD）',
    actual: () => {
      const head = gitShortHead()
      if (!head) return false
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      return !!card && card.includes(head)
    },
    docSays: '会话交接卡 ⑥ 起点校验（应含最新的 commit 短哈希）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    // 🔴 A1 返修①②（BL-13 对策 · 精确比对版）：卡里数字必须能在【最近一次门禁记录】里找到【精确相等者】。
    //   为什么不要容差：百分比容差放过"差 24"的真过期数字（决策端活证 906/1039 vs 930/1063）；
    //   而"本套件自身断言数波动"由 run-all 的【记录写入策略】解决（唯一失败是 docs-sync 时按修好后计数记），
    //   不靠容差掩盖 —— 容差既不唯一也不可解释，故整体删除。
    //   比对实现只有一处：tests/_docsSyncCompare.mjs（返修①验收"容差来源唯一"）。
    name: '会话交接卡 ⑥ 段门禁数字 === 最近一次门禁记录（精确相等）',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      const rec = 门禁记录()
      const 卡数字 = 抽数字(段(card, '⑥'))
      const 档 = []
      if (rec.fast && rec.fast.head) 档.push(rec.fast.通过)
      if (rec.full && rec.full.head) 档.push(rec.full.通过)
      if (!档.length) return true    // 还没有记录（首次跑）⇒ 不判
      return 档.every(值 => 数字匹配(卡数字, 值))
    },
    docSays: '会话交接卡 ⑥（快检/全量数字必须精确等于最近一次门禁记录）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    // ★ §24.1②（2026-09-29 第十二批）：过审包是【决策端过审入口】，而它的门禁数字历来是**手抄**的
    //   （§23.4 实测事故：正文停在「全量 1607/0 · 未推 3」，两个批次没人发现 ⇒ "声明≠实现"）。
    //   判据与交接卡 ⑥ **同源同实现**（`_docsSyncCompare` 是唯一比对点）：精确相等、无容差。
    //   ★ 为什么放本套件而不是 reportCaliber：本套件属 run-all 的【文档类】——
    //     有一红就"按修好后计数记"的【记录写入策略】兜住自指；reportCaliber 不属该类，
    //     它一红会把"门禁计数自身的漂移"搅成自指（每改一条断言都得重写过审包）。见其 [7] 末尾注释。
    name: '全日过审包「门禁数字」行 === 最近一次门禁记录（精确相等）',
    actual: () => {
      const doc = readIf(path.join(ROOT, '4-审计与报告', '全日过审包-20260929.md'))
      if (!doc) return true        // 文件缺失由 reportCaliber 台账死条目断言负责，此处不重复判
      const 行 = /门禁数字\*\*：([^\n]*)/.exec(doc)
      if (!行) return false        // 有文件却没这行 ⇒ 数字无权威可对（§24.1② 硬验收）
      const rec = 门禁记录()
      const 档 = []
      if (rec.fast && rec.fast.head) 档.push(rec.fast.通过)
      if (rec.full && rec.full.head) 档.push(rec.full.通过)
      if (!档.length) return true  // 还没有记录（首次跑）⇒ 不判
      const 数 = 抽数字(行[1])
      return 档.every(值 => 数字匹配(数, 值))
    },
    docSays: '全日过审包（「门禁数字」行须精确等于最近一次门禁记录的快检/全量通过数 · 手抄错一格即红）',
    docs: ['4-审计与报告/全日过审包-20260929.md'],
    expect: true,
  },
  {
    // ★ §25.2（2026-09-29 · D68-e）：**head/未推 也要入判据** —— 起因（决策端实核抓到的第二处）：
    //   §24 收尾文件在 `1adc629` 时写定，之后又提交 `fadaa79` ⇒ 四处仍写 `1adc629` · 未推 13（实为 14），
    //   而上面那条判据**只比通过数**（1657/1517）⇒ **head 与未推在判据眼皮底下漂移**。这是新变体：
    //   「数字对 ≠ 引用它的地方都对」→「计数对 ≠ 版本/待推数也对」。
    //   判据（五条，缺一即红）：四处收尾文件各含**同一对** `HEAD <hash> · 未推 <N>`，
    //   且 head === 最近一次【全量】记录的 head（前缀比）· 且 未推 === 实读（`origin/main..HEAD`）。
    name: '收尾指纹：闸门 / 队列顶部 / 过审包 / 交接卡⑥ 四处 HEAD+未推 逐字一致且 === 实读',
    actual: () => {
      const 处 = [
        ['闸门', readIf(path.join(ROOT, '9-夜间自动化', '夜间开工闸门.txt'))],
        ['队列顶部', (readIf(path.join(ROOT, '9-夜间自动化', 'night-run-log.md')) || '').slice(0, 6000)],
        ['过审包', readIf(path.join(ROOT, '4-审计与报告', '全日过审包-20260929.md'))],
        ['交接卡', readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))],
      ]
      const 读 = 处.map(([名, t]) => [名, 指纹(t)])
      if (读.some(([, f]) => !f)) return false                       // 有人没写指纹 ⇒ 红（判据不能被"省略"绕过）
      const [首名, 首] = 读[0]
      if (读.some(([, f]) => f.head !== 首.head || f.未推 !== 首.未推)) return false   // 四处不一致 ⇒ 红
      const rec = 门禁记录()
      const 记head = rec.full && rec.full.head ? String(rec.full.head) : null
      // ★ §28.1 实测踩坑：判据的语义应是「指纹的 head === 门禁【跑过的那个提交】」，而门禁跑完后
      //   执行端往往还会提交【纯文档】（指纹/数字回刷）⇒ 两个 head 天然差一截 —— 这不是漂移，是
      //   D59 的正常节奏（纯文档不必重跑全量）。⇒ 比对改为祖先关系（merge-base），而不是前缀相等。
      if (记head && 首.head) {
        // ★ §32-U1 修向（D88-d 更正用词 · 只改注释不改逻辑）：这一步是【放宽方向约束】，不是"变严" ——
        //   旧式只认**单向**（指纹 head 必须是记录 head 的祖先）⇒ §28.1 的原始设想方向与真实节奏**正好写反**
        //   （真实节奏是"记录在前、指纹在后"），于是合法节奏被判红。现改为**双向同链**：
        //   互为祖先其一成立即可 ⇒ 放开了方向；仍要求【同链】（分叉 = 真漂移 ⇒ 红）⇒ 强度不变的那半留着。
        const 同链 = gitOut2(['merge-base', '--is-ancestor', 记head, 首.head]) || gitOut2(['merge-base', '--is-ancestor', 首.head, 记head])
        if (!同链) return false
      }
      const 实未推 = 未推计数()
      if (实未推 != null && 实未推 !== 首.未推) return false
      return true
    },
    docSays: '四份收尾文件（各写一行 `HEAD <hash> · 未推 <N>` · 四处逐字一致 · head === 全量记录 head · N === origin/main..HEAD）',
    docs: ['9-夜间自动化/夜间开工闸门.txt', '9-夜间自动化/night-run-log.md', '4-审计与报告/全日过审包-20260929.md', '4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    name: '会话交接卡 ⑥ 段「未推 N」与实际一致',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      const m = /未推\s*(\d+)/.exec(段(card, '⑥'))
      if (!m) return false
      const n = gitCount(['rev-list', '--count', 'origin/main..HEAD'])
      return n != null && Number(m[1]) === n
    },
    docSays: '会话交接卡 ⑥（未推数应等于 git rev-list --count origin/main..HEAD）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
  {
    // ★ §17.1-①（2026-09-28 · D58）建立；★ §18.0（D59）改进：改比 **codeTree**（影响门禁的子树）
    //   起因（决策端实核抓到）：报告称"全量 1501/0"，但 `_last-gate.json` 的 full.head = 131580d
    //   而 HEAD = 4b2e6d1 ⇒ **全量是在上一个提交上跑的**。这是「数字对≠引用它的地方都对」的同族：
    //   **数字对，但要对在正确的版本上**。
    //   ★ D59 改进理由：**文档不改变引擎数字** ⇒ 只提交文档（如 AGENTS.md）不该逼着再跑一轮全量。
    //     ⇒ 比较对象从【整树 tree】改为【codeTree = src/tests/scripts/根配置 的子树摘要】；
    //       `dirty` 仍判死（它是"数字是否来自 HEAD 内容"的唯一判据），但同样只按【代码子树】算。
    //   判据（三条，缺一即红）：
    //     ① 最近一次【全量】记录必须带 codeTree
    //     ② 那次全量必须是在【代码子树干净】时跑的（dirty=false）
    //     ③ 那次全量的 codeTree === 当前 HEAD 的 codeTree
    name: '门禁记录能回答「哪个代码树被 gate 过」（全量 · 代码子树干净 · codeTree === HEAD codeTree）',
    actual: () => {
      const rec = 门禁记录()
      if (!rec.full) return true                      // 还没跑过全量 ⇒ 不判（首次）
      if (!rec.full.codeTree) return false            // ① 缺 codeTree（旧记录 ⇒ 跑一次全量即可刷新）
      if (rec.full.dirty) return false                // ② 代码子树脏
      // ③ 与当前 HEAD 的代码子树比对（与 run-all 里同一套路径与截断规则）
      const CODE_PATHS = ['src', 'tests', 'scripts', 'package.json', 'package-lock.json', 'vite.config.js', 'vite.config.mjs', 'index.html', 'build.mjs', 'supabase']
      const now = CODE_PATHS
        .map(p => { const r = spawnSync('git', ['rev-parse', 'HEAD:' + p], { cwd: APP, encoding: 'utf8', shell: false }); return r.status === 0 ? (r.stdout || '').trim().slice(0, 12) : null })
        .filter(Boolean).join('-')
      return !!now && rec.full.codeTree === now
    },
    docSays: 'tests/_last-gate.json 的 full 档（codeTree === 当前 HEAD 的 codeTree · 且 dirty=false）',
    docs: ['hotel-app（跑一次全量即可刷新记录）'],
    expect: true,
  },
  {
    name: '会话交接卡 ①–⑥ 六段各恰好一次（无重复段）',
    actual: () => {
      const card = readIf(path.join(ROOT, '4-审计与报告', '会话交接卡.md'))
      if (!card) return false
      return ['①','②','③','④','⑤','⑥'].every(mk =>
        (card.match(new RegExp('^##\\s*' + mk, 'gm')) || []).length === 1)
    },
    docSays: '会话交接卡（①–⑥ 各一段；本次实装卡曾出现重复的第三段）',
    docs: ['4-审计与报告/会话交接卡.md'],
    expect: true,
  },
]

// ── 执行 ─────────────────────────────────────────────────────────
const problems = []
const oks = []

for (const f of FACTS) {
  let actual
  try { actual = f.actual() } catch (e) { actual = false }
  const expect = f.expect === undefined ? true : f.expect
  const ok = actual === expect
  if (ok) oks.push(f.name)
  else problems.push({ type: 'fact', name: f.name, actual, expect, docSays: f.docSays, docs: f.docs })
}

// 新鲜度：src/ vs 关键文档
const srcFiles = walk(path.join(APP, 'src'), ['.js', '.jsx', '.mjs'])
const docFiles = monitoredDocs()

const srcNewest = newestMtime(srcFiles)
const docNewest = newestMtime(docFiles)
const stale = srcNewest.mtime > docNewest.mtime

// ── 输出 ─────────────────────────────────────────────────────────
if (JSON_OUT) {
  console.log(JSON.stringify({ oks, problems, stale, srcNewest, docNewest }, null, 2))
} else {
  console.log('')
  console.log('════════════════════════════════════════════════')
  console.log('  M5 · 文档同步守卫')
  console.log('════════════════════════════════════════════════')
  console.log('')
  console.log('【一、关键事实对照】')
  for (const n of oks) console.log('  ✓ ' + n)
  for (const p of problems) {
    console.log('  ✗ ' + p.name)
    console.log('      代码实际：' + p.actual)
    console.log('      文档旧说法：' + p.docSays)
    if (p.docs.length) console.log('      需更新：' + p.docs.join('、'))
  }
  console.log('')
  console.log('【二、文档新鲜度】')
  const fmt = t => new Date(t).toISOString().replace('T', ' ').slice(0, 16)
  console.log('  src/ 最新变更 ：' + fmt(srcNewest.mtime) + '  ' + path.relative(ROOT, srcNewest.file || ''))
  console.log('  文档最新变更  ：' + fmt(docNewest.mtime) + '  ' + path.relative(ROOT, docNewest.file || ''))
  console.log('  ' + (stale ? '⚠️ 代码比文档新 —— 文档可能滞后，需同步' : '✓ 文档不落后于代码'))
  console.log('')
console.log('────────── 结论 ──────────')
if (problems.length === 0 && !stale) {
  console.log('  ✓ 文档与代码一致')
} else {
  console.log('  ⚠️ 发现 ' + problems.length + ' 条事实不符' + (stale ? ' + 文档滞后' : ''))
  console.log('  ⇒ 更新上述文档后重跑本脚本，直到全绿')
}
  console.log('')
}

// 统一尾行格式，便于 run-all 汇总统计
const passN = oks.length + (stale ? 0 : 1)
const failN = problems.length + (stale ? 1 : 0)
console.log(passN + ' 通过 / ' + failN + ' 失败')
console.log('')

process.exit(failN === 0 ? 0 : 1)
