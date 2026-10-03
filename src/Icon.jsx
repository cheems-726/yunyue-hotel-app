// V10b · 全站唯一图标入口（线性 · 24×24 · stroke 1.8 · currentColor · 无表情）
// 用法：<Icon name="status.done" size={17}/> —— name 必须是《图标字典》里的语义键（守门抓新造）
import { ICONS } from './iconPaths.mjs'

export default function Icon({ name, size = 18, style, className }) {
  const body = ICONS[name]
  if (!body) return null
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
      className={className}
      style={{
        stroke: 'currentColor', fill: 'none', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round', flex: 'none', display: 'block',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
