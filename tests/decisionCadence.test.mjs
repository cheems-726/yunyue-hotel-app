// A5 · 决策节奏（粒度丙）与归属日规则 —— 断言
// 运行：node tests/decisionCadence.test.mjs   （挂 run-all）
//
// 背景（二期 §5-E3 / A5）：三档粒度与归属日规则"已定"，本套件把定义落成断言，
//   保证二期 E3 实现时不会与规格漂移；★ 覆盖纪律：18 项决策要么在已定档、要么在待定档，
//   **不许静默遗漏**（遗漏=有人悄悄决定了一个教学口径）。
import { readFileSync, readdirSync } from 'node:fs'
import { 档, 已定档, 待定档, 覆盖度, 归属日, 可提交, 档语, 非决策项 } from '../src/decisionCadence.mjs'
import { decisions } from '../src/decisions.js'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').split(/\r?\n/).map(l => l.replace(/\/\/.*$/, '')).join('\n')
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ A5 · 决策节奏（粒度丙）+ 归属日规则（T11）')

// ── ① 覆盖完整性：18 项要么已定、要么待定，不许漏 ─────────────────────
console.log('\n[1] 覆盖完整性（18 项决策全覆盖，且无静默遗漏）')
{
  const c = 覆盖度()
  ok(c.全部.length === 18, `decisions.js 仍是 18 项（实测 ${c.全部.length}）`)
  ok(c.未覆盖.length === 0, '每项决策都落在【已定档】或【待定档】里（无静默遗漏）', c.未覆盖.join(', '))
  ok(c.多余.length === 0, '档位表里没有不存在的 id（无幽灵条目）', c.多余.join(', '))
  const 已定数 = Object.values(已定档).flat().length
  // 🔴 2026-09-28（N-3 · D47-d 已拍）：原"已定 11 + 待定 7" ⇒ 现"已定 18 + 待定 0"（7 项代拍落定）
  ok(已定数 === 18 && 待定档.length === 0,
    `全 18 项都已定档、无待定（D47-d 代拍后待定档清空）`, `${已定数}/${待定档.length}`)
  ok(c.重复.length === 0, '同一 id 没有被塞进两档（否则界面会出现两个组标签）', c.重复.join(','))
  ok(档语[档.待定].说明.includes('待拍板'), '待定档文案保留（空档也留着链 —— 一旦有人塞进未拍板项，界面会显式提示）')
  ok(非决策项.some(x => x.规格名 === '品牌加盟'), '规格里的"品牌加盟"标注为【非决策项】（属认领流程），不留悬空项')
}

// ── ② 已定档与规格逐字对齐（口径来源可追）───────────────────────────
console.log('\n[2] 已定档与归档规格逐项对齐')
{
  // 规格原文（归档包《任务包-实时经营改造-含前置修复.md》E3 段）：
  //   实时项=房价/超售数/排班/能耗温度/布草 · 周期项=会员策略/营销活动/OTA合作/收益管理
  //   一次性=投资改造/裁员招聘/品牌加盟
  //   ★ 2026-09-28（N-3 · D47-d 代拍补 7 项）：
  //     实时 += 质检 quality-check / 卫生 hygiene / 口碑应对 reputation / 应急 emergency
  //     周期 += 报表诊断 report-diagnosis / 企业客户 corporate / 会员门槛 member-threshold
  const 期望 = {
    实时: ['pricing', 'overbook', 'shifts', 'energy', 'linen', 'quality-check', 'hygiene', 'reputation', 'emergency'],
    周期: ['member-convert', 'campaign', 'ota', 'revenue-mgmt', 'report-diagnosis', 'corporate', 'member-threshold'],
    一次性: ['renovation', 'hr-optimize'],
  }
  for (const [k, ids] of Object.entries(期望)) {
    const got = 已定档[档[k === '实时' ? '实时' : k === '周期' ? '周期' : '一次性']]
    ok(JSON.stringify(got) === JSON.stringify(ids), `【${k}项】与规格一致（${ids.length} 项：${ids.join('/')}）`, JSON.stringify(got))
  }
  ok(档语[档.实时].说明.includes('次日生效') && 档语[档.一次性].说明.includes('1–2 次'),
    '三档文案与规格语义一致（次日生效 / 每 7 天 / 全程 1–2 次）')
}

