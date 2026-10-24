// V154 批1 · Esc 关弹层（共享钩子）—— 键盘可达性：任何全屏弹层按 Esc 应可关闭
import { useEffect } from 'react'

/**
 * @param {boolean} active 弹层是否开着（false 时不监听）
 * @param {() => void} onClose 关闭回调（Esc 触发）
 * 依赖变化时自动重挂/清理；同一弹层多处使用互不干扰。
 */
export function useEscClose(active, onClose) {
  useEffect(() => {
    if (!active || typeof onClose !== 'function') return
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [active, onClose])
}
