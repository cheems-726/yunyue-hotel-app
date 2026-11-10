import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ShellSwitch, { 读界面形态 } from './ShellSwitch.jsx'
import './styles.css'
import { StatusBar, Style } from '@capacitor/status-bar'

// ★ V188：首帧就带上界面形态，避免先按 APP 排版再跳成网页端（闪烁）
try { document.body.dataset.shell = 读界面形态() } catch (e) { /* 静默理由：无 DOM 时忽略 */ }

// 让系统状态栏透明，内容延伸到状态栏下方（不遮挡真实时间/WiFi）
// ★ 2026-11-10 修复：Capacitor 插件在**网页端**返回 rejected Promise（不是同步 throw），
//   原 try/catch 接不住 ⇒ 控制台出现 Uncaught (in promise) "StatusBar plugin is not implemented on web"。
//   ⇒ 只在原生环境调用，并兜住 Promise。
try {
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
    Promise.resolve(StatusBar.setOverlaysWebView({ overlay: true })).catch(() => {})
    Promise.resolve(StatusBar.setStyle({ style: Style.Dark })).catch(() => {})
  }
} catch (e) {
  // 非 Capacitor 环境（浏览器调试）忽略
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShellSwitch />
    <App />
  </React.StrictMode>
)

// ★ V140 §2：React 真正挂载后才撤掉静态骨架；脚本没跑起来时骨架会一直显示（不是白屏）
const bootEl = document.getElementById('boot')
if (bootEl) {
  setTimeout(() => {
    try { if (document.getElementById('root').firstChild) bootEl.remove() } catch (e) { /* 静默理由：骨架撤不掉不影响页面 */ }
  }, 0)
}
