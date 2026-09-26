import { useState, useEffect } from 'react'
import ResultFeedback from './ResultFeedback.jsx'
import { scoreNegativeReply, scoreGoodReply } from './replyScoring.js'
import { guestsRng, makeReview } from './guests.js'
import { decisions as DEC_CATALOG } from './decisions.js'

// 差评数据（含处理状态）
const initialReviews = [
  { id: 1, avatar: '🧑', bg: 'blue', name: '王先生 · 商务出差', date: '入住3天 · 昨天22:14', stars: 2, text: '「隔音太差了，隔壁半夜看电视听得一清二楚，完全没睡好。」', status: 'pending' },
  { id: 2, avatar: '👩', bg: 'green', name: '李女士 · 家庭出游', date: '入住2天 · 昨天18:30', stars: 1, text: '「前台办理入住等了半小时，体验很差。」', status: 'pending' },
  { id: 3, avatar: '👨', bg: 'blue', name: '张先生 · 旅行', date: '前天', stars: 5, text: '「位置很好，离地铁近，房间干净，下次还来。」', status: 'good' },
]

const REVIEW_KEY = 'hotel-sim-reviews'

function loadReviews() {
  try {
    const raw = localStorage.getItem(REVIEW_KEY)
    return raw ? JSON.parse(raw) : initialReviews
  } catch (e) {
    return initialReviews
  }
}

// 快捷话术（只是打字辅助，不提示任何评分规则——学生自己判断怎么写）
const quickNegReplies = [
  '尊敬的客人您好，非常抱歉给您带来不好的体验。我们已第一时间排查整改该问题，并为您申请了免费房型升级与延迟退房作为补偿，真诚期待您再次给我们机会。',
  '您好，感谢您的反馈，非常抱歉。我们已经核实并安排整改，同时会加强员工培训，避免类似情况再次发生。',
  '感谢您的评价，我们会努力改进。',
  '这个问题属于客人个人使用原因，属正常现象，请您理解。',
]
const quickGoodReplies = [
  '谢谢您的认可！已为您准备了一份会员小惊喜，下次入住报手机号即可领取，期待再次见到您！',
  '感谢您的肯定，我们会继续保持，欢迎下次再来！',
  '好的，谢谢。',
]

