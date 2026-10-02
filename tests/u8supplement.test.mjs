// §32-U8-补 · 界面接线守门（主菜：老师端弹窗代价行 + 注入面板 + 事件卡/离线标注 + 领班授权与复盘）
//
// 判据（每条都对着"用户看得见的行为"，不做恒真断言）：
//   §1 老师端「学生决策动向」弹窗 = 学生选择 + 【代价】（调 decisionRisk.代价文案 单源 · 不许自拼）
//   §2① 教师端注入面板存在且真调单源（构建/校验）· 周粒度说明在面板里（不承诺"第 D 天"）
//   §2② 学生侧：注入通道拉取 + 进 preview/doSettle（同源）· 30 秒应对卡（选项单源）· E8 应对真生效
//   §2③ 离线补算标注（补算 且 无应对 ⇒ 事件对象带 离线标注 === teacherEvents 单源文案）
//   §2④ AI 领班：不再是死代码（有调用方）· 默认全关 · 授权后出记录 · 领班记录进 operatorLog
//   通道与迁移：fetchClassState 回退路径 · 迁移 SQL 幂等 · Edge/serverTick 传注入
// 运行：node tests/u8supplement.test.mjs   （挂 run-all fast）
import { settle } from '../src/settlement.js'
import { 注入事件库, 构建注入事件, 校验注入合法性, 离线默认标注, 应对选项Of, 应对可执行Of } from '../src/teacherEvents.mjs'
import { 生效授权, 领班决策, 默认授权, 代管率 } from '../src/aiSupervisor.mjs'
import { 代价文案 } from '../src/decisionRisk.mjs'
import { settleInputsFrom } from '../src/weekInputs.mjs'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rd = (p) => { try { return readFileSync(path.join(APP, p), 'utf8') } catch (e) { return '' } }
const 剥注释 = (t) => t.split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }

const TD = 剥注释(rd('src/TeacherDashboard.jsx'))
const APPJSX = 剥注释(rd('src/App.jsx'))
const WR = 剥注释(rd('src/WeeklyReport.jsx'))
const SUPA = 剥注释(rd('src/supabaseClient.js'))
const STICK = 剥注释(rd('src/serverTick.mjs'))
const EDGE = rd('supabase/functions/advance-day/index.ts')
const EDGEDB = rd('supabase/functions/advance-day/db.ts')

console.log('▶ §32-U8-补 · 界面接线守门')

