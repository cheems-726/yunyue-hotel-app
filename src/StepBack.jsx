import React from 'react'

// ★ V186 · 统一「‹ 上一步」按钮（PC 返回上一步 · WAI-ARIA Authoring Practices Wizard 模式）
//   规格：2-任务包/现行/任务包-V186-PC返回上一步.md §2 ——
//   · 根元素 data-step-back（测试锚点）· aria-label="返回上一步"
//   · 高/宽 ≥44px（PC 与 390 都满足）
//   · variant 'top' = 顶栏（≥1024 显示 · 右侧带步数）；默认 'bottom' = 底栏次要按钮（左）
//   · 不可逆点【不渲染本组件】（禁用按钮会让人以为"再点一下也许能退"）——由调用方负责
export default function StepBack({ onBack, disabled = false, disabledReason = '', variant = 'bottom', stepLabel = '', sub = '', label = '', style }) {
  const btn = (
    <button
      type="button"
      data-step-back="1"
      aria-label="返回上一步"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={disabled ? undefined : onBack}
      className="btn btn-ghost"
      style={{
        minHeight: 44, minWidth: 44, padding: '10px 16px', fontSize: 14,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        ...style,
      }}
    >
      {label || '‹ 上一步'}
      {sub ? <span style={{ fontSize: 12, opacity: 0.75 }}>{sub}</span> : null}
    </button>
  )
  if (variant !== 'top') return btn
  return (
    <div data-step-back-bar="1" className="v186-topbar" style={{ justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 6px' }}>
      {btn}
      {stepLabel ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stepLabel}</span> : null}
    </div>
  )
}
