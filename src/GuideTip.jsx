import { useState } from 'react'

// V66 · 学生首次使用引导（一次性可关提示条 · 非弹窗不挡屏）
// 判据同源：认领/筹建步数复用组件内 step/currentStep（V54 状态机）· 决策"维持现状"文案与 settlement.js:887 同源
// 持久化：localStorage `hotel-guide-<k>` = '1' ⇒ 关闭后不再出现；guideResetAll() 一键重看
const KEY = k => `hotel-guide-${k}`
export function guideSeen(k) { try { return localStorage.getItem(KEY(k)) === '1' } catch (e) { return true } }
export function guideClose(k) { try { localStorage.setItem(KEY(k), '1') } catch (e) {} }
export function guideResetAll() {
  try { Object.keys(localStorage).filter(x => x.startsWith('hotel-guide-')).forEach(x => localStorage.removeItem(x)) } catch (e) {}
}

export default function GuideTip({ k, children }) {
  const [gone, setGone] = useState(guideSeen(k))
  if (gone) return null
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--primary-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, margin: '10px 20px 4px' }}>
      <span style={{ flex: 1 }}>{children}</span>
      <button aria-label="关闭本条引导" onClick={() => { guideClose(k); setGone(true) }} style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', lineHeight: 1 }}>×</button>
    </div>
  )
}
