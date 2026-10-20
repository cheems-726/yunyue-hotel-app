// V131 §1-C · 认领 6 步真取舍（纯确认步 ≤2 · 每步有代价 · 需要时写理由）
// 运行：node tests/claimChoices.test.mjs   （挂 run-all fast）
import { readFileSync } from 'node:fs'
import { 认领取舍项, 取舍摘要, 本步可继续 } from '../src/claimChoices.mjs'
import { 理由合格 } from '../src/keyReasons.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const 键 = Object.keys(认领取舍项)
const 纯确认步数 = Object.values(认领取舍项).filter(x => !Array.isArray(x.选项) || x.选项.length < 2).length

console.log('▶ V131 §1-C · 认领 6 步取舍')

console.log('\n[①] 六步全覆盖 · 每步 ≥2 个有代价的选项 · 纯确认 0 步')
{
  ok(键.length === 6, `六个步骤都有取舍项（实得 ${键.length}）`)
  ok(键.join('/') === 'apply/review/survey/decision/negotiate/sign', '步骤键与 Claim 6 步一致')
  for (const k of 键) {
    const it = 认领取舍项[k]
    ok(it.选项.length >= 2, `${k}：≥2 个选项（实得 ${it.选项.length}）`)
    ok(it.选项.every(o => o.label && o.代价 && o.收益), `${k}：每个选项都写清代价与收益`)
    ok(new Set(it.选项.map(o => o.代价)).size === it.选项.length, `${k}：代价互不相同（不是换皮）`)
  }
  ok(纯确认步数 === 0, `★ 纯确认步数 = 0（卡内判据 ≤2 · 实得 ${纯确认步数}）`)
  ok(认领取舍项.decision.需理由 && 认领取舍项.sign.需理由, '项目决策/合同签署两步需写一句理由')
}

console.log('\n[②] 本步可继续：没选不行 · 需理由的两步没理由不行')
{
  ok(本步可继续('apply', {}, {}, 理由合格) === false, '没选 ⇒ 不能继续')
  ok(本步可继续('apply', { apply: '只报这 1 个（2 天）' }, {}, 理由合格) === true, '选了 ⇒ 可继续（无需理由）')
  ok(本步可继续('decision', { decision: '中投入 · 平衡' }, {}, 理由合格) === false, '决策步：选了但没理由 ⇒ 不能继续')
  ok(本步可继续('decision', { decision: '中投入 · 平衡' }, { decision: '现金紧，先保开业' }, 理由合格) === true, '决策步：选了+理由 ⇒ 可继续')
  ok(本步可继续('decision', { decision: '中投入 · 平衡' }, { decision: 'x'.repeat(31) }, 理由合格) === false, '理由超过 30 字 ⇒ 不合格')
  ok(本步可继续('unknown', {}, {}, 理由合格) === true, '未知步骤不拦（防御）')
}

console.log('\n[③] 摘要：显示已做取舍（讲评素材）')
{
  const s = 取舍摘要({ apply: '只报这 1 个（2 天）', review: '接受报价' }, ['apply', 'review', 'survey'])
  ok(s.length === 2 && /意向申请：只报这 1 个/.test(s[0]) && /项目初审：接受报价/.test(s[1]), `摘要两条（实得 ${s.join('；')}）`)
  ok(取舍摘要({}, ['apply']).length === 0, '空取舍 ⇒ 空摘要')
}

console.log('\n[④] 接线（静态）：Claim 每步都要选 · 取舍进存档')
{
  const c = readFileSync('src/Claim.jsx', 'utf8')
  ok(/data-claim-opt=\{o\.label\}/.test(c), '每个选项可被定位（data-claim-opt）')
  ok(/data-claim-reason="1"/.test(c), '需理由的步骤有理由输入')
  ok(/disabled=\{[^}]*!可继续/.test(c) || /!可继续/.test(c), '★ 未做取舍 ⇒ 下一步按钮禁用')
  ok(/onComplete\(\{ property: selectedProperty, brand, 取舍, 取舍理由 \}\)/.test(c), '完成时把取舍/理由交给 App')
  const app = readFileSync('src/App.jsx', 'utf8')
  ok(/set认领取舍\(result\.取舍\)/.test(app) && /认领取舍, 认领取舍理由/.test(app), 'App 把取舍存进状态/存档/云端')
}

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败')
process.exit(fail === 0 ? 0 : 1)