console.log('\n[1] ★★ 主菜：老师端弹窗【代价行】—— 单源、与决策面板逐字一致、未登记不显示')
{
  ok(/import \{ 代价文案 \} from '\.\/decisionRisk\.mjs'/.test(TD), '教师在 TeacherDashboard import 的是【单源】代价文案（decisionRisk.mjs）')
  // 弹窗渲染：chipDetail.decisionId && 代价文案(chipDetail.decisionId, chipDetail.rawAnswer)
  ok(/代价文案\(chipDetail\.decisionId,\s*chipDetail\.rawAnswer\)/.test(TD), '弹窗渲染调 代价文案(chipDetail.decisionId, chipDetail.rawAnswer)')
  // 构造处带全量入参（decisionId + rawAnswer）—— 只带 answer(短文案) 的话解析器拿不到原值
  ok(/setChipDetail\(\{[^}]*decisionId:\s*id[^}]*rawAnswer:\s*val/.test(TD), 'chipDetail 构造带 decisionId + rawAnswer（全量入参）')
  // ★ 同源判据：本文件【不许出现】'代价：' 字面量 —— 文案只能来自单源（自己拼会与决策面板漂移）
  ok(!/代价：/.test(TD), '★ 同源：TeacherDashboard 无「代价：」字面量（文案只能来自单源，不许自拼）')
  // 逐字一致（同函数同入参 ⇒ 相等）：抽样真决策
  const a = 代价文案('pricing', '跟降 10%')
  ok(typeof a === 'string' && a.startsWith('代价：'), `与决策面板同源（抽样 pricing/跟降 10% ⇒ ${a}）`)
  ok(代价文案('pricing', '__未登记的选项__') === null, '★ 未登记的选项 ⇒ null（弹窗条件渲染 ⇒ 不显示空行/不报错）')
  ok(代价文案('__不存在的决策__', 'x') === null, '未登记的决策 id ⇒ null（不崩）')
  // 条件渲染结构（没这个 && ⇒ 未登记也渲染一行 null 的空盒子）
  ok(/chipDetail\.decisionId && 代价文案\(chipDetail\.decisionId/.test(TD), '弹窗为【条件渲染】（未登记 ⇒ 整行不出现）')
}

console.log('\n[2] §2① 教师端注入面板：真调单源 + 周粒度说明 + 只影响未来当场拦')
{
  ok(/import \{ 注入事件库, 构建注入事件, 校验注入合法性 \} from '\.\/teacherEvents\.mjs'/.test(TD), '注入面板 import 注入事件库/构建注入事件/校验注入合法性（单源）')
  ok(/setClassInjections/.test(TD) && /fetchClassState/.test(TD), '面板写通道 setClassInjections / 读通道 fetchClassState')
  ok(/校验注入合法性\(\{\s*注入周:\s*周n,\s*已结算周:/.test(TD), '★ 注入前逐组调 校验注入合法性({注入周, 已结算周})（不合法当场拦，不等结算）')
  ok(/一期只到「周」粒度/.test(rd('src/TeacherDashboard.jsx')) && /不承诺「第 D 天」/.test(rd('src/TeacherDashboard.jsx')), '★ 面板写明一期只到「周」粒度（不许承诺「第 D 天」）')
  ok(/disabled=\{忙 \|\| !全部合法 \|\| !通道就绪\}/.test(TD), '注入按钮在校验不通过时禁用（公平红线机器化）')
  // ★ 死代码判据（RV-3 实测补上）：面板必须真的挂在【视图 + 入口】上 —— 只查 import/内部实现的话，
  //   "把渲染整块摘掉"照样绿（面板变死代码却无人报警 = 本项目老病的同族）。
  ok(/\{view === 'inject' && <InjectionPanel/.test(TD), '★ 注入面板真的挂在视图上（view=inject 渲染 —— 不是死代码）')
  ok(/\{view === 'supervisor' && <SupervisorPanel/.test(TD), '★ 领班授权页真的挂在视图上（view=supervisor 渲染 —— 不是死代码）')
  ok(/v: 'inject', icon: '📌'/.test(TD) && /v: 'supervisor', icon: '🤖'/.test(TD), '「我的」功能入口含注入/领班两条（老师找得到）')
  // 行为：非法注入被拦
  ok(校验注入合法性({ 注入周: 2, 已结算周: 4 }).合法 === false, '★ 行为：注入周(2) ≤ 已结算周(4) ⇒ 非法（拦）')
}

console.log('\n[3] §2② 学生侧接线：注入通道进 preview/doSettle（同源）+ 30 秒应对卡（选项单源）')
{
  ok(/import \{ 应对选项Of, 应对可执行Of \} from '\.\/teacherEvents\.mjs'/.test(APPJSX), 'App import 应对选项Of/应对可执行Of（选项单源）')
  ok(/fetchClassState/.test(APPJSX) && /setClassInj/.test(APPJSX), 'App 拉取全班通道（fetchClassState ⇒ setClassInj）')
  ok(/const 本周注入 = \(Array\.isArray\(classInj\)/.test(APPJSX), '本周注入 = 通道 ∩ week 匹配 ∩ 目标匹配（targets=null ⇒ 全班）')
  // 同源：preview 与 doSettle 都必须吃注入 + 补算（否则面板/结算两套口径）
  const preview块 = APPJSX.slice(APPJSX.indexOf('const weekPreview = useMemo'), APPJSX.indexOf('function doSettle'))
  ok(/injectedEvents: 本周注入, eventResponses: 输入\.注入应对, 补算,/.test(preview块), '★ weekPreview 传 injectedEvents/eventResponses/补算（面板与结算同源）')
  const settle块 = APPJSX.slice(APPJSX.indexOf('result = settleWeekSegmented'))
  ok(/injectedEvents: 本周注入用, eventResponses: 输入\.注入应对, 补算 \}\)/.test(settle块.slice(0, 1200)), '★ doSettle 传 injectedEvents/eventResponses/补算（结算真消费）')
  ok(/eventResponse: 读事件应对\(\)/.test(APPJSX), 'settleInputsFrom 吃 eventResponse（唯一派生点）')
  // 应对卡：选项来自单源（App 里不许出现事件选项字面量）
  ok(!/'立即整改'/.test(APPJSX), '★ App 无「立即整改」字面量（E8 选项 label 只能来自 teacherEvents 单源）')
  ok(/localStorage\.setItem\('hotel-sim-event-response'/.test(APPJSX), '应对写 localStorage hotel-sim-event-response（当周选、当周用）')
  ok(/!report && 本周注入\.length > 0 && <InjectedEventsCard/.test(APPJSX), '经营页条件渲染应对卡（无注入 ⇒ 零渲染 = 水位线）')
  // 选项数据完整性（8 条 × ≥2 项）+ 应对可执行只有 E8
  const 全齐 = 注入事件库.every(e => Array.isArray(e.应对选项) && e.应对选项.length >= 2 && e.应对选项.every(o => o.label))
  ok(全齐, `8 事件全带结构化应对选项（≥2 项/条 · ${注入事件库.map(e => e.应对选项.length).join('/')}）`)
  ok(应对可执行Of('E8') === true && 注入事件库.filter(e => e.应对可执行).length === 1, '★ 唯一「应对有数值分支」的事件 = E8（其余一期=记录/讨论 · 明示，不假承诺）')
  // E8 的 label 与引擎比较值逐字一致（跨模块耦合的守门）
  ok(应对选项Of('E8').some(o => o.label === '立即整改'), '★ E8 选项含 label 恰为「立即整改」（与 settle 的比较值逐字一致）')
  // 单源派生：当周选、当周用（与危机通道的"上周选"不同 —— 别混）
  const 输入1 = settleInputsFrom({ reviews: [], week: 3, eventResponse: { week: 3, 事件id: 'E8', choice: '立即整改' } })
  ok(输入1.注入应对 && 输入1.注入应对.E8 === '立即整改', 'settleInputsFrom：注入应对 = {事件id: choice}（week 匹配才派生）')
  const 输入2 = settleInputsFrom({ reviews: [], week: 4, eventResponse: { week: 3, 事件id: 'E8', choice: '立即整改' } })
  ok(!输入2.注入应对, '周号不符 ⇒ 不派生（不猜）')
}

console.log('\n[4] §2②③ 引擎侧：E8 应对真生效 + 离线补算标注（唯一文案生成点）')
{
  const 品牌 = { name: '全季', price: '280-400元', standard: '客房80间起', level: '中档' }
  const 场 = { 客流: 4, 房价: 3, 租金: 3, 竞争: 3, 人力: 3, 波动: 3 }
  const 决策 = { pricing: '不跟降' }
  const 属性 = { quality: 60, reputation: 70, morale: 65 }
  const E1 = 构建注入事件({ 事件id: 'E1', 周: 3, injectedBy: 'T001' })
  const E8 = 构建注入事件({ 事件id: 'E8', 周: 3, injectedBy: 'T001' })
  // E8：应对真改数值（800 / 5000+停业），不靠文案（"声明了没发生"的正面反例）
  const r整改 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E8], eventResponses: { E8: '立即整改' } })
  const r侥幸 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E8] })
  ok(r整改.eventFine === 800 && r侥幸.eventFine === 5000, `★ E8 应对真进结算：整改 800 / 未应对 5000（罚款差 ${r侥幸.eventFine - r整改.eventFine} 元）`)
  ok(r整改.occupancy > r侥幸.occupancy, `未应对多付停业：出租率 ${r侥幸.occupancy}% < 整改 ${r整改.occupancy}%`)
  // 离线标注：补算 + 无应对 ⇒ 单源文案；有应对 ⇒ 不加键
  const r补算 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E1], 补算: true })
  const 卡补 = r补算.events.find(e => e.来源 === 'teacher')
  ok(卡补 && 卡补.离线标注 === 离线默认标注('全市暴雨（周末）', 3), `★ 补算 ⇒ 离线标注 === teacherEvents 单源文案（${卡补 && 卡补.离线标注}）`)
  const r在线 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E1] })
  const 卡在线 = r在线.events.find(e => e.来源 === 'teacher')
  ok(卡在线 && !('离线标注' in 卡在线), '非补算 ⇒ 无 离线标注 键（条件挂载 · 水位线）')
  const r补算有应对 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: [E1], 补算: true, eventResponses: { E1: '不动' } })
  const 卡应 = r补算有应对.events.find(e => e.来源 === 'teacher')
  ok(!('离线标注' in 卡应) && 卡应.你的应对 === '不动', '补算但已应对 ⇒ 不标"未应对"，显示「你的应对」（不误伤）')
  // 来源标识 + 注入人（学生周报显著区分 + 留痕）
  ok(卡在线.来源 === 'teacher' && String(卡在线.text).includes('T001'), '事件卡带 来源:teacher + 注入人（周报可显著区分/留痕）')
  // 缺省零变化：不传新入参 ⇒ 与旧调用（null/false）逐字节一致
  const 基线 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 } })
  const 缺省 = settle({ site: 场, brand: 品牌, decisions: 决策, week: 3, attrs: { ...属性 }, injectedEvents: null, eventResponses: null, 补算: false })
  ok(JSON.stringify(基线) === JSON.stringify(缺省), '★ 水位线：新入参缺省 ⇒ 结果与改前逐字节一致')
  // 周报渲染接线
  ok(/e\.来源 === 'teacher'/.test(WR) && /老师注入/.test(WR), 'Student 周报：来源标识「老师注入」渲染接线')
  ok(/e\.离线标注/.test(WR), '周报渲染 离线标注（显著红条）')
}

