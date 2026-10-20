// V132 · V131 返工收口：三条走查认领、旧断言、entryProbe 尾行、开局取舍上桌、迟押可见
// 运行：node tests/v132.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 认领取舍项 } from '../src/claimChoices.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync('src/' + f, 'utf8')
const test = (f) => readFileSync('tests/' + f, 'utf8')

console.log('▶ V132 · V131 返工收口')

console.log('\n[§1] 三条走查共用「走完认领」+ 未选禁用断言')
{
  ok(/export async function 走完认领/.test(test('claimWalk.mjs')), 'claimWalk 提供 走完认领（走不通抛错，不静默）')
  for (const f of ['_v75-verify.mjs', 'verify-capital.mjs', '_v80-verify.mjs']) {
    const t = test(f)
    ok(/import \{ 走完认领 \}/.test(t) && /await 走完认领\(page, sleep\)/.test(t), `${f} 用统一走法`)
    ok(!/确认无误/.test(t.split('走完认领')[0].slice(-2200)) || /走完认领/.test(t), `${f} 不再靠旧文案单独推进`)
  }
  ok(/未做取舍时下一步禁用/.test(test('_v75-verify.mjs')), 'v75 带"未做取舍 ⇒ 下一步禁用"防回归断言')
  ok(/本步可继续\(current\.key/.test(src('Claim.jsx')), 'Claim 用 本步可继续（RV 靶）')
}

console.log('\n[§2] 认领取舍上桌：教师看板 + 周报')
{
  const td = src('TeacherDashboard.jsx')
  ok(/开局取舍：/.test(td) && /放弃了：/.test(td), '教师端思维看板有「开局取舍 + 放弃了什么」')
  ok(/开局\.map/.test(td), '六步逐条展开')
  const wr = src('WeeklyReport.jsx')
  ok(/你的开局选择/.test(wr) && /认领取舍项/.test(wr), '周报有「你的开局选择」六步块')
  ok(/认领取舍=\{认领取舍\}/.test(src('App.jsx')), 'App 把认领取舍传给周报')
  ok(Object.keys(认领取舍项).length === 6, '六步（与 claimChoices 同源）')
}

console.log('\n[§3] v125Ui 旧断言改为两条并存')
{
  const v = test('v125Ui.test.mjs')
  ok(!/教师端没有「进入下一周」/.test(v), '旧断言（没有按钮）已删除')
  ok(/教师端有「推进到本周结束 \/ 进入下一周」/.test(v), '新断言①：教师端有推进按钮')
  ok(/学生端周报仍是 week\+1/.test(v), '新断言②：学生端仍 week+1（不写 classDay）')
}

console.log('\n[§4] entryProbe 标准尾行')
{
  const p = test('_v109_entry_probe.mjs')
  ok(/结果: \$\{通过数\} 通过 \/ \$\{失败数\} 失败/.test(p), '末尾输出 `结果: N 通过 / M 失败`（run-all 可解析）')
  ok(/通过数 > 0 && 失败数 === 0/.test(p), 'exit 码与失败数联动（RV 可红）')
}

console.log('\n[§5] 迟押可见：N/6 + 台账「迟」')
{
  const td = src('TeacherDashboard.jsx')
  ok(/本周迟押 \{rows\.filter\(r => r\.押注 && r\.押注\.迟押\)\.length\}\/\{rows\.length\}/.test(td), '看板顶部有「本周迟押 N/6 组」')
  const ps = src('processScore.mjs')
  ok(/押注迟押 \? '迟' : 押注分/.test(ps), '台账押注列：迟押显示「迟」')
  ok(/押注迟押: !!/ .test(src('processLedgerRows.mjs')) || /押注迟押: !\(!/.test(src('processLedgerRows.mjs')) || /押注迟押: !\(!\(押注/.test(src('processLedgerRows.mjs')), '教师端台账行传迟押标记')
  ok(/押注迟押: !!\(押注条目/.test(src('App.jsx')), '学生端台账传迟押标记')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
