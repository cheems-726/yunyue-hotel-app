// ★ V186 §3.5 · PC 键盘/鼠标返回（Alt+← 与鼠标侧键 = 当前向导的「上一步」）
//   规格：任务包-V186 §2/§3.5 ——
//   · 只在向导容器挂载时注册；经营页/教师端【不挂】⇒ 浏览器自然后退行为不变（不劫持）
//   · 仅当传入的 onBack 存在且未被禁用时 preventDefault 并调用（RV-6：去掉该判断 = 经营页被吞键 = 红）
//   · keydown: Alt+ArrowLeft · mousedown: button === 4（鼠标侧键）
import { useEffect } from 'react'

export function useWizardBack(active, onBack, disabled = false) {
  useEffect(() => {
    if (!active || typeof onBack !== 'function' || disabled) return
    const onKey = (e) => {
      if (e.altKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        e.preventDefault()
        onBack()
      }
    }
    const onMouse = (e) => {
      if (e.button === 4) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouse)
    }
  }, [active, onBack, disabled])
}
