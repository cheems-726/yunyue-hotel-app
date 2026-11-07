// ★ V188 · 界面形态切换（APP端 / 网页端）—— 固定在右上角，所有页面可见
//   · 选择存 localStorage（hotel-ui-shell），刷新后保持
//   · 生效方式：document.body.dataset.shell = 'app' | 'web'，样式在 styles.css 里按 [data-shell="web"] 覆盖
//   · 纯展示层开关：不改任何业务状态、不改存档、不触发结算
import { useEffect, useState } from 'react'

const KEY = 'hotel-ui-shell'

export function 读界面形态() {
  try { return localStorage.getItem(KEY) === 'web' ? 'web' : 'app' } catch (e) { return 'app' }
}

export default function ShellSwitch() {
  const [shell, setShell] = useState(读界面形态)
  useEffect(() => {
    document.body.dataset.shell = shell
    try { localStorage.setItem(KEY, shell) } catch (e) { /* 静默理由：无 localStorage 时仅本次生效，不阻塞渲染 */ }
  }, [shell])
  return (
    <div className="shell-switch" role="group" aria-label="界面形态（APP端 / 网页端）">
      <button type="button" data-shell-btn="app" aria-pressed={shell === 'app'} onClick={() => setShell('app')}>APP端</button>
      <button type="button" data-shell-btn="web" aria-pressed={shell === 'web'} onClick={() => setShell('web')}>网页端</button>
    </div>
  )
}
