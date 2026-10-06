import { useEffect, useMemo, useState } from 'react'
import { CITY_GEO, 区位到区划, 定位点 } from './geoConfig.mjs'

// V52 · 选址真实地图（SVG · 等经距投影 · 零依赖）
// 数据 = 真实行政边界 GeoJSON（DataV · 静态内置 public/geo/）· 点击区划 = 选中区位（同芯片）
// 回退：GeoJSON 加载失败 ⇒ 返回 null（父组件保留原芯片卡片视图 = 老浏览器/窄屏回退路径）

export default function GeoMap({ city, districts, selected, onSelect, dark }) {
  const [geo, setGeo] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const file = CITY_GEO[city]
    if (!file) { setGeo(null); return }
    let alive = true
    setGeo(null); setFailed(false)
    fetch(file)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(j => { if (alive) setGeo(j) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [city])

  // 区划名 → 本城应用区位名（可能一区多区位：如 旌阳区 ⟵ 旌阳区/五洲广场商圈）
  const 区划到区位 = useMemo(() => {
    const m = {}
    for (const d of districts) {
      const admin = 区位到区划[d.name] || d.name
      ;(m[admin] = m[admin] || []).push(d.name)
    }
    return m
  }, [districts])

  const paths = useMemo(() => {
    if (!geo) return null
    let minX = 180, minY = 90, maxX = -180, maxY = -90
    const rings = []
    for (const f of geo.features) {
      const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]
      for (const poly of polys) {
        const pts = poly[0].map(([lng, lat]) => [lng, lat])   // 外环（内环=飞地 · 教学展示忽略）
        for (const [x, y] of pts) {
          if (x < minX) minX = x; if (x > maxX) maxX = x
          if (y < minY) minY = y; if (y > maxY) maxY = y
        }
        rings.push({ name: f.properties.name, pts, centroid: f.properties.centroid })
      }
    }
    const W = 760
    const midLat = (minY + maxY) / 2
    const kx = Math.cos((midLat * Math.PI) / 180)   // 等经距：纬度中值的经度收缩修正
    const spanX = (maxX - minX) * kx, spanY = maxY - minY
    const H = Math.max(240, Math.min(560, W * (spanY / Math.max(spanX, 0.0001))))
    const sx = W / spanX, sy = H / spanY
    const proj = ([lng, lat]) => [(lng - minX) * kx * sx, (maxY - lat) * sy]
    return {
      W, H,
      shapes: rings.map(r => {
        const d = r.pts.map((p, i) => (i ? 'L' : 'M') + proj(p)[0].toFixed(1) + ' ' + proj(p)[1].toFixed(1)).join('') + 'Z'
        return { ...r, d, center: r.centroid ? proj(r.centroid) : null }
      }),
      proj,
    }
  }, [geo])

  if (failed) return null                    // 回退：芯片卡片视图仍在（原有 UI 未删）
  if (!paths) {
    return <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>真实边界加载中…</div>
  }

  const pick = (name) => {
    const l = 区划到区位[name]
    if (l && l.length && onSelect) onSelect(l[0])
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, background: dark ? 'var(--card)' : 'var(--card)', padding: 6, overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${paths.W} ${paths.H}`} width="100%" style={{ display: 'block', minWidth: 340 }} role="img" aria-label={`${city}真实行政区划地图（DataV 边界数据）`}>
        {paths.shapes.map(s => {
          const 区位s = 区划到区位[s.name] || []
          const isSel = 区位s.includes(selected)
          const relevant = 区位s.length > 0
          return (
            <path key={s.name} d={s.d}
              fill={isSel ? 'var(--primary)' : relevant ? 'var(--primary-bg)' : 'var(--fill)'}
              stroke={isSel ? 'var(--primary)' : 'var(--border-strong)'}
              strokeWidth={isSel ? 2 : 1}
              style={{ cursor: relevant ? 'pointer' : 'default' }}
              onClick={() => relevant && pick(s.name)}
            />
          )
        })}
        {paths.shapes.map(s => s.center && (
          <text key={'t' + s.name} x={s.center[0]} y={s.center[1]} textAnchor="middle"
            fontSize={11} fill={区划到区位[s.name]?.includes(selected) ? '#fff' : 'var(--text-sub)'}
            style={{ pointerEvents: 'none', fontWeight: 区划到区位[s.name]?.includes(selected) ? 700 : 400 }}>
            {s.name}
          </text>
        ))}
        {/* 无独立行政边界的区位 ⇒ 定位点（真实坐标 · 诚实标注） */}
        {districts.filter(d => 定位点[d.name] && !(区位到区划[d.name] && paths.shapes.some(s => s.name === (区位到区划[d.name])))).map(d => {
          const p = 定位点[d.name]
          const [x, y] = paths.proj([p.lng, p.lat])
          const isSel = d.name === selected
          return (
            <g key={'p' + d.name} style={{ cursor: 'pointer' }} onClick={() => onSelect && onSelect(d.name)}>
              <circle cx={x} cy={y} r={isSel ? 7 : 5} fill={isSel ? 'var(--primary)' : 'var(--warn)'} stroke="#fff" strokeWidth={1.5} />
              <text x={x + 9} y={y + 4} fontSize={11} fontWeight={isSel ? 700 : 400} fill="var(--text)">{d.name}</text>
            </g>
          )
        })}
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', padding: '2px 6px 4px' }}>
        真实行政边界 · 数据源：阿里 DataV 行政区划 GeoJSON（2026-10-06 获取 · 静态内置）· 点击区划选中 · 高新区/五洲广场为经济区/商圈无独立边界，以定位点标注
      </div>
    </div>
  )
}
