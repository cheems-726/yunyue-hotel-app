// V133 · 全屏播放器：iframe 同源 + 顶部返回；卸载即停（不留后台 iframe）
// ★ V152 §3：native 形态直接渲染组件（断网可玩 · 不进结算 · 只写 游戏记录）
import PriceElastic from './games/PriceElastic.jsx'

// V133 · 全屏播放器：iframe 同源 + 顶部返回；卸载即停（不留后台 iframe）
export default function GamePlayer({ 游戏, onBack, onRecord, 上周出租率 = null }) {
  if (游戏.形态 === 'native') {
    // ★ native 分支：不用 iframe（X5 内核/断网都稳）；组件自带全屏壳与返回
    return <PriceElastic onBack={onBack} onRecord={onRecord} 上周出租率={上周出租率} />
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 90, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#111', color: '#fff' }}>
        <button onClick={onBack} style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 16, minWidth: 44, minHeight: 44, fontFamily: 'inherit' }}>‹ 返回</button>
        <span style={{ fontSize: 12, opacity: .85 }}>{游戏.名称}</span>
      </div>
      <iframe
        title={游戏.名称}
        src={游戏.入口}
        style={{ flex: 1, width: '100%', border: 0, background: '#000' }}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      />
    </div>
  )
}