export default function Reputation({ report, history, week, attrs, decisions }) {
  const [reviews, setReviews] = useState(loadReviews)
  const [replying, setReplying] = useState(null) // 正在回复的评价 { review, isGood }
  const [replyText, setReplyText] = useState('') // 自由输入的话术
  const [showIgnored, setShowIgnored] = useState(false) // 忽略区折叠
  const [openTrace, setOpenTrace] = useState(null) // 「🔍 关联经营」展开的那张卡（默认折叠：客人不会告诉你为什么）

  // 关联经营反查：这条评价的 cause 来自本组哪项决策、当时选了什么（规格 §5「真实感 × 教学价值」的平衡点）
  function traceOf(r) {
    const id = r.relatedDecision
    if (!id) return null
    const meta = DEC_CATALOG.find(x => x.id === id)
    const ans = (decisions || {})[id]
    return {
      name: meta ? `${meta.icon} ${meta.name}` : id,
      ans: Array.isArray(ans) ? ans.join('、') : (ans == null ? '' : String(ans)),
    }
  }
  const [feedback, setFeedback] = useState(null)

  // 口碑是流动的：处理完一条评价后，有概率有新客人发布评价（好评率越高新好评越多）
  // 口碑页即时评价：与结算/实时同一套结构化生成（身份自洽 + cause 绑定决策 + 房型天数）
  // 随机源独立（guestsRng，种子含时间）——绝不消耗结算 rand、也不受固定种子约束（这是"当场新发生"）
  function spawnRelated(forceGood) {
    const goodPct = (latest ? latest.finalGoodRate : 70) / 100
    const roll = Math.random()
    const isGood = forceGood || roll < goodPct
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const rnd = guestsRng((Date.now() ^ 0x9E3779B9) >>> 0)
    const occPct = latest && Number.isFinite(Number(latest.occupancy)) ? Number(latest.occupancy) : 70
    const rv = makeReview({
      decisions: decisions || {},
      state: { attrs: attrs || {}, occupancy: occPct, price: (latest && latest.price) || 230 },
      week: week || 1,
      stars: isGood ? 5 : 2,                       // 差评星级在「语气分级」一步统一挂经营状态
      rnd,
      recent: reviews.map(x => String(x.text || '').replace(/^「|」$/g, '')).slice(-10),
    })
    setReviews(reviews => [...reviews, {
      id: 'flow-' + Date.now(), avatar: rv.guest.avatar, bg: isGood ? 'green' : 'blue',
      name: rv.guest.card, date: `入住${rv.guest.nights}天 · 刚刚 ${hh}:${mm}`,
      stars: rv.stars, text: `「${rv.text}」`, status: isGood ? 'good' : 'pending',
      guest: rv.guest, cause: rv.cause, roomType: rv.roomType, nights: rv.nights,
      relatedDecision: rv.relatedDecision, source: 'spawn',
    }])
  }

  // 持久化差评处理状态
  useEffect(() => {
    try { localStorage.setItem(REVIEW_KEY, JSON.stringify(reviews)) } catch (e) {}
  }, [reviews])

  // 真实好评率：优先本周结算，其次历史各周平均
  const latest = report || (history.length ? history[history.length - 1] : null)
  const goodRatePct = latest ? latest.finalGoodRate : null

  const pending = reviews.filter(r => r.status === 'pending')
  const resolved = reviews.filter(r => r.status === 'resolved')
  const good = reviews.filter(r => r.status === 'good')
  const ignoredCount = reviews.filter(r => r.status === 'ignored').length
  // 处理率口径：已忽略的差评也算"没处理"（不作为不是免罚）
  const handleRate = Math.round((resolved.length / (pending.length + resolved.length + ignoredCount || 1)) * 100)
  // 今日已处理数：resolvedAt 为今天的已解决差评
  const todayStr = new Date().toDateString()
  const todayResolved = resolved.filter(r => r.resolvedAt && new Date(r.resolvedAt).toDateString() === todayStr).length

  // 自由话术提交：词云内核评分，敷衍的回复等于没回复
  function submitReply() {
    const { review: r, isGood } = replying
    const text = replyText.trim()
    if (!text) return
    if (isGood) {
      const { tier } = scoreGoodReply(text)
      setReviews(reviews.map(x => x.id === r.id ? { ...x, goodReplyText: text, goodReplyTier: tier } : x))
      setReplying(null); setReplyText('')
      setFeedback({
        title: `回复「${r.name.split(' ·')[0]}」的好评`,
        changes: tier === 'warm'
          ? [{ label: '客人回复', value: '很暖心，说下次一定还来', dir: 'up' }, { label: '口碑', value: '忠诚客人+1', dir: 'up' }]
          : tier === 'ok'
            ? [{ label: '客人回复', value: '客气地回了个笑脸', dir: '' }]
            : [{ label: '客人回复', value: '没有再回复', dir: 'down' }],
        note: tier === 'warm' ? '真诚的感谢会让好评客人变成回头客。' : tier === 'ok' ? '礼貌有余、温度不足。' : '连感谢都懒得写，客人的热情被泼了冷水。',
      })
      if (tier === 'warm' && Math.random() < 0.35) {
        // 口碑流动的正向支线：被暖到的客人会介绍朋友来
        setTimeout(() => {
          const name = '转介绍客人 · ' + (reviews[0] ? reviews[0].name.split(' ·')[0] + '的朋友' : '新客人')
          setReviews(reviews => [...reviews, {
            id: 'ref-' + Date.now(), avatar: '🧑', bg: 'green',
            name, date: '刚刚', stars: 5,
            text: '「朋友说他家住得很好，特意订了这家，果然没让我失望！」',
            status: 'good',
          }])
        }, 2000)
      }
      return
    }
    const { tier } = scoreNegativeReply(text)
    if (tier === 'poor') {
      // 敷衍/推责的回复：差评仍是待处理状态（等于没回复）
      setReviews(reviews.map(x => x.id === r.id ? { ...x, poorReplyText: text } : x))
      setReplying(null); setReplyText('')
      setFeedback({
        title: `回复「${r.name.split(' ·')[0]}」的差评`,
        changes: [
          { label: '客人回复', value: '更加生气了，扬言发帖曝光', dir: 'down' },
          { label: '差评状态', value: '仍是待处理', dir: 'down' },
          { label: '发酵风险', value: '↑', dir: 'down' },
        ],
        note: '客人认为你的回复毫无诚意——差评没有解决，继续计入发酵风险。换个有诚意的写法再试一次。',
      })
      return
    }
    setReviews(reviews.map(x => x.id === r.id ? { ...x, status: 'resolved', replyText: text, replyTier: tier, resolvedAt: new Date().toISOString() } : x))
    const newResolved = resolved.length + 1
    const newRate = Math.round((newResolved / (pending.length - 1 + newResolved || 1)) * 100)
    setReplying(null); setReplyText('')
    const reaction = tier === 'excellent'
      ? { label: '客人回复', value: '态度缓和，接受了补偿方案并修改了评价', dir: 'up' }
      : tier === 'good'
        ? { label: '客人回复', value: '表示可以接受，事件就此解决', dir: 'up' }
        : { label: '客人回复', value: '勉强接受，但表示不会再来了', dir: 'down' }
    setFeedback({
      title: `回复「${r.name.split(' ·')[0]}」的差评`,
      changes: [reaction, { label: '差评处理率', value: newRate + '%', dir: 'up' }, { label: '负面影响', value: tier === 'fair' ? '部分生效' : '减半', dir: 'up' }],
      note: tier === 'excellent' ? '道歉、补偿、解决措施、时效全都到位——教科书级的差评回复。' : tier === 'good' ? '有诚意、有措施，客人的情绪基本被安抚。' : '解决了，但缺少让人回头的诚意。',
    })
    if (Math.random() < 0.5) setTimeout(spawnRelated, 2500) // 口碑流动：处理妥当后新客人发布评价
  }

  function handleResolve(r) {
    setReviews(reviews.map(x => x.id === r.id ? { ...x, status: 'resolved', resolvedAt: new Date().toISOString() } : x))
    setFeedback({
      title: `标记整改「${r.name.split(' ·')[0]}」`,
      changes: [
        { label: '差评处理率', value: '↑', dir: 'up' },
        { label: '满意度', value: '+3', dir: 'up' },
        { label: '差评状态', value: '已解决', dir: 'up' },
      ],
      note: '整改完成，差评转为已解决。差评处理率直接影响最终评分（占15%权重）。',
    })
    if (Math.random() < 0.4) setTimeout(spawnRelated, 2500)
  }

  function handleIgnore(r) {
    setReviews(reviews.map(x => x.id === r.id ? { ...x, status: 'ignored' } : x))
    setFeedback({
      title: `不处理「${r.name.split(' ·')[0]}」的差评`,
      changes: [
        { label: '负面影响', value: '全额生效', dir: 'down' },
        { label: '好评率', value: '↓', dir: 'down' },
        { label: '发酵风险', value: '↑', dir: 'down' },
      ],
      note: '差评不处理 → 好评率下降 → 客流下降 → 营收下降。这是"不作为的代价"。',
    })
  }

  function starStr(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n)
  }

  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">口碑</span></div>
        <div className="sub">
          {goodRatePct != null ? `好评率 ${goodRatePct}% · ` : ''}差评处理率 {handleRate}%
        </div>
      </div>

      {/* 口碑构成拆解：三指标联动关系 + 当前值（课堂讲解口碑体系用） */}
      {(() => {
        // 🔴 A2（2026-09-22）：原「满意度 = 好评率 × 1.1」是无依据的派生（与经营页 RPG 属性的注释自相矛盾——
        //    那边已声明"满意度"被三属性替代）。本卡是教学图解（处理率→好评率→客人体验 三联），保留三联但
        //    第三格改为【客人体验】= 好评率 + 士气/4（士气 65 中性 ≈ +16，封顶 100）—— 口径可解释、且真正用上属性池。
        const satisfaction = goodRatePct != null
          ? Math.min(100, Math.round(goodRatePct + (Number(attrs?.morale) || 65) / 4))
          : null
        const goodColor = goodRatePct == null ? '#9CA3AF' : goodRatePct >= 80 ? '#16A34A' : goodRatePct >= 60 ? '#E8940F' : '#DC2626'
        const handleColor = handleRate >= 80 ? '#16A34A' : handleRate >= 50 ? '#E8940F' : '#DC2626'
        const box = (label, val, color) => (
          <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{label}</div>
          </div>
        )
        return (
          <div className="card" style={{ background: '#F8FAFC' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#A96407', marginBottom: 8 }}>🧩 口碑构成拆解（三个指标怎么互相影响）</div>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              {box('差评处理率', handleRate + '%', handleColor)}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#A96407' }}>➜</span>
                <span style={{ fontSize: 8, color: '#9CA3AF' }}>拖后腿</span>
              </div>
              {box('好评率', (goodRatePct ?? '—') + '%', goodColor)}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#A96407' }}>➜</span>
                <span style={{ fontSize: 8, color: '#9CA3AF' }}>衍生出</span>
              </div>
              {box('客人体验', satisfaction != null ? satisfaction + '%' : '—', goodColor)}
            </div>
            <div style={{ fontSize: 10, color: '#6B7280', marginTop: 8, lineHeight: 1.7 }}>
              欠着差评不处理 → 好评率被拖下水 → 客人体验跟着跌 → 客流流失。<b>处理率是口碑的源头活水</b>：处理一条，三个指标一起止血。
            </div>
          </div>
        )
      })()}

      {/* 差评处理率进度条（评分权重15%的可视化） */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: handleRate + '%', background: handleRate >= 80 ? '#16A34A' : handleRate >= 50 ? '#E8940F' : '#DC2626', borderRadius: 3, transition: 'width 0.5s' }}></div>
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
          处理率占最终评分 15% 权重 · {handleRate >= 80 ? '处理很及时，继续保持' : '及时回复/整改差评可以提升处理率'}
          {todayResolved > 0 && <b style={{ color: '#16A34A' }}> · 今天已处理 {todayResolved} 条 ✓</b>}
        </div>
        {/* 发酵预警：欠2条以上差评会触发危机事件（与引擎 minPending:2 对应） */}
        {pending.length === 1 && (
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#A96407', background: '#FFF4E0', border: '1px solid #FDE68A', borderRadius: 8, padding: '6px 10px' }}>
            ⚠ 再欠 1 条差评就到发酵危险区（欠 2 条以上会触发「差评发酵」危机，口碑额外受损）
            {todayResolved > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', marginTop: 3 }}>💪 今天已处理 {todayResolved} 条——照这个节奏马上就脱离危险区</div>}
          </div>
        )}
        {pending.length >= 2 && (
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px' }}>
            🔴 已欠 {pending.length} 条差评——已在发酵危机触发区！每多欠一条，口碑受损越重，立即处理
            {todayResolved > 0 && <div style={{ fontSize: 10, fontWeight: 600, color: '#16A34A', marginTop: 3 }}>💪 今天已处理 {todayResolved} 条——每处理一条，预警就会降级</div>}
          </div>
        )}
        {/* 好评率走势迷你图（历史各周，≥3周才画） */}
        {(() => {
          const pts = (history || []).map(h => ({ w: h.week, v: h.finalGoodRate, wk: h.week != null ? h.week : 0 }))
          if (pts.length < 3) return null
          const W = 320, H = 40, PL = 6, PR = 6, PT = 4, PB = 4
          const lo = Math.min(...pts.map(p => p.v)) - 3
          const hi = Math.max(...pts.map(p => p.v)) + 3
          const span = (hi - lo) || 1
          const x = i => PL + i * (W - PL - PR) / (pts.length - 1)
          const y = v => H - PB - ((v - lo) / span) * (H - PT - PB)
          const rising = pts[pts.length - 1].v >= pts[0].v
          const color = pts[pts.length - 1].v >= 80 ? '#16A34A' : pts[pts.length - 1].v >= 60 ? '#E8940F' : '#DC2626'
          // 最低点标注（定位口碑最差周，复盘锚点）
          let minIdx = 0
          pts.forEach((p, i) => { if (p.v < pts[minIdx].v) minIdx = i })
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 2 }}>好评率走势（历史各周{rising ? '，整体↑' : '，整体↓'}）</div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
                <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="#F3F4F6" strokeWidth="1" />
                <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <text key={'w' + i} x={p.x != null ? p.x : x(i)} y={H - 3} fontSize="7" fill="#9CA3AF" textAnchor="middle">W{i + 1}</text>
                ))}
                {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="2.5" fill="#fff" stroke={color} strokeWidth="1.5" />)}
                <text x={PL} y={8} fontSize="8" fill="#9CA3AF">当前 {pts[pts.length - 1].v}%</text>
                {minIdx > 0 && minIdx < pts.length - 1 && (
                  <text x={x(minIdx)} y={y(pts[minIdx].v) - 5} fontSize="8" fontWeight="700" fill="#DC2626" textAnchor="middle">↓{pts[minIdx].v}% 第{pts[minIdx].w}周</text>
                )}
                {pts[minIdx].v < 60 && <circle cx={x(minIdx)} cy={y(pts[minIdx].v)} r="4" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="2 2" />}
              </svg>
            </div>
          )
        })()}
      </div>

      {/* 处理率圆环 */}
      <div className="card" style={{display:'flex',alignItems:'center',gap:16,padding:16}}>
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r="30" fill="none" stroke="#F3F4F6" strokeWidth="7"/>
          <circle cx="36" cy="36" r="30" fill="none" stroke={handleRate >= 80 ? '#10B981' : handleRate >= 50 ? '#E8940F' : '#EF4444'} strokeWidth="7"
            strokeDasharray={`${handleRate / 100 * 188.5} 188.5`} strokeLinecap="round"
            transform="rotate(-90 36 36)" style={{transition:'stroke-dasharray 0.8s ease'}}/>
          <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="#374151">{handleRate}%</text>
        </svg>
        <div>
          <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>差评处理率</div>
          <div style={{fontSize:11,color:'#6B7280'}}>占期末评分 15% 权重<br/>及时回复差评提高处理率</div>
        </div>
      </div>

      <div className="card" style={{background:'#FFF4E0',borderColor:'#FBE3B3',textAlign:'center',padding:18}}>
        <div style={{fontSize:40,fontWeight:700,color:'#A96407'}}>
          {goodRatePct != null ? (goodRatePct / 20).toFixed(1) : '—'}
        </div>
        <div key={goodRatePct} className="stars-big stars-pop" style={{fontSize:20,letterSpacing:2,marginTop:4}}>
          {goodRatePct != null ? '★'.repeat(Math.max(1, Math.round(goodRatePct / 20))) + '☆'.repeat(5 - Math.max(1, Math.round(goodRatePct / 20))) : '☆☆☆☆☆'}
        </div>
        <div style={{fontSize:12,color:'#A96407',marginTop:6}}>
          {goodRatePct != null ? `${goodRatePct}% 好评率` : '完成首次结算后显示好评率'} · 差评处理率 {handleRate}%
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className="section-title"><span className="left">待回复差评 ({pending.length})</span></div>
          {pending.map(r => (
            <div className="card" key={r.id}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:r.bg==='blue'?'#EFF6FF':'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{r.name}</div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}{r.roomType ? ` · 🛏 ${r.roomType}${r.nights ? ` · 入住${r.nights}天` : ''}` : ''}</div>
                </div>
                <div style={{fontSize:13,color:'#E8940F'}}>{starStr(r.stars)}</div>
              </div>
              <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
              {(() => {
                const tr = traceOf(r)
                if (!tr) return null
                const open = openTrace === r.id
                return (
                  <>
                    <button className="btn btn-ghost" style={{fontSize:11,padding:'3px 10px',marginTop:8}}
                      onClick={() => setOpenTrace(open ? null : r.id)}>
                      {open ? '🔍 收起关联经营' : '🔍 关联经营'}
                    </button>
                    {open && (
                      <div style={{fontSize:11,color:'#4B5563',background:'#F9FAFB',border:'1px solid #E5E7EB',borderRadius:6,padding:'7px 9px',marginTop:6,lineHeight:1.6}}>
                        来源：本组「{tr.name}」{tr.ans ? <> 选择了 <b>{tr.ans}</b></> : '（本周未提交）'} —— 客人不会告诉你为什么，这里说给你听。
                      </div>
                    )}
                  </>
                )
              })()}
              {r.source && (
                <div style={{fontSize:10,color:'#991B1B',background:'#FEF2F2',borderRadius:5,padding:'3px 8px',marginTop:6,display:'inline-block'}}>
                  来源：{r.source.icon} {r.source.name}——这条差评本可避免
                </div>
              )}
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => setReplying({ review: r, isGood: false })}>💬 回复</button>
                <button className="btn btn-ghost" style={{flex:1}} onClick={() => handleResolve(r)}>🔧 整改</button>
                <button className="btn btn-ghost" style={{flex:1, color:'#EF4444'}} onClick={() => handleIgnore(r)}>不处理</button>
              </div>
            </div>
          ))}
        </>
      )}

      {pending.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '18px', background: '#EAF9F0' }}>
          <div style={{ fontSize: 26 }}>👍</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46', marginTop: 4 }}>暂无待处理差评</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>口碑很好，保持当前服务标准</div>
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <div className="section-title"><span className="left">已处理 ({resolved.length})</span></div>
          {resolved.map(r => (
            <div className="card" style={{opacity:0.6}} key={r.id}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{r.name} <span style={{fontSize:11,color:'#10B981'}}>✓已解决</span>{r.replyTier && <span style={{fontSize:10,background:r.replyTier==='excellent'?'#ECFDF5':r.replyTier==='good'?'#F0FDF4':'#F9FAFB',color:r.replyTier==='excellent'?'#065F46':r.replyTier==='good'?'#16A34A':'#6B7280',borderRadius:5,padding:'1px 6px',marginLeft:5}}>{r.replyTier==='excellent'?'回复：非常出色':r.replyTier==='good'?'回复：有诚意':'回复：一般'}</span>}</div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}{r.roomType ? ` · 🛏 ${r.roomType}${r.nights ? ` · 入住${r.nights}天` : ''}` : ''}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
              {r.replyText && (
                <div style={{fontSize:11,color:'#1E40AF',background:'#EFF6FF',borderRadius:8,padding:'6px 10px',marginTop:6,lineHeight:1.6}}>
                  <span style={{color:'#9CA3AF'}}>我的回复：</span>{r.replyText}
                </div>
              )}
              {r.source && (
                <div style={{fontSize:10,color:'#9CA3AF',background:'#F9FAFB',borderRadius:5,padding:'3px 8px',marginTop:6,display:'inline-block'}}>
                  来源：{r.source.icon} {r.source.name}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <div className="section-title"><span className="left">近期好评</span></div>
      {good.map(r => (
        <div className="card" key={r.id}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{r.name}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}{r.roomType ? ` · 🛏 ${r.roomType}${r.nights ? ` · 入住${r.nights}天` : ''}` : ''}</div>
            </div>
            <div style={{fontSize:13,color:'#E8940F'}}>{starStr(r.stars)}</div>
          </div>
          <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
          {r.goodReplyText && (
            <div style={{fontSize:11,color:'#065F46',background:'#EAF9F0',borderRadius:8,padding:'6px 10px',marginTop:6,lineHeight:1.6}}>
              <span style={{color:'#9CA3AF'}}>我的回复：</span>{r.goodReplyText}
            </div>
          )}
          {!r.goodReplyText && (
            <button className="btn btn-ghost" style={{marginTop:8,padding:'8px 0',fontSize:12,width:'100%'}} onClick={() => { setReplyText(''); setReplying({ review: r, isGood: true }) }}>💬 回复感谢</button>
          )}
        </div>
      ))}

      {/* 差评来源分析（教学：帮你理解为什么挨差评） */}
      {(() => {
        const causes = []
        // 从历史数据推导差评来源
        if (history && history.length > 0) {
          const last = history[history.length - 1]
          if (last.decisions) {
            const d = last.decisions
            if (d.shifts === '精简省成本') causes.push({ icon: '🛏️', text: '排班精简 → 服务响应慢' })
            if (d.hygiene !== '停房深清洁') causes.push({ icon: '🧹', text: '未做深清洁 → 卫生投诉' })
            if (d.energy != null && (d.energy <= 21 || d.energy >= 25)) causes.push({ icon: '🌡️', text: `空调${d.energy}℃ → 舒适度差` })
            if (d.linen === '外包') causes.push({ icon: '🧺', text: '外包布草 → 品质不稳定' })
            if (d.pricing === '降价 20% 抢客') causes.push({ icon: '💸', text: '大幅降价 → 客群素质下降' })
          }
          if (last.overbookCompensation > 0) causes.push({ icon: '🛏️', text: '超售到店无房 → 赔偿+差评' })
        }
        if (causes.length === 0) return null
        return (
          <div className="card" style={{ background: '#FFF4E0', borderColor: '#FBE3B3' }}>
            <div className="card-title" style={{ color: '#A96407' }}>🔍 差评来源分析</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>你的经营决策直接影响了差评类型——改掉源头才能止血</div>
            {causes.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                <span style={{ flexShrink: 0 }}>{c.icon}</span>
                <span style={{ fontSize: 12, color: '#991B1B' }}>{c.text}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* 已忽略的差评（默认折叠只显示计数，点击展开看代价） */}
      {reviews.filter(r => r.status === 'ignored').length > 0 && (
        <>
          <div className="section-title" style={{ cursor: 'pointer' }} onClick={() => setShowIgnored(!showIgnored)}>
            <span className="left">已忽略 {reviews.filter(r => r.status === 'ignored').length} 条 {showIgnored ? '▲' : '▼'}<span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400, marginLeft: 6 }}>（点击展开查看代价）</span></span>
          </div>
          {showIgnored && reviews.filter(r => r.status === 'ignored').map(r => (
            <div className="card" style={{opacity:0.9}} key={r.id}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#F3F4F6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{r.name} <span style={{fontSize:11,color:'#EF4444'}}>✗已忽略</span></div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}</div>
                </div>
                <div style={{fontSize:13,color:'#9CA3AF'}}>{starStr(r.stars)}</div>
              </div>
              <div style={{fontSize:13,color:'#1F2937',lineHeight:1.6}}>{r.text}</div>
              <div style={{fontSize:11,color:'#EF4444',marginTop:6,fontWeight:600}}>这条差评的负面影响全额生效且持续发酵</div>
            </div>
          ))}
        </>
      )}

      {/* 回复弹窗：自由话术 + 快捷填入（评分规则不显示） */}
      {replying && (
        <div
          onClick={() => setReplying(null)}
          style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 24px'}}
        >
          <div onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:22,width:'100%',maxHeight:'82vh',overflowY:'auto',animation:'pageIn 0.2s ease-out'}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:6}}>{replying.isGood ? '回复好评' : '回复差评'}</div>
            <div style={{fontSize:12,color:'#374151',lineHeight:1.6,padding:'8px 12px',background:'#F9FAFB',borderRadius:8,marginBottom:10}}>
              {replying.review.text}
            </div>
            <div style={{fontSize:11,color:'#9CA3AF',marginBottom:8}}>
              💡 用你自己的话回复这位客人。怎么说、说什么由你决定——客人会感受到诚意，也会感受到敷衍。
            </div>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={replying.isGood ? '写一段感谢的话……' : '写下你的回复话术（道歉？补偿？解决措施？由你决定）……'}
              rows={5}
              style={{width:'100%',padding:'10px 12px',border:'1px solid #E5E7EB',borderRadius:10,fontSize:13,lineHeight:1.6,resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}}
            />
            <div style={{fontSize:10,color:'#9CA3AF',marginBottom:6}}>快捷话术（点击填入，可自行修改）：{replyText.replace(/\s/g,'').length} 字</div>
            {(replying.isGood ? quickGoodReplies : quickNegReplies).map((q, i) => (
              <div key={i} onClick={() => setReplyText(q)} style={{fontSize:11,color:'#374151',padding:'7px 10px',background:'#F9FAFB',borderRadius:8,marginBottom:6,cursor:'pointer',lineHeight:1.5}}>
                {q.slice(0, 42)}{q.length > 42 ? '…' : ''}
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:10}}>
              <button className="btn btn-ghost" style={{flex:1}} onClick={() => setReplying(null)}>取消</button>
              <button className="btn-confirm" style={{flex:2,opacity:replyText.trim()?1:0.5}} disabled={!replyText.trim()} onClick={submitReply}>发送回复</button>
            </div>
          </div>
        </div>
      )}

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