console.log('\n[5] §2④ AI 领班：不再死代码（有调用方）· 默认全关 · 授权后出记录')
{
  ok(/import \{ 生效授权, 领班决策, 代管率 \} from '\.\/aiSupervisor\.mjs'/.test(APPJSX), '★ App 引用 aiSupervisor（生效授权/领班决策/代管率）—— 不再零调用方（死代码修复）')
  ok(/supervisorRecord/.test(APPJSX), 'App 结算后生成 result.supervisorRecord（随 history 持久化 ⇒ 复盘可见）')
  ok(/operatorName: '🤖 AI 领班'/.test(APPJSX), '代管/建议逐条写 operatorLogs（代管人 = AI 领班 · 留痕）')
  ok(/依据规则: a\.ruleId/.test(APPJSX) || /依据规则: r\.ruleId/.test(APPJSX), '留痕带【依据规则 id】（谁/何时/什么/依据）')
  ok(/import \{ 默认授权, 领班规则 \} from '\.\/aiSupervisor\.mjs'/.test(TD), '教师端领班页 import 默认授权/领班规则（单源）')
  ok(/setClassSupervisorAuth/.test(TD), '教师端写全班默认授权（setClassSupervisorAuth）')
  // ★ §33-V3：二期口径 —— 授权页明示 R3/R6 真执行（不假承诺 · 也不夸大：R1/R2 明确不开放）
  ok(/二期：R3（超售止损）\/ R6（能耗回归）的代管动作已真实生效/.test(rd('src/TeacherDashboard.jsx')), '★ 授权页明示：二期 R3/R6 真执行（含"学生自己做过的项领班不碰"）')
  ok(/R1\/R2（调价）需竞对价每日数据，二期暂不开放/.test(rd('src/TeacherDashboard.jsx')), '★ 授权页明示：R1/R2 不开放的原因（不许周级冒充日级）')
  ok(/全班行为一致 = 公平基准/.test(rd('src/TeacherDashboard.jsx')), '授权页明示：默认全关 = 全班一致 = 公平')
  // 学生侧授权（收窄/放宽）+ 复盘卡
  ok(/hotel-sim-supervisor-auth/.test(WR) && /function SupervisorCard/.test(WR), '学生侧：SupervisorCard（授权设置写 hotel-sim-supervisor-auth + 本周代管记录）')
  ok(/这周领班|本周复盘/.test(WR), '复盘卡明示"本周"领班记录')
  // 行为：默认全关 ⇒ 一步不动；授权 ⇒ 有动作（记录侧）
  const state = { 出租率: 48, 当前价: 300, 竞对均价: 260, 竞对降价幅度: 12, 竞对溢价: -4, 本周超售赔偿次数: 3, 卫生不合格: true }
  const 关 = 领班决策({ state, authorizations: 生效授权({}) })
  ok(关.actions.length === 0 && 关.reports.length > 0, `★ 默认全关 ⇒ 动作 0（只报告 ${关.reports.length} 条）—— 一步不动`)
  const 开 = 领班决策({ state, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true }, overbook: { ok: true } } }) })
  ok(开.actions.length >= 2, `授权后 ⇒ ${开.actions.length} 条动作（R1 调价 + R3 超售清零）`)
  // null 安全（接线时修）：学生价格下限 缺失 ⇒ 回退 当前价×0.85（不再被 Number(null)=0 误读）
  const 无下限 = 领班决策({ state: { ...state, 学生价格下限: null }, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true } } }) })
  const r1 = 无下限.actions.find(a => a.ruleId === 'R1')
  ok(r1 && Number.isFinite(r1.to) && r1.to >= Math.round(300 * 0.85), `★ 学生价格下限缺失/null ⇒ 回退 当前价×0.85（R1.to=${r1 && r1.to}）`)
  // ★ 接线实测抓到的荒谬建议（真实竞对数据 · 锦江区含 luxury 竞对均价 ~1251 vs 经济型本店 283）：
  //   原式会给出"下调至 1214 元"（实为涨 4 倍）⇒ 修：竞对价不低于本店 ⇒ 不触发；目标夹进 [下限, 当前价]
  const 高竞对 = 领班决策({ state: { 出租率: 33, 当前价: 283, 竞对均价: 1251, 竞对降价幅度: 10, 竞对溢价: -77, 本周超售赔偿次数: 0, 卫生不合格: false }, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true } } }) })
  ok(!高竞对.actions.some(a => a.ruleId === 'R1'), '★ 竞对均价（1251）远高于本店（283）⇒ R1 不触发（不给"下调至 1214"的荒谬建议）')
  const 低竞对 = 领班决策({ state: { 出租率: 48, 当前价: 300, 竞对均价: 260, 竞对降价幅度: 12, 竞对溢价: -4, 本周超售赔偿次数: 0, 卫生不合格: false }, authorizations: 生效授权({ 全班默认: { price_adj: { ok: true } } }) })
  const r1b = 低竞对.actions.find(a => a.ruleId === 'R1')
  ok(r1b && r1b.to < 300 && r1b.to >= Math.round(300 * 0.85), `★ 竞对确实更低 ⇒ R1 触发且目标夹进 [下限, 当前价]（to=${r1b && r1b.to} < 300）`)
  ok(代管率(0, 0) === null, '代管率 0/0 ⇒ null（离线周不进平均）')
  // 一期边界不回退：settle 仍不引用 aiSupervisor（与 thirdPhase 的断言一致 —— 双保险）
  ok(!/aiSupervisor/.test(剥注释(rd('src/settlement.js'))), '引擎边界：settle 不引用 aiSupervisor（记录在 App 层 —— 一期架构位）')
}

