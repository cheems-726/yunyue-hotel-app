// V115 §3-⑤ 页内提示（替代阻塞式 alert）
export function 提示(text, ms = 2600) {
  try {
    if (typeof document === 'undefined') return
    const d = document.createElement('div')
    d.textContent = String(text)
    d.setAttribute('data-notice', '1')
    d.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:99999;max-width:88vw;padding:10px 14px;border-radius:10px;background:#1f2937;color:#fff;font-size:14px;line-height:1.6;box-shadow:0 6px 24px rgba(0,0,0,.25)'
    document.body.appendChild(d)
    // 静默理由：离线降级：失败走默认值，不阻塞主流程
    setTimeout(() => { try { d.remove() } catch (e) {} }, ms)
  } catch (e) { /* 提示失败不影响主流程 */ }
}
