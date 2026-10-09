import { useState } from 'react'
import Icon from './Icon.jsx'
import ResultFeedback from './ResultFeedback.jsx'
import { SCALE } from './stateMigration.mjs'   // 资金三数单源（W2 收尾：启动资金文案不再硬编码）
import { FRANCHISE_MODEL } from './franchiseModel.mjs'   // ★ V76：条款单源（保证金/管理费/物业门槛只此一份，界面不许抄数字）
import { COMPETITORS, CUSTOMER_PERSONAS } from './siteLocations.mjs'   // ★ V76：适配区位由竞品 OTA 实测 + 客群画像推得
import { brandGroups } from './brands.mjs'   // ★ V76：品牌数据单源（纯数据模块 · 测试可直接 import）



// ── ★ V76（2026-10-08）：品牌内容补全 · 三个只读 helper（不写死任何数字）──────────
// ① 品牌条款：保证金/管理费/物业门槛 —— 只从 FRANCHISE_MODEL 现值取（单源）；
//    没有来源的品牌如实「待补」（🔴 不编：公开面只有覆盖矩阵里那几家有源）。
const LEVEL_竞品 = { '经济型 · 国民': ['budget'], '中档': ['mid'], '精选 · 中高档': ['upscale'], '高档': ['upscale', 'luxury'], '奢华': ['luxury'] }
function 品牌条款(name) {
  const m = FRANCHISE_MODEL[name]
  if (!m) return null
  const 金额 = (x) => x >= 10000 ? (x / 10000) + ' 万' : x + ' 元'
  const 面积 = m.物业门槛 && (m.物业门槛.建筑面积下限 || m.物业门槛.建筑面积区间)
  const 房量 = m.物业门槛 && (m.物业门槛.最少房量 || m.物业门槛.房量区间)
  return {
    保证金: m.保证金 ? 金额(m.保证金.值) + '（置信度 ' + m.保证金.置信度 + '）' : null,
    管理费: m.管理费 && m.管理费.费率 ? '月营收 × ' + (m.管理费.费率.值 * 100) + '%（置信度 ' + m.管理费.费率.置信度 + '）' : null,
    筹备费: m.筹备费 ? 金额(m.筹备费.值) + '（置信度 ' + m.筹备费.置信度 + '）' : null,
    物业面积: 面积 ? (面积.值 && typeof 面积.值 === 'number' ? '≥' + 面积.值 + '㎡' : 面积.值 && typeof 面积.值 === 'object' ? 面积.值[0] + '-' + 面积.值[1] + '㎡' : null) : null,
    房量门槛: 房量 ? (房量.值 && typeof 房量.值 === 'number' ? '≥' + 房量.值 + ' 间' : 房量.值 && typeof 房量.值 === 'object' ? 房量.值[0] + '-' + 房量.值[1] + ' 间' : null) : null,
  }
}
// ② 适配区位：品牌价带（±容忍）× 同档竞品 OTA 实测（2026-09-27 · 121 家）⇒ 哪些区位有同档对标；
//    客群 = 适配区位的客群画像聚合（人工分级口径，界面 ⓘ 已声明非统计）。
function 适配区位(level, priceStr) {
  const m = /(\d+)-(\d+)/.exec(priceStr || '')
  const 档s = LEVEL_竞品[level] || []
  if (!m || !档s.length) return null
  const lo = Number(m[1]) * 0.8, hi = Number(m[2]) * 1.3
  const 名单 = []
  const 客群和 = { business: 0, tourist: 0, family: 0 }
  for (const [区, list] of Object.entries(COMPETITORS)) {
    const 命中 = (list || []).some(c => {
      if (!档s.includes(c.level)) return false
      const p = c.priceBasis === 'from' ? c.basePrice : (c.priceAvg || c.basePrice)
      return p >= lo && p <= hi
    })
    if (命中) {
      名单.push(区)
      const per = CUSTOMER_PERSONAS[区]
      if (per) { 客群和.business += per.business; 客群和.tourist += per.tourist; 客群和.family += per.family }
    }
  }
  const 总 = 客群和.business + 客群和.tourist + 客群和.family || 1
  const 主 = [['商务', 客群和.business], ['游客', 客群和.tourist], ['家庭', 客群和.family]].sort((a, b) => b[1] - a[1])[0]
  return { 名单, 主客群: 主[0] + '客为主（约 ' + Math.round(主[1] / 总 * 100) + '% · 按适配区位客群画像聚合）' }
}
const V76_来源行 = '条款=加盟数值层 FRANCHISE_MODEL（官方 API/旧版官方/转载 · 逐条带置信度）；适配区位=选址竞品 OTA 实测（2026-09-27 · 121 家）与客群画像（人工分级）推得'

