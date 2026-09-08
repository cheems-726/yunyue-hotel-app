import React, { useState, useEffect } from 'react'
import ResultFeedback from './ResultFeedback.jsx'

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

// 回复策略（对应能力点18：态度/专业性/解决措施三维度评分）
const replyStrategies = [
  { label: '真诚道歉 + 赔偿', score: 90, note: '态度好、有实质补偿，客人满意' },
  { label: '解释原因 + 整改', score: 80, note: '专业性强，给出解决措施' },
  { label: '模板回复', score: 40, note: '显得敷衍，扣态度和专业性分' },
]

export default function Reputation({ report, history }) {
  const [reviews, setReviews] = useState(loadReviews)
  const [replying, setReplying] = useState(null) // 正在回复的差评
  const [feedback, setFeedback] = useState(null)

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
  const handleRate = Math.round((resolved.length / (pending.length + resolved.length || 1)) * 100)

  function handleReply(r, strategy) {
    setReviews(reviews.map(x => x.id === r.id ? { ...x, status: 'resolved', replyScore: strategy.score } : x))
    // 用更新后的列表计算处理率，避免显示过期值
    const newResolved = resolved.length + 1
    const newRate = Math.round((newResolved / (pending.length - 1 + newResolved || 1)) * 100)
    setReplying(null)
    setFeedback({
      title: `回复「${r.name.split(' ·')[0]}」的差评`,
      changes: [
        { label: '处理得分', value: strategy.score + ' 分', dir: strategy.score >= 80 ? 'up' : 'down' },
        { label: '差评处理率', value: newRate + '%', dir: 'up' },
        { label: '负面影响', value: '减半', dir: 'up' },
      ],
      note: `${strategy.label} → ${strategy.note}。按时回复的差评负面影响减半，处理得当能挽回口碑。`,
    })
  }

  function handleResolve(r) {
    setReviews(reviews.map(x => x.id === r.id ? { ...x, status: 'resolved' } : x))
    setFeedback({
      title: `标记整改「${r.name.split(' ·')[0]}」`,
      changes: [
        { label: '差评处理率', value: '↑', dir: 'up' },
        { label: '满意度', value: '+3', dir: 'up' },
        { label: '差评状态', value: '已解决', dir: 'up' },
      ],
      note: '整改完成，差评转为已解决。差评处理率直接影响最终评分（占15%权重）。',
    })
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

      {/* 差评处理率进度条（评分权重15%的可视化） */}
      <div style={{ padding: '0 20px 12px' }}>
        <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: handleRate + '%', background: handleRate >= 80 ? '#16A34A' : handleRate >= 50 ? '#E8940F' : '#DC2626', borderRadius: 3, transition: 'width 0.5s' }}></div>
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
          处理率占最终评分 15% 权重 · {handleRate >= 80 ? '处理很及时，继续保持' : '及时回复/整改差评可以提升处理率'}
        </div>
      </div>

      <div className="card" style={{background:'#FFF4E0',borderColor:'#FBE3B3',textAlign:'center',padding:18}}>
        <div style={{fontSize:40,fontWeight:700,color:'#A96407'}}>
          {goodRatePct != null ? (goodRatePct / 20).toFixed(1) : '—'}
        </div>
        <div style={{fontSize:20,letterSpacing:2,marginTop:4}}>
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
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}</div>
                </div>
                <div style={{fontSize:13,color:'#E8940F'}}>{starStr(r.stars)}</div>
              </div>
              <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
              <div style={{display:'flex',gap:6,marginTop:10}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => setReplying(r)}>💬 回复</button>
                <button className="btn btn-ghost" style={{flex:1}} onClick={() => handleResolve(r)}>🔧 整改</button>
                <button className="btn btn-ghost" style={{flex:1, color:'#EF4444'}} onClick={() => handleIgnore(r)}>不处理</button>
              </div>
            </div>
          ))}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <div className="section-title"><span className="left">已处理 ({resolved.length})</span></div>
          {resolved.map(r => (
            <div className="card" style={{opacity:0.6}} key={r.id}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <div style={{width:36,height:36,borderRadius:'50%',background:'#ECFDF5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{r.name} <span style={{fontSize:11,color:'#10B981'}}>✓已解决</span>{r.replyScore != null && <span style={{fontSize:10,background:'#ECFDF5',color:'#065F46',borderRadius:5,padding:'1px 6px',marginLeft:5}}>回复得分 {r.replyScore}</span>}</div>
                  <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}</div>
                </div>
              </div>
              <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
            </div>
          ))}
        </>
      )}

      <div className="section-title"><span className="left">近期好评</span></div>
      {good.map(r => (
        <div className="card" style={{opacity:0.7}} key={r.id}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'#EFF6FF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{r.avatar}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{r.name}</div>
              <div style={{fontSize:11,color:'#9CA3AF'}}>{r.date}</div>
            </div>
            <div style={{fontSize:13,color:'#E8940F'}}>{starStr(r.stars)}</div>
          </div>
          <div style={{fontSize:13,color:'#374151',lineHeight:1.5}}>{r.text}</div>
        </div>
      ))}

      {/* 回复策略弹窗 */}
      {replying && (
        <div
          onClick={() => setReplying(null)}
          style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.4)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 32px'}}
        >
          <div onClick={e => e.stopPropagation()} style={{background:'#fff',borderRadius:20,padding:24,width:'100%',animation:'pageIn 0.2s ease-out'}}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>回复差评</div>
            <div style={{fontSize:12,color:'#6B7280',marginBottom:16}}>选择回复策略（态度/专业性/解决措施影响得分）</div>
            {replyStrategies.map(s => (
              <div
                key={s.label}
                className="district-card"
                style={{padding:12,marginBottom:8}}
                onClick={() => handleReply(replying, s)}
              >
                <div style={{fontSize:14,fontWeight:600}}>{s.label}</div>
                <div style={{fontSize:11,color:'#A96407',marginTop:4}}>得分 {s.score} · {s.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedback && <ResultFeedback result={feedback} onClose={() => setFeedback(null)} />}
    </div>
  )
}
