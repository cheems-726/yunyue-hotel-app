// V113-1.4 · 第 1 周对照（首次面对真实数据时，回头看你押了什么、漏了什么）
//   · 左：你押的（选址预言 / 承诺书 / 开店宣言）
//   · 右：第 1 周真实（出租率 / 平均房价 / RevPAR / 净利）
//   · 底：「我忽略了什么信号」——**必填**（≥ 理由最短 字）；填了才能进入第 2 周（客户端闸）
import { useState } from 'react'
import { 读宣言, 读反思, 写反思, 反思合格, 理由最短 } from './choiceReasons.mjs'

function 读选址() {
  try {
    const st = JSON.parse(localStorage.getItem('hotel-sim-state') || '{}')
    return { 预言: st.选址预言 || null, 承诺书: st.选址承诺书 || null, 区: st.location || null }
  } catch (e) { return { 预言: null, 承诺书: null, 区: null } }
}

export default function Week1Review({ result, onStatus }) {
  const [草稿, set草稿] = useState(() => (读反思(1) || {}).text || '')
  const 选址 = 读选址()
  const 宣言 = 读宣言()
  const 够了 = 反思合格(草稿)
  const 实际 = {
    occ: Number(result && result.occupancy),
    adr: Number(result && result.price),
    revpar: (Number(result && result.occupancy) || 0) * (Number(result && result.price) || 0),
    净利: Number(result && result.profit),
  }
  return (
    <div style={{ margin: '0 20px 14px', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>回头看你押了什么：第 1 周对照</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>开店前的判断 vs 第 1 周的真实数据 —— 对不上是正常的，关键是你漏了哪个信号。</div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4 }}>你押的</div>
          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text)' }}>
            {选址.区 && <div>选址：{选址.区.city || ''}{选址.区.district || ''}</div>}
            {选址.预言 && <div>预言：竞品 {选址.预言.竞品档 || '—'} · 租金 {选址.预言.租金档 || '—'}（置信度 {选址.预言.置信度 || '—'}）</div>}
            {选址.承诺书 && <div>承诺书：{String(选址.承诺书).slice(0, 80)}{String(选址.承诺书).length > 80 ? '…' : ''}</div>}
            {宣言 && <div>宣言·最大赌注：{宣言.最大赌注}</div>}
            {宣言 && <div>宣言·最怕：{宣言.最怕}</div>}
            {!选址.预言 && !宣言 && <div style={{ color: 'var(--text-muted)' }}>（开店前没留判断 —— 这一局少了一次对照的资料）</div>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4 }}>第 1 周真实</div>
          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text)' }}>
            <div>出租率：{Number.isFinite(实际.occ) ? (实际.occ * 100).toFixed(1) + '%' : '—'}</div>
            <div>平均房价：{Number.isFinite(实际.adr) ? 实际.adr + ' 元' : '—'}</div>
            <div>RevPAR：{Number.isFinite(实际.revpar) ? Math.round(实际.revpar) + ' 元' : '—'}</div>
            <div>净利：{Number.isFinite(实际.净利) ? Math.round(实际.净利) + ' 元' : '—'}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>我忽略了什么信号？</div>
        <textarea
          data-reflect="1"
          value={草稿}
          onChange={e => { set草稿(e.target.value); 写反思(1, e.target.value); if (onStatus) onStatus(反思合格(e.target.value)) }}
          onBlur={() => 写反思(1, 草稿)}
          rows={2}
          placeholder={`必填（≥ ${理由最短} 字）：例如——我只看了租金，没看竞品密度；我把旺季价格用在了淡季`}
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${够了 ? 'var(--border)' : 'var(--warn-border)'}`, fontSize: 16, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 12, color: 够了 ? 'var(--good)' : 'var(--warn)', marginTop: 4 }}>
          {够了 ? '已记录：可以进入第 2 周' : `还差 ${Math.max(0, 理由最短 - 草稿.trim().length)} 字 —— 不填不能进入第 2 周`}
        </div>
      </div>
    </div>
  )
}