export default function BrandSelection({ location, onConfirm }) {
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [confirmBrand, setConfirmBrand] = useState(null) // 含 level 的完整品牌对象
  const [对比组, set对比组] = useState([])   // ★ V76：并排对比（最多 3 个 · {name, level}）

  function toggle对比(name, level) {
    set对比组(prev => {
      if (prev.some(x => x.name === name)) return prev.filter(x => x.name !== name)
      if (prev.length >= 3) return prev   // 满 3 个：忽略（提示在按钮 title 上）
      return [...prev, { name, level }]
    })
  }

  // 区域限开等级：客流≤2 → 仅经济型(1)；3 → 经济～中端(2)；≥4 → 全档次(5)
  const flow = location?.attrs?.客流 ?? 3
  const maxTier = flow >= 4 ? 5 : (flow >= 3 ? 2 : 1)
  // ★ §31.2-A1（2026-09-30 · 等级限制【真强制】）：brandGroups 的下标 gi 即档次 1..5（经济型=1 … 奢华=5）。
  //   原先只有红色横幅（下方渲染）而 handleBrandClick **完全不校验** ⇒ 超档品牌仍可点选（装饰品 · 审计 D83-c）。
  //   现在三层强制：① 卡片 disabled ② 点击直接 return（双保险）③ 引擎侧 settle 校验（见 settlement.js）。

  // 每个品牌选择后的结果反馈
  // ★ V76：七字段齐亮（加盟费/保证金/管理费/档次/适配区位/客群/标准要求）—— 无源字段如实「待补」
  function brandResult(b) {
    const isHigh = b.cost.includes('20万') || b.cost.includes('30万')
    const isEco = b.level.includes('经济')
    const 条款 = 品牌条款(b.name)
    const 适 = 适配区位(b.level, b.price)
    const 标准 = [b.standard, 条款 && 条款.物业面积].filter(Boolean)
    return {
      title: `选择「${b.name}」的结果`,
      changes: [
        { label: '档次', value: b.level, dir: '' },
        { label: '投资门槛', value: b.cost, dir: isHigh ? 'down' : (isEco ? 'up' : '') },
        { label: '房价带', value: b.price, dir: '' },
        { label: '加盟费', value: b.fee, dir: '' },
        { label: '保证金', value: 条款 && 条款.保证金 ? 条款.保证金 : '待补（无公开来源 · 不编造）', dir: '' },
        { label: '筹备费', value: 条款 && 条款.筹备费 ? 条款.筹备费 : '待补（无公开来源 · 不编造）', dir: '' },
        { label: '管理费', value: 条款 && 条款.管理费 ? 条款.管理费 : '待补（无公开来源 · 不编造）', dir: '' },
        { label: '标准要求', value: 标准.join(' · ') || b.standard, dir: '' },
        { label: '适配区位', value: 适 && 适.名单.length ? `${适.名单.length} 个：${适.名单.slice(0, 4).join('、')}${适.名单.length > 4 ? ' 等' : ''}` : '26 区位实测竞品中无同档同价带对标（此组合当前市场空档 · 谨慎）', dir: '' },
        { label: '主力客群', value: 适 ? 适.主客群 : '待补（无适配区位可聚合）', dir: '' },
        { label: '数据来源', value: V76_来源行, dir: '' },
      ],
      note: `${b.desc} 选${b.name}意味着：${isHigh ? '高投入高回报，但资金压力大、回收期长' : isEco ? '低门槛易起步，但房价天花板低、利润薄' : '投入与回报相对均衡'}。后续认领的物业必须符合「${b.standard}」的标准。`,
    }
  }

  function handleBrandClick(b, level, gi) {
    // ★ §31.2-A1【真强制】：超档品牌直接拒绝（反馈面板写明原因 —— 学生看得见为什么）
    if (gi + 1 > maxTier) {
      setFeedback({
        title: `「${b.name}」在当前区域不可选`,
        changes: [
          { label: '区域限制', value: `${location?.district ?? '本区域'}（客流 ${flow} 档）最高只能开档次 ${maxTier}`, dir: 'down' },
          { label: '品牌档次', value: `第 ${gi + 1} 档（${g_levelName(gi)}）`, dir: '' },
          { label: '原因', value: '低消费区开高端酒店必亏（教学口径 3.2-1）—— 请换经济型品牌，或返回选址重选', dir: '' },
        ],
        note: '这不是故障，是经营现实：选址决定你能做什么生意。',
      })
      return
    }
    const brand = { ...b, level }
    setSelected(b.name)
    setFeedback(brandResult(brand))
    setConfirmBrand(brand)
  }

  // 档次名（§31.2-A1 · 供拒绝反馈用）
  function g_levelName(gi) {
    return ['经济型', '中端型', '中高端型', '高端型', '奢华型'][gi] || `第 ${gi + 1} 档`
  }

  return (
    <div className="content">
      <div className="header">
        <span className="step-tag">第二步 · 选品牌</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>选择你的酒店品牌</h1>
        <div className="sub">品牌决定物业标准、加盟费用、房价带</div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 20px', marginBottom: 8 }}>
        华住全品牌 · 共 {brandGroups.reduce((s, g) => s + g.brands.length, 0)} 个，点击选择
      </div>
      <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', borderRadius: 8, fontSize: 12, color: 'var(--warn)', lineHeight: 1.6 }}>
        免责声明：本系统中的酒店价格为<b>模拟经营数据</b>，仅供教学演示使用，不代表实际市场定价。实际投资需以专业可行性调研为准。
      </div>
      {location && maxTier < 5 && (
        <div style={{ margin: '0 20px 12px', padding: '8px 12px', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)', borderRadius: 8, fontSize: 12, color: 'var(--bad)' }}>
          {location.district}（客流{flow}档）限开：{maxTier === 1 ? '仅经济型品牌' : '经济型～中端型品牌'}，高端品牌在此区域必亏
        </div>
      )}

 {/* P3-3：各档"初始资金"文案改口（建议 (a)）—— 实际是【系统统一提供启动资金】，
          不再是"经济型30万/中端50万…"的分档金额；档次差异体现在装修标准/房价带/房量门槛。
 W2 收尾修正：原硬编码"约 502 万"是 T1.1 时代的量级，W2-2 后 IC = 149 万
          ⇒ 学生看到"约 502 万"却只拿到 149 万（学生可见错值）⇒ 改为从 SCALE.IC_NEW 推导，单源。
 A-3（2026-09-27 · D47-g）：正名【运营启动资金】—— IC 149 万 ≠ 投资总额
          （单房造价 7.18 万 × 100 间 = 718 万），叫"启动资金"学生会当成开店总投 ⇒ 名字要写全。 */}
      <div style={{ margin: '0 0 10px', padding: '8px 12px', background: 'var(--primary-bg)', border: '1px solid var(--primary-border)', borderRadius: 10, fontSize: 12, color: 'var(--info)', lineHeight: 1.7 }}>
        <b>运营启动资金：系统统一提供约 {SCALE.IC_NEW / 10000} 万</b>（全班一致）。
        这笔钱是<b>用来周转经营的</b>，<b>不等于"开一家酒店的总投资"</b>——筹建投入（装修/软装/IT/布草等）
        另算，「报价单」里单列。品牌档次的差异体现在
        <b>装修标准 / 房价带 / 房量门槛</b>上，而不是这笔钱多少 —— 档越高，同样的钱越要花在品质上。
      </div>
      <div className="district-list">
        {brandGroups.map((g, gi) => (
          <div key={g.level} style={{ marginBottom: 16 }}>
            <div style={{ background: 'var(--warn-bg)', borderRadius: 12, padding: '10px 14px', marginBottom: 8, border: '1px solid var(--warn-border)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)', marginBottom: 4 }}>{g.level}</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6 }}>
                {gi === 0 && '经济型酒店主打干净、便捷、高性价比。装修简约，服务标准化，目标客群是预算有限的出差和旅行客人。房量与装修门槛最低，适合新手起步。'}
                {gi === 1 && '中端型酒店强调设计感和舒适体验，房价更高但客人要求也更高。需要平衡品质与成本，是竞争最激烈的档次。'}
                {gi === 2 && '中高端酒店在硬件和服务上全面升级，房价400+，对服务细节要求极高。适合有一定经营经验的团队。'}
                {gi === 3 && '高端酒店注重奢华体验和品牌调性，装修和人力成本极高，但房价可达600-1000元。回报大但风险也大。'}
                {gi === 4 && '奢华酒店是顶级定位，极致服务和独特设计，目标客群是高端商务和奢侈品消费者。只有最优秀的团队才能盈利。'}
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--warn)', marginBottom: 8, padding: '0 4px' }}>{g.level}</div>
            {g.brands.map(b => {
              const 超档 = gi + 1 > maxTier
              return (
              <div
                key={b.name}
                className={`district-card ${selected === b.name ? 'selected' : ''}`}
                onClick={() => handleBrandClick(b, g.level, gi)}
                style={{ marginBottom: 8, padding: 12, ...(超档 ? { opacity: 0.45, cursor: 'not-allowed', background: 'var(--fill)' } : {}) }}
              >
                {超档 && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--bad)', marginBottom: 4 }}>
                    超出本区档次上限（限开 {maxTier} 档）—— 不可选
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}><Icon name={b.icon} size={16} style={{ display: 'inline-block', verticalAlign: '-2px' }} /> {b.name}</span>
                  {selected === b.name && (
 <span style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: '50%', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}></span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginTop: 4 }}>{b.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>加盟费 {b.fee}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>单房造价 {b.cost}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>门市价 {b.price}</span>
                  <span style={{ fontSize: 12, padding: '3px 7px', background: 'var(--bg)', borderRadius: 5 }}>房量 {b.standard}</span>
                </div>
                {/* ★ V76：加入/移出并排对比（最多 3 个 · 与选中确认互不干扰） */}
                <button
                  title={`对比：${b.name}（最多 3 个）`}
                  onClick={e => { e.stopPropagation(); toggle对比(b.name, g.level) }}
                  style={{ marginTop: 8, fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', border: 对比组.some(x => x.name === b.name) ? '1px solid var(--primary)' : '1px solid var(--border)', background: 对比组.some(x => x.name === b.name) ? 'var(--primary-bg)' : 'var(--bg)', color: 对比组.some(x => x.name === b.name) ? 'var(--info)' : 'var(--text-sub)' }}
                >{对比组.some(x => x.name === b.name) ? '✓ 已加入对比' : '＋ 加入对比'}</button>
              </div>
              )})}
          </div>
        ))}
      </div>

      {/* V51批2：吸底悬浮确认条（选中即常驻可见 · 不随内容滚动消失）*/}
      <div style={{ position: 'sticky', bottom: 0, padding: '8px 20px 24px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
        {/* ★ V76：并排对比表（≥2 个品牌时出现 · 学生能直接看差异） */}
        {对比组.length >= 2 && (
          <div className="card" style={{ marginBottom: 10, padding: 12, overflowX: 'auto' }}>
            <div className="card-title">品牌对比（并排看差异 · 最多 3 个）</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['', ...对比组.map(x => x.name)].map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[
                  ['档次', x => x.level],
                  ['加盟费', x => x.b.fee],
                  ['保证金', x => { const t = 品牌条款(x.b.name); return (t && t.保证金) || '待补' }],
                  ['管理费', x => { const t = 品牌条款(x.b.name); return (t && t.管理费) || '待补' }],
                  ['单房造价', x => x.b.cost],
                  ['门市价带', x => x.b.price],
                  ['房量门槛', x => x.b.standard],
                  ['适配区位', x => { const a = 适配区位(x.level, x.b.price); return a ? a.名单.length + ' 个' : '—' }],
                  ['主力客群', x => { const a = 适配区位(x.level, x.b.price); return a ? a.主客群.replace(/（.*?）/, '') : '—' }],
                ].map(([标, 取]) => (
                  <tr key={标}>
                    <td style={{ padding: '4px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{标}</td>
                    {对比组.map(x => {
                      const grp = brandGroups.find(g2 => g2.level === x.level)
                      const b = grp && grp.brands.find(b2 => b2.name === x.name)
                      return <td key={x.name} style={{ padding: '4px 8px', borderBottom: '1px solid var(--fill)', verticalAlign: 'top' }}>{b ? 取({ b, level: x.level }) : '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{V76_来源行}</div>
            <button onClick={() => set对比组([])} style={{ marginTop: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-sub)', borderRadius: 6, padding: '3px 10px' }}>清空对比</button>
          </div>
        )}
        <button
          className="btn-confirm"
          disabled={!selected}
          onClick={() => {
            if (confirmBrand) onConfirm(confirmBrand)
            else {
              const b = brandGroups.flatMap(g => g.brands.map(x => ({ ...x, level: g.level }))).find(x => x.name === selected)
              if (b) onConfirm(b)
            }
          }}
        >
          {selected ? `确认选择 ${selected}，去认领酒店 →` : '请选择一个品牌'}
        </button>
        {/* V54批2 缺口3：不可逆预告（S2 品牌选定后无反悔入口属设计 · 界面须提前说明） */}
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>品牌确认后本学期不可更改（加盟费/价带/房量门槛按此品牌核算，认领后不设换牌入口）</div>
      </div>

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
