
// 六维属性雷达图（纯SVG，无依赖）：网格5层+轴线+数据多边形+顶点圆点
// 供选址页画像卡与确认浮层复用
export default function RadarChart({ attrs, size = 220 }) {
  const dims = ['客流', '房价', '租金', '竞争', '人力', '波动']
  const cx = 120, cy = 102, maxR = 66
  const pt = (i, v) => {
    const a = (-90 + i * 60) * Math.PI / 180
    return [cx + (v / 5) * maxR * Math.cos(a), cy + (v / 5) * maxR * Math.sin(a)]
  }
  const ring = v => dims.map((_, i) => pt(i, v).join(',')).join(' ')
  const labelPos = i => {
    const a = (-90 + i * 60) * Math.PI / 180
    const x = cx + (maxR + 15) * Math.cos(a)
    const y = cy + (maxR + 15) * Math.sin(a) + 4
    const c = Math.cos(a)
    return { x, y, anchor: c > 0.5 ? 'start' : c < -0.5 ? 'end' : 'middle' }
  }
  return (
    <svg viewBox="0 0 240 204" style={{ width: size, maxWidth: '100%', display: 'block', margin: '0 auto' }}>
      {[1, 2, 3, 4, 5].map(v => (
        <polygon key={v} points={ring(v)} fill={v === 5 ? '#F9FAFB' : 'none'} stroke={v === 5 ? '#E5E7EB' : '#F3F4F6'} strokeWidth="1" />
      ))}
      {dims.map((_, i) => {
        const [x, y] = pt(i, 5)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#F3F4F6" strokeWidth="1" />
      })}
      <polygon points={dims.map((k, i) => pt(i, attrs[k] || 1).join(',')).join(' ')} fill="rgba(232,148,15,0.22)" stroke="#E8940F" strokeWidth="2" />
      {dims.map((k, i) => {
        const [x, y] = pt(i, attrs[k] || 1)
        const lb = labelPos(i)
        return (
          <g key={k}>
            <circle cx={x} cy={y} r="2.5" fill="#E8940F" />
            <text x={lb.x} y={lb.y} textAnchor={lb.anchor} fontSize="11" fill="#6B7280" fontWeight="600">{k} {attrs[k]}</text>
          </g>
        )
      })}
    </svg>
  )
}
