// V79 · 客群画像内容补全守门（2026-10-08 · 挂 run-all fast）
// 判据（卡①②④）：
//   [1] 攻略四类客群（商务/游客/家庭/会议）全带 在意/价格敏感度/淡旺季/决策提示
//   [2] 决策提示只引用引擎客群路真决策值（防"攻略说一套引擎做一套"——与 v75Detail 数字定位同族）
//   [3] 选址页渲染接线：攻略速查卡 + 画像行「价格敏感度/淡旺季」推导行
//   [4] 诚实口径：推导声明在界面（人工分级/教学推导 · 不冒充统计）
import { readFileSync } from 'node:fs'
import { 客群攻略, CUSTOMER_PERSONAS, districts } from '../src/siteLocations.mjs'

let pass = 0, fail = 0
const ok = (c, n, extra = '') => { if (c) { pass++; console.log('  ✓ ' + n) } else { fail++; console.error('  ✗ FAIL: ' + n + (extra ? '  [' + extra + ']' : '')) } }
const src = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

console.log('▶ V79 客群画像内容补全')
{
  const 四类 = ['business', 'tourist', 'family', 'meeting']
  const 缺 = 四类.filter(k => !客群攻略[k] || !客群攻略[k].在意 || !客群攻略[k].价格敏感度 || !客群攻略[k].淡旺季 || !客群攻略[k].决策提示)
  ok(缺.length === 0, '攻略四类客群全带 在意/价格敏感度/淡旺季/决策提示', 缺.join(','))
  ok(四类.every(k => (客群攻略[k].在意 || '').length >= 8 && (客群攻略[k].决策提示 || '').length >= 8), '在意/决策提示成句（≥8 字）')
  // 决策提示只引用引擎客群路真决策值（settlement.js 客群段消费的字面；温度区间在引擎是比较式 ⇒ 单独映射）
  const eng = src('settlement.js')
  const 提示全文 = 四类.map(k => 客群攻略[k].决策提示).join('；')
  const 决策值检查 = [
    ['满编保服务', () => eng.includes('满编保服务')],
    ['停房深清洁', () => eng.includes('停房深清洁')],
    ['降价 20% 抢客', () => eng.includes('降价 20% 抢客')],
    ['温度窗 22-24（商务）', () => /energy >= 22 && energy <= 24/.test(eng)],
    ['温度窗 22-25（家庭）', () => /energy >= 22 && energy <= 25/.test(eng)],
  ]
  for (const [名, 查] of 决策值检查) {
    if (提示全文.includes(名.replace(/（.*）/, '').replace('温度窗 ', '')) || 名.includes('温度窗')) ok(查(), `决策提示引用的决策值在引擎存在：「${名}」`)
  }
  // 引用检查是"出现即查"：攻略里引用的每个引擎字面都必须在引擎里（反向不做全集要求）
  // 画像行推导（SiteSelection 源码接线）
  const ss = src('SiteSelection.jsx')
  for (const 标 of ['价格敏感度：', '淡旺季：', '客群攻略速查', '怎么接', '教学推导']) ok(ss.includes(标), `选址页含「${标}」`)
  ok(ss.includes("客群攻略[per && per.dominant]"), '画像行按 dominant 客群挂攻略（26/26 有 dominant · V73 口径）')
  // 26 区位 dominant 全在攻略键内（防挂空）
  const 键 = new Set(四类)
  const 挂空 = Object.values(districts).flat().filter(d => !键.has(CUSTOMER_PERSONAS[d.name] && CUSTOMER_PERSONAS[d.name].dominant))
  ok(挂空.length === 0, '26 区位 dominant 全能挂上攻略', 挂空.map(d => d.name).join(','))
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`)
console.log('验收口径：客群看得见用得上（在意/敏感度/淡旺季/怎么接）· 提示只引引擎真值 · 推导口径在界面声明')
process.exit(fail ? 1 : 0)
