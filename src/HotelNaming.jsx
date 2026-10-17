// V114-P1 · 酒店命名页（进入经营前的**一次承诺动作**）—— 空名/重名都过不去
import { useState } from 'react'
import { 校验酒店名, 查重, 名字最短, 名字最长 } from './hotelName.mjs'

export default function HotelNaming({ 已有 = [], onCreate, 默认名 = '' }) {
  const [文本, set文本] = useState(默认名)
  const [错误, set错误] = useState('')
  const 校 = 校验酒店名(文本)
  const 重 = 校.ok ? 查重(文本, 已有) : { 重名: false }
  const 可提交 = 校.ok && !重.重名

  const 提交 = () => {
    if (!校.ok) { set错误(校.原因); return }
    if (重.重名) { set错误(`该名已被${重.组 ? ' ' + 重.组 + ' ' : '其他组'}使用`); return }
    set错误('')
    onCreate(校.值)
  }

  return (
    <div className="content">
      <div className="header">
        <div className="row1"><span className="hotel-name">给你的酒店取名</span></div>
        <div className="sub">这一步只做一次 · 取名后不可修改（与《开店宣言》同纪律）</div>
      </div>
      <div style={{ padding: '16px 20px 24px' }}>
        <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.7, marginBottom: 10 }}>
          从今天起，这家酒店就挂这个名字：教师端的排名、流水、周报都用它来认你的组。
        </div>
        <input
          value={文本}
          onChange={e => { set文本(e.target.value); set错误('') }}
          onKeyDown={e => { if (e.key === 'Enter' && 可提交) 提交() }}
          placeholder={`${名字最短}–${名字最长} 字，例如「云悦锦江店」`}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: `1px solid ${可提交 ? 'var(--border)' : 'var(--warn-border)'}`, fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <div style={{ fontSize: 12, marginTop: 6, color: 可提交 ? 'var(--good)' : (重.重名 ? 'var(--bad)' : 'var(--text-muted)') }}>
          {重.重名
            ? `该名已被${重.组 ? ' ' + 重.组 + ' ' : '其他组'}使用 —— 换一个`
            : (校.ok ? '这个名字可用' : (文本 ? 校.原因 : `空名不能进入经营（${名字最短}–${名字最长} 字）`))}
        </div>
        {错误 && <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 4 }}>{错误}</div>}
        <button
          className="btn-confirm"
          style={{ width: '100%', marginTop: 16, opacity: 可提交 ? 1 : 0.5 }}
          disabled={!可提交}
          onClick={提交}
        >
          {可提交 ? `就叫「${校.值}」，进入经营 →` : '先取一个 2–12 字、没被用过的名字'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
          取名后不可修改；如需重置，请老师在教师端处理（随存档一起清）
        </div>
      </div>
    </div>
  )
}
