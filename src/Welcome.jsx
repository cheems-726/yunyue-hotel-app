import React from 'react'

// 欢迎页：首次登录的引导，介绍整个经营流程
export default function Welcome({ user, onStart }) {
  const steps = [
    { icon: '🗺️', title: '选址', desc: '在成德绵片区选择你的酒店所在地' },
    { icon: '🏷️', title: '选品牌', desc: '从华住30+品牌中选择经营品牌' },
    { icon: '🏨', title: '认领酒店', desc: '走加盟流程，认领一家真实物业' },
    { icon: '🏗️', title: '筹建开业', desc: '投资/证照/采购/开业，从零开酒店' },
    { icon: '📈', title: '连续经营', desc: '12周经营，每周决策、结算、复盘' },
    { icon: '🏆', title: '最终评分', desc: '利润/口碑/出租率/差评处理四维评分' },
  ]

  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 欢迎区 */}
      <div style={{ textAlign: 'center', padding: '40px 20px 20px' }}>
        <div style={{ width: 88, height: 88, borderRadius: 28, background: '#FFF4E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(232,148,15,0.15)' }}>
          🏨
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.3px' }}>欢迎你，{user?.name}</div>
        <div style={{ fontSize: 14, color: '#6B7280', marginTop: 8, lineHeight: 1.6 }}>
          你将体验从零开始经营一家酒店的完整过程
        </div>
      </div>

      {/* 流程步骤 */}
      <div style={{ padding: '0 20px' }}>
        {steps.map((s, i) => (
          <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: i < steps.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: '#FFF4E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{i + 1}. {s.title}</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* 开始按钮 */}
      <div style={{ padding: '24px 20px 32px', marginTop: 'auto' }}>
        <button className="btn-confirm" onClick={onStart}>
          🚀 开始我的酒店之旅
        </button>
      </div>
    </div>
  )
}
