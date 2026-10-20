// V133 · 全屏播放器：iframe 同源 + 顶部返回；卸载即停（不留后台 iframe）
export default function GamePlayer({ 游戏, onBack }) {
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
