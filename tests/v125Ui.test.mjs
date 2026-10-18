// V125 · 12 周真跑问题集中维修第一批（界面/口径/接线守门）
// 运行：node tests/v125Ui.test.mjs   （挂 run-all fast）
//
// 本套件钉住 5 条（#4 为现状定性，不做实现假设）：
//   #8/#11 酒店名：云端载荷必须含 hotelName · 登录必须回读 · 命名必须写云+回读 · 失败可见
//   #7    教师端决策数：名称/分母/去重口径必须写在界面上
//   #2    决策入口：首屏必须出现"还有 N 项待做"且能滚到决策区
//   #3    每日关键：= 3 项筛选器（不是每日委托）；全完成时必须给解释文案
//   #6    交互形态登记表：覆盖全部 18 个 id，type 必须在已登记集合内
import { readFileSync } from 'node:fs'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')
const doc = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')

console.log('▶ V125 · 真跑问题维修第一批（#8/#11 · #7 · #2 · #3 · #6 · #4 定性）')

// ── #8/#11 酒店名：写云 + 回读校验（"写进去才算成功"）────────────────────
console.log('\n[#8/#11] 酒店名云端同步（写云 → 回读 → 失败可见）')
{
  const sc = src('supabaseClient.js')
  const app = src('App.jsx')
  const hn = src('HotelNaming.jsx')
  ok(/export async function saveHotelName/.test(sc), 'supabaseClient 提供 saveHotelName（先读档再合并，不覆盖其它字段）')
  ok(/fetchGameState\(userId, groupKey\)/.test(sc.slice(sc.indexOf('export async function saveHotelName'), sc.indexOf('export async function saveGameState'))), 'saveHotelName 先 fetch 当前档再合并（防把其它字段冲掉）')
  ok(/report, hotelName, week, history/.test(app), '★ cloudState 载荷含 hotelName（#11 根因：旧载荷没有它 ⇒ 防抖保存抹掉云名）')
  ok(/setHotelName\(cloudSaved\.hotelName \|\| ''\)/.test(app), '登录恢复必须回填 hotelName（否则云端有名字也照样弹补命名页）')
  ok(/saveHotelName\(user\.uid, name, gk\)/.test(app), '命名确认走 saveHotelName（不是只 setHotelName 等防抖）')
  ok(/回读\?\.hotelName/.test(app) && /!== name/.test(app), '★ 写后必须 GET 回读比对（写进去才算成功）')
  ok(/setHotelName\(''\); set已有酒店名\(\[\]\)/.test(app), '换号/重置清本机酒店名（防上一个账号的名字带进新账号）')
  ok(/set云端恢复中\(true\)/.test(app) && /restoring \|\| 云端恢复中\) return/.test(app), '★ 登录恢复期禁止防抖保存（防 800ms 先到、用空名覆盖云端真名）')
  ok(/r\.ok === false/.test(hn) && /set提交中\(false\)/.test(hn), '命名失败必须停在本页并显示原因（可重复重试 = 可重复补命名）')
  ok(/正在写入云端/.test(hn), '写入过程有可见状态（不是"秒成功但云端没存"）')
}

// ── #7 教师端决策数口径 ────────────────────────────────────────────────
console.log('\n[#7] 教师端决策数：名称 + 分母 + 去重口径')
{
  const td = src('TeacherDashboard.jsx')
  ok(/全班已完成决策/.test(td), '标签改为「全班已完成决策」（不再用模糊的"全班决策数"）')
  ok(/groups\.length \* 18/.test(td), '★ 分母 = 组数 × 18 项（老师能看出 49/108 的进度，不会误读成"才做一半"）')
  ok(/改答案不重复计数/.test(td), '★ 口径说明写明"同一项改答案不重复计数"（≠ 提交次数）')
  ok(/\/ 18 项/.test(td), '人均完成带 /18 分母')
}

// ── #2 决策入口首屏可发现 ──────────────────────────────────────────────
console.log('\n[#2] 决策入口：首屏待做数 + 可点击滚到决策区')
{
  const app = src('App.jsx')
  ok(/本周还有 \$\{18 - doneCount\} 项决策待做/.test(app), '★ 首屏（header 内）显示「本周还有 N 项决策待做」')
  ok(/const 决策区Ref = React\.useRef\(null\)/.test(app), '决策区有锚点 ref')
  ok(/决策区Ref\.current\.scrollIntoView/.test(app), '点击提示/进度行会滚到决策区')
  ok(/<div ref=\{决策区Ref\}/.test(app), '锚点挂在决策列表容器上（不是指向一个空元素）')
  ok(/还有 \$\{18 - doneCount\} 项待做 →/.test(app), '进度行也带待做数（双入口）')
}

// ── #3 每日关键定性（决定 V120 生死）──────────────────────────────────
console.log('\n[#3] 每日关键 = 3 项筛选器（不是每日委托系统）')
{
  const app = src('App.jsx')
  const reg = doc('2-任务包/现行/决策交互形态登记表-V125.md')
  ok(/KEY_DECISIONS = \['pricing', 'shifts', 'reputation'\]/.test(app), "每日关键 = pricing/shifts/reputation 三项（代码单源）")
  ok(/每日关键 3 项（动态调价 \/ 前台排班 \/ 口碑管理）本周已全部完成/.test(app), '★ 三项全完成后筛选结果给解释（不再呈现空白）')
  ok(/筛选器/.test(reg) && /不是每日任务/.test(reg), '登记表写明：它是筛选器，不是每日任务/委托系统（V120 不能假设已实现）')
  ok(/V120/.test(reg), '登记表留下 V120 的裁决依据')
}

// ── #6 交互形态登记表（覆盖 18 项）────────────────────────────────────
console.log('\n[#6] 决策交互形态登记表：18 项全覆盖')
{
  const reg = doc('2-任务包/现行/决策交互形态登记表-V125.md')
  const 已登记类型 = ['option', 'slider', 'budget', 'sort', 'timer']
  const 缺 = decisions.filter(d => !reg.includes('`' + d.id + '`')).map(d => d.id)
  ok(decisions.length === 18, `决策总数 = 18（实得 ${decisions.length}）`)
  ok(缺.length === 0, `登记表覆盖全部 18 个 id（缺 ${缺.length}）`, 缺.join(','))
  const 异型 = decisions.filter(d => !已登记类型.includes(d.type))
  ok(异型.length === 0, '所有 type 都在已登记形态集合内（新增形态必须先登记）', 异型.map(d => d.id + ':' + d.type).join(','))
  ok(/18\/18/.test(reg) && /少于 18/.test(reg), '登记表含收尾断言：必须 18/18，少于 18 要报漏项')
}

// ── #4 「进入下一周」现状定性（不做实现假设）───────────────────────────
console.log('\n[#4] 「进入下一周」：入口在学生端周报（不是教师端）')
{
  const app = src('App.jsx')
  const wr = src('WeeklyReport.jsx')
  const td = src('TeacherDashboard.jsx')
  ok(/function handleNextWeek\(\)/.test(app) && /setWeek\(week \+ 1\)/.test(app), '学生端周报确认 ⇒ week + 1 且清空本周决策')
  ok(/进入第 \$\{result\.week \+ 1\} 周/.test(wr), '周报按钮文案 =「进入第 N+1 周」')
  ok(!/进入下一周/.test(td), '教师端没有「进入下一周」按钮（推进 = 学生周报 + 服务端 tick；V125-#4 的 classDay+7 判据与实现不符，需审计端裁定）')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
