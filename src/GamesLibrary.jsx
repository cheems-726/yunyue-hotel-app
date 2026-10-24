// V133 · 小游戏列表页（只读 registry · 卡片竖排）
import { 游戏库 } from './games/registry.mjs'

export default function GamesLibrary({ onPlay, 已玩 = {} }) {   // ★ V152：已玩次数（state.游戏记录 · 只记录）
  return (
    <div style={{ padding: '8px 20px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>小游戏</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>随便玩，不影响成绩</div>
      {游戏库.map(g => (
        <div className="card" key={g.id} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{g.名称}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>{g.一句话}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>约 {g.时长}{已玩[g.id] ? ` · 已玩 ${已玩[g.id]} 次` : ''}</span>
            <button className="btn btn-primary" style={{ padding: '10px 18px', minHeight: 44 }} onClick={() => onPlay(g)}>开始</button>
          </div>
        </div>
      ))}
    </div>
  )
}
