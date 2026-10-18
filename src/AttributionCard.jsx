// V113-2.5 · 归因题卡片（周报内 · **不卡关**）
import { useState } from 'react'
import { 归因选项, 读归因, 写归因, 判分 } from './attribution.mjs'
import { saveDecisionLog } from './supabaseClient.js'

export default function AttributionCard({ week, prev, cur, groupKey, userId }) {
  const [已, set已] = useState(() => 读归因(week))
  const r = 判分(week, prev, cur)
  if (!(week >= 2) || !prev) return null
  const 提交 = (k) => {
    const a = 写归因(week, k)
    if (!a) return
    set已(a)
    // 云端镜像（有会话才发；无会话不发 —— R109-2 纪律）→ 教师端 fetchDecisionLogs 可读
    saveDecisionLog({
      userId, groupKey, week, decisionId: `归因-W${week}`, answer: k,
      feedback: `本周归因：${k}（真值 ${判分(week, prev, cur).真值 || '—'}）`,
    // 静默理由：云端镜像属尽力而为；本机已记录，失败不打断周报
    }).catch(() => {})
  }
  const 选中 = 已 && 已.选择 ? 已.选择 : r.选择
  return (
    <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>归因：本周 RevPAR 变了，主要来自哪边？</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        RevPAR = 房价 × 出租率。「不填也能进下一周」，但「填了」本身就算过程分（答对再加）。
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {归因选项.map(o => (
          <button key={o.k} onClick={() => 提交(o.k)} data-attr={o.k}
            style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 16,
              border: 选中 === o.k ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: 选中 === o.k ? 'var(--primary-bg)' : 'var(--card)', color: 'var(--text)',
            }}>
            {o.名}
          </button>
        ))}
      </div>
      {r.填了 && (
        <div style={{ fontSize: 12, marginTop: 6, color: r.命中 ? 'var(--good)' : 'var(--text-sub)' }}>
          已记录 · 过程分 +{r.过程分}{r.命中 ? '（与真值一致）' : `（真值：${r.真值 || '—'}）`}
        </div>
      )}
    </div>
  )
}