console.log('\n[6] 通道与迁移：class_state 扩展（老师写/全班读）· 回退路径 · Edge/serverTick 传注入')
{
  ok(/export async function fetchClassState/.test(SUPA) && /export async function setClassInjections/.test(SUPA) && /export async function setClassSupervisorAuth/.test(SUPA),
    'supabaseClient 三个通道函数齐（fetchClassState/setClassInjections/setClassSupervisorAuth）')
  ok(/injected_events/.test(SUPA) && /supervisor_auth/.test(SUPA), '通道字段名 injected_events / supervisor_auth')
  // 回退：新列不存在（迁移未应用）⇒ 回退只读 current_week，通道字段空 + 通道就绪 false（不阻塞、不谎报）
  const fcs = SUPA.slice(SUPA.indexOf('export async function fetchClassState'), SUPA.indexOf('export async function setClassInjections'))
  ok(/select\('current_week'\)/.test(fcs) && /通道就绪: false/.test(fcs), '★ fetchClassState 回退路径（迁移未应用 ⇒ 只读 current_week + 通道就绪=false）')
  // 迁移 SQL：幂等 + 两列 + 自检/回滚
  const SQL = rd('supabase-migration-u8-class-events.sql')
  ok(!!SQL && /add column if not exists injected_events jsonb/.test(SQL) && /add column if not exists supervisor_auth jsonb/.test(SQL),
    '迁移 SQL：两列 add column if not exists（幂等）')
  ok(/SQL Editor/.test(SQL) && /回滚/.test(SQL), '迁移 SQL 带执行说明与回滚段')
  // Edge：读注入 + 按组过滤 + 传引擎
  ok(/injected_events/.test(EDGE) && /opts\?\.|injectedEvents: injections/.test(EDGE.replace(/any/g, 'any')), 'Edge index.ts：读注入并按组过滤后传 advanceGroupOneDay')
  ok(/injectedEvents: injections\.length \? injections : null/.test(EDGE), 'Edge：无注入 ⇒ 传 null（水位线）')
  ok(/injected_events/.test(EDGEDB) && /回退|回退读既有三列/.test(EDGEDB), 'Edge db.ts：读注入列 + 迁移未应用回退')
  // serverTick：注入 + 应对 + 补算 三件都进 settle
  ok(/injectedEvents: Array\.isArray\(opts\.injectedEvents\)/.test(STICK), 'serverTick：opts.injectedEvents 进 settle')
  ok(/eventResponses: 输入\.注入应对 \|\| null/.test(STICK), 'serverTick：注入应对（weekInputs 单源）进 settle')
  ok(/补算: Number\(src\.week \|\| 1\) < Number\(week\)/.test(STICK), 'serverTick：补算口径 = 该组存档周落后于本次结算周（迟到结算）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：本套件判"界面接线真的发生"（单源/同源/条件挂载/留痕），不是"模块存在"')
process.exit(fail ? 1 : 0)