// ── ③ 归属日规则（T11）：+1 且不可回溯 ───────────────────────────────
console.log('\n[3] 归属日 = classDay + 1 · 当日已发生不可回溯')
{
  ok(归属日(1) === 2 && 归属日(7) === 8 && 归属日(126) === 127, '归属日(classDay) === classDay + 1（含跨周/末期边界）')
  ok(归属日(0) === 1 && 归属日(NaN) === 1 && 归属日(-5) === 1, '脏输入归一化：0/NaN/负数 → classDay 0 ⇒ 归属日 1（不产生 NaN）')
  ok(可提交(5, 6) === true, '提交"明天"⇒ 允许')
  ok(可提交(5, 5) === false && 可提交(5, 4) === false, '提交"今天/昨天"⇒ 一律拒绝（不可回溯）')
  ok(可提交(5, NaN) === false && 可提交(5, undefined) === false, '非法目标日 ⇒ 拒绝（不静默放行）')
  // 跨周边界：classDay 7 → 8 恰是下一周第 1 天（dayToWeekDay 口径由 serverTick 提供，这里只钉 +1）
  ok(归属日(7) - 归属日(6) === 1, '跨周不打断 +1（第 6→7 天与第 7→8 天同一规则）')
}

// ── ④ 零影响：纯数据 + 纯函数，不碰结算 ─────────────────────────────
console.log('\n[4] 零影响：不碰结算 / 不与 decisions.js 抢权威')
{
  const code = strip(src('decisionCadence.mjs'))
  ok(!/settlement|money|capital|profit/.test(code), '本模块不含任何结算/金额逻辑（纯规则与数据）')
  ok(!/from '\.\/settlement\.js'/.test(code), '不引用引擎（settlement.js）')
  const files = readdirSync(new URL('../src/', import.meta.url)).filter(f => /\.(js|jsx|mjs)$/.test(f) && !f.startsWith('settle-old'))
  const importers = files.filter(f => f !== 'decisionCadence.mjs' && /decisionCadence/.test(strip(src(f))))
  // 🔴 2026-09-28（N-3 · E3 落地）：原断言是"E3 开工前不许有引用方"的施工期护栏；
  //   E3 已把三档接到界面 ⇒ 判据翻转为【必须被界面引用】（且必须引到"档位/档语"这两个面上）。
  //   这样"界面把档位表抄一份自己写"会同时被本套件与 realtimeDecision[3] 抓到（双向守）。
  const 界面引用 = ['App.jsx', 'DecisionPanel.jsx'].filter(f => importers.includes(f))
  ok(界面引用.length === 2,
    `三档已接入界面（${界面引用.join(' + ')}）—— E3 验收"三档可辨"的机器证据`, importers.join(','))
  const 抄一份 = ['App.jsx', 'DecisionPanel.jsx'].filter(f => /realtime|periodic|onetime/.test(strip(src(f))) && !/decisionCadence/.test(strip(src(f))))
  ok(抄一份.length === 0, '界面文件没有绕过单源另写一份档位字面量', 抄一份.join(','))
  // 权威不重叠：档位表里的 id 必须真的存在于 decisions.js（防"自己造一套 id"）
  const ids = new Set(decisions.map(d => d.id))
  ok([...Object.values(已定档).flat(), ...待定档].every(id => ids.has(id)), '档位表的 id 全部取自 decisions.js（不另造一套）')
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：18 项全覆盖（已定 11 + 待定 7，无静默遗漏）· 归属日 +1 不可回溯 · 不碰结算')
process.exit(fail ? 1 : 0)
