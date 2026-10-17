// V113-1.3 · 共用「取舍句」面板（主选/物业/品牌/投资档 各一句"为什么不是另外两个"）
//   · 输入实时写入本机单源（`choiceReasons.写理由`），失焦也写一次
//   · 字数不足 ⇒ 当场标红并提示还差几个字（不拦流程 —— 拦的是《开店宣言》生成那一步）
import { useState } from 'react'
import { 写理由, 理由合格, 理由最短 } from './choiceReasons.mjs'

export default function WhyNot({ k, 名, 提示, 选项 = [], 初值 = '' }) {
  const [文本, set文本] = useState(初值 || '')
  const 够了 = 理由合格(文本)
  const 提交 = () => { 写理由(k, 文本) }
  return (
    <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'var(--bg)', border: `1px solid ${够了 ? 'var(--border)' : 'var(--warn-border)'}` }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>写一句：{名} 的取舍</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
        {提示 || '为什么不是另外两个？'}
        {选项.length > 0 && <span>（对比：{选项.join(' / ')}）</span>}
      </div>
      <textarea
        value={文本}
        onChange={e => { set文本(e.target.value); 写理由(k, e.target.value) }}
        onBlur={提交}
        rows={2}
        placeholder={`至少 ${理由最短} 字：说清你放弃了什么、为什么值得`}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 16, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
      />
      <div style={{ fontSize: 12, color: 够了 ? 'var(--good)' : 'var(--warn)', marginTop: 4 }}>
        {够了 ? '已记录（会进《开店宣言》，教师端可见）' : `还差 ${Math.max(0, 理由最短 - 文本.trim().length)} 字`}
      </div>
    </div>
  )
}
